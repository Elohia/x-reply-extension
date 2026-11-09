import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
const port = 9226
const outDir = 'D:/dsh/x-reply-extension/tests/out'
mkdirSync(outDir, { recursive: true })
const prof = outDir + '/clean-profile7'
rmSync(prof, { recursive: true, force: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const child = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--remote-debugging-port=' + port, '--user-data-dir=' + prof,
  '--proxy-server=http://127.0.0.1:7890', '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1400,950', 'about:blank',
], { stdio: 'ignore' })
let ver = null
for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + port + '/json/version'); if (r.ok) { ver = await r.json(); break } } catch {} await sleep(300) }
const bws = new WebSocket(ver.webSocketDebuggerUrl)
await new Promise((r, j) => { bws.onopen = r; bws.onerror = j })
let bid = 0; const bp = new Map()
bws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && bp.has(m.id)) { bp.get(m.id)(m); bp.delete(m.id) } }
const bsend = (m, p) => new Promise((res) => { const i = ++bid; bp.set(i, res); bws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (bp.has(i)) { bp.delete(i); res({}) } }, 15000) })
const ext = await bsend('Extensions.loadUnpacked', { path: 'D:/dsh/x-reply-ext-12' })
const extId = (ext.result || {}).id
console.log('ext:', extId)
await sleep(800)

// 打开扩展页把 aiEnabled 打开但不填 Key（模拟"AI 开了但调不通"）
const created = await bsend('Target.createTarget', { url: 'chrome-extension://' + extId + '/popup.html' })
await sleep(1500)
const list0 = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const pop = list0.find((t) => t.id === (created.result || {}).targetId)
const pws = new WebSocket(pop.webSocketDebuggerUrl)
await new Promise((r, j) => { pws.onopen = r; pws.onerror = j })
let ps = 0; const pp = new Map()
pws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pp.has(m.id)) { pp.get(m.id)(m); pp.delete(m.id) } }
const psend = (m, p) => new Promise((res) => { const i = ++ps; pp.set(i, res); pws.send(JSON.stringify({ id: i, method: m, params: p || {} })) })
await psend('Runtime.enable')
await psend('Runtime.evaluate', { expression: 'chrome.storage.sync.set({aiEnabled:true}); chrome.storage.local.set({apiKey:""}); "ok"', awaitPromise: true, returnByValue: true })
await bsend('Target.closeTarget', { targetId: pop.id })
pws.close()

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
for (let i = 0; i < 40; i++) { const n = await ev('document.querySelectorAll(\'article[data-testid="tweet"]\').length'); if (n > 0) break; await sleep(800) }
await ev('document.getElementById("xr-launcher").click()')
await sleep(600)
console.log('600ms 时面板:', JSON.stringify(await ev('(() => { const p = document.querySelector(".xr-panel"); return p ? { items: p.querySelectorAll(".xr-item").length, strip: (p.querySelector(".xr-loading")||{}).textContent || "" } : null })()')))
await sleep(2500)
console.log('3s 时面板:', JSON.stringify(await ev('(() => { const p = document.querySelector(".xr-panel"); return p ? { items: p.querySelectorAll(".xr-item").length, strip: (p.querySelector(".xr-loading")||{}).textContent || "", first: (p.querySelector(".xr-item textarea")||{}).value || "" } : null })()')))
const shot = await send('Page.captureScreenshot', { format: 'png' })
if (shot.result && shot.result.data) { writeFileSync(outDir + '/instant-drafts.png', Buffer.from(shot.result.data, 'base64')); console.log('shot') }
try { child.kill() } catch {}
process.exit(0)
