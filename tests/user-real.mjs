const port = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const pages = list.filter((t) => t.type === 'page')
console.log('tabs:', pages.map((p) => p.url.slice(0, 60)).join(' | '))
const page = pages.find((p) => /x\.com/.test(p.url))
if (!page) { console.log('NO X TAB'); process.exit(2) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({}) } }, 10000) })
const ev = async (x) => { const o = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (o.result && o.result.exceptionDetails) return 'exc:' + ((o.result.exceptionDetails.exception || {}).description || '').slice(0, 100); return o.result && o.result.result ? o.result.result.value : o.result }
await send('Runtime.enable'); await send('Page.enable')
await send('Page.navigate', { url: 'https://x.com/home' })
await sleep(6000)
for (let i = 0; i < 20; i++) { const n = await ev('document.querySelectorAll(\'article[data-testid="tweet"]\').length'); if (n > 0) break; await sleep(1000) }
console.log('state:', JSON.stringify(await ev('({url: location.href, tweets: document.querySelectorAll(\'article[data-testid="tweet"]\').length, launcher: !!document.getElementById("xr-launcher"), login: !!document.querySelector(\'a[href="/login"]\')})')))
await ev('document.getElementById("xr-launcher").click()')
await sleep(700)
console.log('panel 0.7s:', JSON.stringify(await ev('(() => { const p = document.querySelector(".xr-panel"); if (!p) return null; return { items: p.querySelectorAll(".xr-item").length, strip: (p.querySelector(".xr-loading")||{}).textContent || "", bodyLen: (p.querySelector(".xr-body")||{}).innerText.length, toast: (document.querySelector(".xr-toast")||{}).textContent || "" } })()')))
await sleep(4000)
console.log('panel 4.7s:', JSON.stringify(await ev('(() => { const p = document.querySelector(".xr-panel"); if (!p) return null; return { items: p.querySelectorAll(".xr-item").length, strip: (p.querySelector(".xr-loading")||{}).textContent || "", first: (p.querySelector(".xr-item textarea")||{}).value || "", angles: [...p.querySelectorAll(".xr-angle")].map(e=>e.textContent) } })()')))
const { writeFileSync } = await import('node:fs')
const shot = await send('Page.captureScreenshot', { format: 'png' })
if (shot.result && shot.result.data) { writeFileSync('D:/dsh/x-reply-extension/tests/out/user-real.png', Buffer.from(shot.result.data, 'base64')); console.log('shot') }
ws.close(); process.exit(0)
