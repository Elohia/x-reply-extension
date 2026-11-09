const port = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ver = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json()
const bws = new WebSocket(ver.webSocketDebuggerUrl)
await new Promise((r, j) => { bws.onopen = r; bws.onerror = j })
let bid = 0; const bp = new Map()
bws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && bp.has(m.id)) { bp.get(m.id)(m); bp.delete(m.id) } }
const bsend = (m, p) => new Promise((res) => { const i = ++bid; bp.set(i, res); bws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (bp.has(i)) { bp.delete(i); res({}) } }, 15000) })
const ext = await bsend('Extensions.loadUnpacked', { path: 'D:/dsh/x-reply-extension' })
console.log('loadUnpacked:', JSON.stringify(ext.result || ext.error))
const created = await bsend('Target.createTarget', { url: 'https://x.com/home' })
const tid = (created.result || {}).targetId
await sleep(3000)
const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const page = list.find((t) => t.id === tid) || list.find((t) => /x\.com/.test(t.url))
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({}) } }, 10000) })
const ev = async (x) => { const o = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (o.result && o.result.exceptionDetails) return 'exc:' + ((o.result.exceptionDetails.exception || {}).description || '').slice(0, 120); return o.result && o.result.result ? o.result.result.value : o.result }
await send('Runtime.enable'); await send('Page.enable')
for (let i = 0; i < 30; i++) { const n = await ev('document.querySelectorAll(\'article[data-testid="tweet"]\').length'); if (n > 0) break; await sleep(900) }
console.log('tweets:', await ev('document.querySelectorAll(\'article[data-testid="tweet"]\').length'))
console.log('launcher:', await ev('!!document.getElementById("xr-launcher")'))
if (await ev('!!document.getElementById("xr-launcher")') === true) {
  await ev('document.getElementById("xr-launcher").click()')
  await sleep(800)
  console.log('600ms:', JSON.stringify(await ev('(() => { const p=document.querySelector(".xr-panel"); return p?{items:p.querySelectorAll(".xr-item").length, strip:(p.querySelector(".xr-loading")||{}).textContent||"", body:(p.querySelector(".xr-body")||{}).innerText.slice(0,120)}:null })()')))
  await sleep(3000)
  console.log('3.8s:', JSON.stringify(await ev('(() => { const p=document.querySelector(".xr-panel"); return p?{items:p.querySelectorAll(".xr-item").length, strip:(p.querySelector(".xr-loading")||{}).textContent||"", first:(p.querySelector(".xr-item textarea")||{}).value||""}:null })()')))
}
ws.close(); bws.close(); process.exit(0)
