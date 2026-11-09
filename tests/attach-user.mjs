const port = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const pages = list.filter((t) => t.type === 'page')
console.log('tabs:', pages.map((p) => p.url.slice(0, 70)).join('\n       '))
const page = pages.find((p) => /x\.com/.test(p.url)) || pages[0]
if (!page) { console.log('no page'); process.exit(2) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({}) } }, 10000) })
const ev = async (x) => { const o = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (o.result && o.result.exceptionDetails) return 'exc:' + ((o.result.exceptionDetails.exception || {}).description || '').slice(0, 100); return o.result && o.result.result ? o.result.result.value : o.result }
await send('Runtime.enable')
console.log('url:', await ev('location.href'))
console.log('state:', JSON.stringify(await ev('({ launcher: !!document.getElementById("xr-launcher"), rBtns: document.querySelectorAll(".xr-btn").length, rail: !!document.querySelector(".xr-rail"), panel: !!document.querySelector(".xr-panel"), tweets: document.querySelectorAll(\'article[data-testid="tweet"]\').length })')))
ws.close(); process.exit(0)
