const port = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pages = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).filter((x) => x.type === 'page')
const page = pages.find((t) => /x\.com/.test(t.url))
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map(); const errs = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
  else if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails && (m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text || '').slice(0, 200))
  else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errs.push('LOG: ' + m.params.entry.text.slice(0, 160))
}
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({ __t: 1 }) } }, 10000) })
const ev = async (x) => { const o = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (o.__t) return { __timeout: true }; if (o.result && o.result.exceptionDetails) return { __error: (o.result.exceptionDetails.exception || {}).description || o.result.exceptionDetails.text }; return o.result && o.result.result ? o.result.result.value : o.result }
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable')
await send('Page.reload', {})
await sleep(6000)
console.log('buttons:', await ev('document.querySelectorAll(".xr-btn").length'))
console.log('errors:', JSON.stringify(errs.slice(0, 5), null, 1))
ws.close(); process.exit(0)
