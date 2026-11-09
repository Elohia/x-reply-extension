const port = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const page = list.find((t) => t.type === 'page' && /x\.com\/mock/.test(t.url))
if (!page) { console.log('no mock tab'); process.exit(2) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })) })
const ev = async (x) => { const o = await Promise.race([send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }), new Promise((r) => setTimeout(() => r({ t: 1 }), 25000))]); if (o.t) return { __timeout: true }; if (o.result && o.result.exceptionDetails) return { __error: (o.result.exceptionDetails.exception || {}).description || o.result.exceptionDetails.text }; return o.result && o.result.result ? o.result.result.value : o.result }
await send('Page.reload', {})
for (let i = 0; i < 30; i++) { const n = await ev('document.querySelectorAll(".xr-btn").length'); if (n > 0) break; await sleep(500) }
await ev('document.querySelector("article[data-testid=\'tweet\']").dispatchEvent(new CustomEvent("xr:quick", {bubbles:true}))')
await sleep(3000)
console.log('hook:', await ev('document.documentElement.dataset.xrQuick || "none"'))
console.log('editor:', await ev('(() => { const e = document.querySelector("[data-testid=tweetTextarea_0]"); return e ? { visible: !!e.offsetParent, len: (e.textContent||"").length, text: (e.textContent||"").slice(0,60) } : null })()'))
console.log('bar:', await ev('!!document.querySelector(".xr-bar")'))
console.log('chips:', await ev('[...document.querySelectorAll(".xr-chip")].map(c=>c.textContent)'))
ws.close(); process.exit(0)
