const port = 9222
const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
console.log('targets:', list.map(t => t.type + ' ' + String(t.url).slice(0, 60)).join(' | '))
const target = list.find((t) => t.type === 'page')
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })) })
const evalJs = async (expr) => { const o = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return o.result && o.result.result ? o.result.result.value : o.result }
console.log('page:', JSON.stringify(await evalJs('({url: location.href, tweets: document.querySelectorAll(\'article[data-testid="tweet"]\').length, buttons: document.querySelectorAll(".xr-btn").length, readyState: document.readyState})')))
ws.close()
process.exit(0)
