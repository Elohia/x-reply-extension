import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
const port = 9225
const outDir = 'D:/dsh/x-reply-extension/tests/out'
mkdirSync(outDir, { recursive: true })
const prof = outDir + '/clean-profile6'
rmSync(prof, { recursive: true, force: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const child = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--remote-debugging-port=' + port, '--user-data-dir=' + prof,
  '--proxy-server=http://127.0.0.1:7890', '--no-first-run', '--no-default-browser-check',
  '--disable-gpu', '--window-size=1400,950', 'about:blank',
], { stdio: 'ignore' })
let ver = null
for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + port + '/json/version'); if (r.ok) { ver = await r.json(); break } } catch {} await sleep(300) }
const bws = new WebSocket(ver.webSocketDebuggerUrl)
await new Promise((r, j) => { bws.onopen = r; bws.onerror = j })
let bid = 0; const bp = new Map()
bws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && bp.has(m.id)) { bp.get(m.id)(m); bp.delete(m.id) } }
const bsend = (m, p) => new Promise((res) => { const i = ++bid; bp.set(i, res); bws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (bp.has(i)) { bp.delete(i); res({}) } }, 15000) })
console.log('ext:', JSON.stringify((await bsend('Extensions.loadUnpacked', { path: 'D:/dsh/x-reply-ext-11' })).result))
await sleep(1000)
const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const page = list.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({}) } }, 10000) })
const ev = async (x) => { const o = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (o.result && o.result.exceptionDetails) return 'exc:' + ((o.result.exceptionDetails.exception || {}).description || '').slice(0, 80); return o.result && o.result.result ? o.result.result.value : o.result }
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
for (const c of [{ name: 'auth_token', value: process.env.TWITTER_AUTH_TOKEN }, { name: 'ct0', value: process.env.TWITTER_CT0 }]) {
  if (c.value) await send('Network.setCookie', { name: c.name, value: c.value, domain: '.x.com', path: '/', secure: true, httpOnly: c.name === 'auth_token', sameSite: 'None' })
}
await send('Page.navigate', { url: 'https://x.com/home' })
for (let i = 0; i < 40; i++) { const n = await ev('document.querySelectorAll(\'article[data-testid="tweet"]\').length'); if (n > 0) break; await sleep(800) }
console.log('launcher:', await ev('!!document.getElementById("xr-launcher")'))
console.log('注入按钮数(应为 0 说明没监听/没注入):', await ev('document.querySelectorAll(".xr-btn").length'))
// 响应性
const t0 = Date.now(); for (let i = 0; i < 10; i++) await ev('1+1'); console.log('10 次求值:', (Date.now() - t0) + 'ms')
// 滚一下看有没有卡
await ev('window.scrollBy(0, 1200)'); await sleep(800)
// 打开面板
console.log('articles before click:', await ev('document.querySelectorAll(\'article[data-testid="tweet"]\').length'))
await ev('document.getElementById("xr-launcher").click()')
await sleep(1200)
console.log('toast:', await ev('(document.querySelector(".xr-toast")||{}).textContent || "none"'))
console.log('panel exists:', await ev('!!document.querySelector(".xr-panel")'))
const panel = await ev('(() => { const p = document.querySelector(".xr-panel"); return p ? { items: p.querySelectorAll(".xr-item").length, angles: [...p.querySelectorAll(".xr-angle")].map(e=>e.textContent), orig: (p.querySelector(".xr-orig")||{}).textContent.slice(0,40) } : null })()')
console.log('panel:', JSON.stringify(panel))
// 填入第一条
const draft = await ev('(() => { const t = document.querySelector(".xr-panel .xr-item textarea"); return t ? t.value : "" })()')
await ev('(() => { const b = [...document.querySelectorAll(".xr-panel .xr-item button")].find(x => x.textContent.includes("填入")); if (b) b.click(); return 1 })()')
await sleep(2500)
const res = await ev('(() => { const eds = [...document.querySelectorAll(\'[data-testid="tweetTextarea_0"]\')].filter(e => e.offsetParent !== null); const e = eds[eds.length-1]; return { url: location.pathname, len: e ? (e.textContent||"").length : 0, txt: e ? (e.textContent||"").slice(0,60) : "", bar: !!document.querySelector(".xr-bar") } })()')
console.log('draftLen:', Array.from(String(draft||'')).length, 'fill:', JSON.stringify(res))
const shot = await send('Page.captureScreenshot', { format: 'png' })
if (shot.result && shot.result.data) { writeFileSync(outDir + '/standalone.png', Buffer.from(shot.result.data, 'base64')); console.log('shot') }
try { child.kill() } catch {}
process.exit(0)

