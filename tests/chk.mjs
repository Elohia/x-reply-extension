const port = 9222
const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
console.log(list.filter(t => t.type === 'page').map(t => t.url).join(' | '))
const page = list.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })) })
const ev = async (x) => { const o = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); return o.result && o.result.result ? o.result.result.value : o.result }
console.log(JSON.stringify(await ev('({url: location.href, title: document.title, tweets: document.querySelectorAll(\'article[data-testid="tweet"]\').length, buttons: document.querySelectorAll(".xr-btn").length})')))
ws.close(); process.exit(0)
