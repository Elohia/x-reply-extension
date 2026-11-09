/**
 * 干净环境验收：全新 profile + 只装一份插件 + 注入 cookie + 真实 x.com
 * 这就是"新用户只装一个浏览器插件"的场景。
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
const port = 9223
const outDir = 'D:/dsh/x-reply-extension/tests/out'
mkdirSync(outDir, { recursive: true })
const prof = outDir + '/clean-profile'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const child = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--remote-debugging-port=' + port, '--user-data-dir=' + prof,
  '--proxy-server=http://127.0.0.1:7890', '--no-first-run', '--no-default-browser-check',
  '--disable-gpu', '--window-size=1400,950', 'about:blank',
], { stdio: 'ignore' })
let ver = null
for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + port + '/json/version'); if (r.ok) { ver = await r.json(); break } } catch {} await sleep(300) }
console.log('browser:', ver.Browser)
const bws = new WebSocket(ver.webSocketDebuggerUrl)
await new Promise((r, j) => { bws.onopen = r; bws.onerror = j })
let bid = 0; const bp = new Map()
bws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && bp.has(m.id)) { bp.get(m.id)(m); bp.delete(m.id) } }
const bsend = (m, p) => new Promise((res) => { const i = ++bid; bp.set(i, res); bws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (bp.has(i)) { bp.delete(i); res({}) } }, 15000) })
const ext = await bsend('Extensions.loadUnpacked', { path: 'D:/dsh/x-reply-ext-05' })
console.log('extension:', JSON.stringify(ext.result))
await sleep(1200)
const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const page = list.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({}) } }, 10000) })
const ev = async (x) => { const o = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (o.result && o.result.exceptionDetails) return 'exc'; return o.result && o.result.result ? o.result.result.value : o.result }
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
for (const c of [{ name: 'auth_token', value: process.env.TWITTER_AUTH_TOKEN }, { name: 'ct0', value: process.env.TWITTER_CT0 }]) {
  if (c.value) await send('Network.setCookie', { name: c.name, value: c.value, domain: '.x.com', path: '/', secure: true, httpOnly: c.name === 'auth_token', sameSite: 'None' })
}
await send('Page.navigate', { url: 'https://x.com/home' })
for (let i = 0; i < 40; i++) { const n = await ev('document.querySelectorAll(".xr-btn").length'); if (n > 0) break; await sleep(800) }
console.log('buttons:', await ev('document.querySelectorAll(".xr-btn").length'))
await ev('(() => { const a = document.querySelector(\'article[data-testid="tweet"]\'); a.dispatchEvent(new CustomEvent("xr:quick", { bubbles: true })); return 1 })()')
for (let i = 0; i < 14; i++) {
  await sleep(1500)
  const r = await ev('(() => { const eds = [...document.querySelectorAll(\'[data-testid="tweetTextarea_0"]\')].filter(e => e.offsetParent !== null); const e = eds[eds.length-1]; return { url: location.pathname, len: e ? (e.textContent||"").length : 0, txt: e ? (e.textContent||"").slice(0,60) : "", bar: !!document.querySelector(".xr-bar") } })()')
  console.log('+' + ((i+1)*1.5) + 's', JSON.stringify(r))
  if (r && r.len > 0) break
}
const shot = await send('Page.captureScreenshot', { format: 'png' })
if (shot.result && shot.result.data) { writeFileSync(outDir + '/clean-quick.png', Buffer.from(shot.result.data, 'base64')); console.log('shot saved') }
try { child.kill() } catch {}
process.exit(0)
