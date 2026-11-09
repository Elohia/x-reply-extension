const port = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ver = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json()
const bws = new WebSocket(ver.webSocketDebuggerUrl)
await new Promise((r, j) => { bws.onopen = r; bws.onerror = j })
let bid = 0; const bp = new Map()
bws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && bp.has(m.id)) { bp.get(m.id)(m); bp.delete(m.id) } }
const bsend = (m, p) => new Promise((res) => { const i = ++bid; bp.set(i, res); bws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (bp.has(i)) { bp.delete(i); res({ __t: 1 }) } }, 15000) })
const ext = await bsend('Extensions.loadUnpacked', { path: 'D:/dsh/x-reply-ext-03' })
console.log('new ext:', JSON.stringify(ext.result || ext.error))
await sleep(1200)
const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const page = list.find((t) => t.type === 'page' && /x\.com/.test(t.url))
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({ __t: 1 }) } }, 10000) })
const ev = async (x) => { const o = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (o.__t) return 'timeout'; if (o.result && o.result.exceptionDetails) return 'exc:' + ((o.result.exceptionDetails.exception||{}).description||'').slice(0,100); return o.result && o.result.result ? o.result.result.value : o.result }
await send('Page.enable')
await send('Page.reload', {})
for (let i = 0; i < 20; i++) { const n = await ev('document.querySelectorAll(".xr-btn").length'); console.log('t+' + (i+1)*0.8 + 's buttons=' + n); if (n > 0) break; await new Promise(r => setTimeout(r, 800)) }
console.log('final:', await ev('({buttons: document.querySelectorAll(".xr-btn").length, tweets: document.querySelectorAll(\'article[data-testid="tweet"]\').length})'))
bws.close(); ws.close(); process.exit(0)
