const port = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ver = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json()
const bws = new WebSocket(ver.webSocketDebuggerUrl)
await new Promise((r, j) => { bws.onopen = r; bws.onerror = j })
let bid = 0; const bp = new Map()
bws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && bp.has(m.id)) { bp.get(m.id)(m); bp.delete(m.id) } }
const bsend = (m, p) => new Promise((res) => { const i = ++bid; bp.set(i, res); bws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (bp.has(i)) { bp.delete(i); res({ __t: 1 }) } }, 15000) })
console.log('ext:', JSON.stringify((await bsend('Extensions.loadUnpacked', { path: 'D:/dsh/x-reply-ext-05' })).result))
await sleep(1000)
const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const page = list.find((t) => t.type === 'page' && /x\.com/.test(t.url))
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({ __t: 1 }) } }, 9000) })
const ev = async (x) => { const o = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (o.__t) return 'timeout'; if (o.result && o.result.exceptionDetails) return 'exc'; return o.result && o.result.result ? o.result.result.value : o.result }
await send('Page.enable')
await send('Page.navigate', { url: 'https://x.com/home' })
for (let i = 0; i < 25; i++) { const n = await ev('document.querySelectorAll(".xr-btn").length'); if (n > 0) break; await sleep(800) }
console.log('buttons:', await ev('document.querySelectorAll(".xr-btn").length'))
await ev('(() => { const a = document.querySelector(\'article[data-testid="tweet"]\'); a.dispatchEvent(new CustomEvent("xr:quick", { bubbles: true })); return 1 })()')
for (let i = 0; i < 12; i++) {
  await sleep(1500)
  const r = await ev('(() => { const eds = [...document.querySelectorAll(\'[data-testid="tweetTextarea_0"]\')].filter(e => e.offsetParent !== null); const e = eds[eds.length-1]; return { url: location.pathname, len: e ? (e.textContent||"").length : 0, txt: e ? (e.textContent||"").slice(0,70) : "" } })()')
  console.log('+' + ((i+1)*1.5) + 's', JSON.stringify(r))
  if (r && r.len > 0) break
}
ws.close(); bws.close(); process.exit(0)
