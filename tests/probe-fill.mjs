import { spawn } from 'node:child_process'
import { existsSync, rmSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const extDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(extDir, 'tests', 'out'); mkdirSync(outDir, { recursive: true })
const prof = process.env.CHROME_PROFILE
for (const f of ['SingletonLock','SingletonCookie','SingletonSocket','lockfile','Default/LOCK','Default/lockfile']) { try { rmSync(join(prof, f), { force: true, recursive: true }) } catch {} }
const port = Number(process.env.CDP_PORT || 9362)
const child = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--remote-debugging-port=' + port, '--user-data-dir=' + prof, '--proxy-server=http://127.0.0.1:7890',
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1400,950', 'about:blank',
], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ver = null
for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + port + '/json/version'); if (r.ok) { ver = await r.json(); break } } catch {} await sleep(300) }
const bws = new WebSocket(ver.webSocketDebuggerUrl)
await new Promise((res, rej) => { bws.onopen = res; bws.onerror = rej })
let bid = 0; const bp = new Map()
bws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && bp.has(m.id)) { bp.get(m.id)(m); bp.delete(m.id) } }
const bsend = (method, params) => new Promise((res) => { const i = ++bid; bp.set(i, res); bws.send(JSON.stringify({ id: i, method, params: params || {} })) })
await bsend('Extensions.loadUnpacked', { path: extDir })
let target = null
for (let i = 0; i < 40 && !target; i++) { const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json(); target = list.find((t) => t.type === 'page'); if (!target) await sleep(300) }
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (method, params) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) })
const evalJs = async (expression) => {
  const r = await Promise.race([send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }), new Promise((x) => setTimeout(() => x({ t: 1 }), 12000))])
  if (r.t) return undefined
  return r.result && r.result.result ? r.result.result.value : undefined
}
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
for (const c of [{ name: 'auth_token', value: process.env.TWITTER_AUTH_TOKEN }, { name: 'ct0', value: process.env.TWITTER_CT0 }]) await send('Network.setCookie', { name: c.name, value: c.value, domain: '.x.com', path: '/', secure: true, httpOnly: c.name === 'auth_token', sameSite: 'None' })
await send('Page.navigate', { url: 'https://x.com/home' })
for (let i = 0; i < 40; i++) { const n = await evalJs('document.querySelectorAll(\'article[data-testid="tweet"]\').length') || 0; if (n > 0) break; await sleep(1000) }
const out = await evalJs(String.raw`(async () => {
  const btn = document.querySelector('.xr-btn');
  if (!btn) return { error: 'no button' };
  btn.click();
  await new Promise(r => setTimeout(r, 300));
  const draft = document.querySelector('.xr-panel .xr-item textarea').value;
  const replyBtn = document.querySelector('article[data-testid="tweet"] [data-testid="reply"]');
  if (replyBtn) replyBtn.click();
  await new Promise(r => setTimeout(r, 1500));
  const fillBtn = [...document.querySelectorAll('.xr-panel .xr-item button')].find(b => b.textContent.includes('填入'));
  if (!fillBtn) return { error: 'no fill button' };
  fillBtn.click();
  await new Promise(r => setTimeout(r, 1800));
  const eds = [...document.querySelectorAll('[data-testid^="tweetTextarea_"]')].map(e => ({
    testid: e.getAttribute('data-testid'),
    children: e.childElementCount,
    textLen: (e.textContent || '').length,
    text: (e.textContent || '').slice(0, 80),
  }));
  const key = draft.slice(0, 12);
  const bodyHits = document.body.innerText.split(key).length - 1;
  return { draftLen: draft.length, draft: draft.slice(0, 60), editors: eds, bodyHits };
})()`)
console.log('填充验证:', JSON.stringify(out, null, 1))
ws.close(); bws.close(); try { child.kill() } catch {}
process.exit(0)
