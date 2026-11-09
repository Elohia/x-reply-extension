const port = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pages = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).filter((p) => p.type === 'page')
const page = pages.find((p) => /x\.com/.test(p.url)) || pages[0]
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({}) } }, 10000) })
const ev = async (x) => { const o = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (o.result && o.result.exceptionDetails) return 'exc'; return o.result && o.result.result ? o.result.result.value : o.result }
await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable')
for (const c of [{ name: 'auth_token', value: process.env.TWITTER_AUTH_TOKEN }, { name: 'ct0', value: process.env.TWITTER_CT0 }]) {
  if (!c.value) continue
  const r = await send('Network.setCookie', { name: c.name, value: c.value, domain: '.x.com', path: '/', secure: true, httpOnly: c.name === 'auth_token', sameSite: 'None' })
  console.log('cookie', c.name, JSON.stringify(r.result || {}))
}
await send('Page.navigate', { url: 'https://x.com/home' })
await sleep(6000)
for (let i = 0; i < 25; i++) { const n = await ev('document.querySelectorAll(\'article[data-testid="tweet"]\').length'); if (n > 0) break; await sleep(1000) }
console.log('state:', JSON.stringify(await ev('({url: location.href, tweets: document.querySelectorAll(\'article[data-testid="tweet"]\').length, launcher: !!document.getElementById("xr-launcher")})')))
const n = await ev('document.querySelectorAll(\'article[data-testid="tweet"]\').length')
if (n > 0) {
  await ev('document.getElementById("xr-launcher").click()')
  await sleep(700)
  console.log('0.7s:', JSON.stringify(await ev('(() => { const p=document.querySelector(".xr-panel"); return p?{items:p.querySelectorAll(".xr-item").length, strip:(p.querySelector(".xr-loading")||{}).textContent||""}:null })()')))
  await sleep(3500)
  console.log('4s:', JSON.stringify(await ev('(() => { const p=document.querySelector(".xr-panel"); return p?{items:p.querySelectorAll(".xr-item").length, strip:(p.querySelector(".xr-loading")||{}).textContent||"", first:(p.querySelector(".xr-item textarea")||{}).value||""}:null })()')))
}
const { writeFileSync } = await import('node:fs')
const shot = await send('Page.captureScreenshot', { format: 'png' })
if (shot.result && shot.result.data) { writeFileSync('D:/dsh/x-reply-extension/tests/out/user-real2.png', Buffer.from(shot.result.data, 'base64')); console.log('shot') }
ws.close(); process.exit(0)
