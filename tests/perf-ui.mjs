const port = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stop = setTimeout(() => { console.log('HARD_TIMEOUT'); process.exit(9) }, 120000)
const pages = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).filter((x) => x.type === 'page')
const page = pages.find((t) => /x\.com/.test(t.url))
if (!page) { console.log('no x tab'); process.exit(2) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({ __t: 1 }) } }, 8000) })
const ev = async (x) => { const o = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (o.__t) return { __timeout: true }; if (o.result && o.result.exceptionDetails) return { __error: (o.result.exceptionDetails.exception || {}).description || o.result.exceptionDetails.text }; return o.result && o.result.result ? o.result.result.value : o.result }
await send('Runtime.enable')

// 响应性：连续 10 次简单求值的耗时
const t0 = Date.now(); let bad = 0
for (let i = 0; i < 10; i++) { const r = await ev('1+1'); if (r !== 2) bad++ }
console.log('响应性: 10 次求值 ' + (Date.now() - t0) + 'ms，异常 ' + bad)

console.log('state:', JSON.stringify(await ev('({buttons: document.querySelectorAll(".xr-btn").length, tweets: document.querySelectorAll(\'article[data-testid="tweet"]\').length})')))
console.log('rail:', JSON.stringify(await ev(String.raw`(() => { const a = document.querySelector('article[data-testid="tweet"]'); a.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); return { rail: !!document.querySelector('.xr-rail'), btns: [...document.querySelectorAll('.xr-rail-btn')].map(b => b.textContent) } })()`)))
console.log('fire:', await ev('(() => { const a = document.querySelector(\'article[data-testid="tweet"]\'); a.dispatchEvent(new CustomEvent("xr:quick", { bubbles: true })); return "ok" })()'))
for (let i = 0; i < 10; i++) {
  await sleep(1500)
  const r = await ev('(() => { const ed = document.querySelector(\'[data-testid="tweetTextarea_0"]\'); return { url: location.pathname, len: ed ? (ed.textContent||"").length : 0, bar: !!document.querySelector(".xr-bar") } })()')
  console.log('+' + ((i + 1) * 1.5) + 's', JSON.stringify(r))
  if (r && (r.len > 0 || r.bar)) break
}
clearTimeout(stop); ws.close(); process.exit(0)
