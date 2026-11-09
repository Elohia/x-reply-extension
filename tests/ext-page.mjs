const port = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ver = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json()
const bws = new WebSocket(ver.webSocketDebuggerUrl)
await new Promise((r, j) => { bws.onopen = r; bws.onerror = j })
let bid = 0; const bp = new Map()
bws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && bp.has(m.id)) { bp.get(m.id)(m); bp.delete(m.id) } }
const bsend = (m, p) => new Promise((res) => { const i = ++bid; bp.set(i, res); bws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (bp.has(i)) { bp.delete(i); res({ __t: 1 }) } }, 15000) })
const created = await bsend('Target.createTarget', { url: 'chrome://extensions/' })
const tid = created.result && created.result.targetId
await sleep(2500)
const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const page = list.find((t) => t.id === tid)
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({ __t: 1 }) } }, 15000) })
await send('Runtime.enable')
const out = await send('Runtime.evaluate', { expression: '(document.querySelector("extensions-manager") ? document.querySelector("extensions-manager").shadowRoot.textContent : document.body.innerText).slice(0, 1500)', returnByValue: true })
console.log('extensions page:', String(out.result && out.result.result && out.result.result.value).replace(/\s+/g, ' ').slice(0, 1200))
ws.close(); bws.close(); process.exit(0)
