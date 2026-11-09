const port = 9222
const pages = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).filter((x) => x.type === 'page')
const page = pages.find((t) => /x\.com/.test(t.url))
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({ __t: 1 }) } }, 8000) })
const ev = async (x) => { const o = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (o.__t) return { __timeout: true }; if (o.result && o.result.exceptionDetails) return { __error: (o.result.exceptionDetails.exception || {}).description }; return o.result && o.result.result ? o.result.result.value : o.result }
await send('Runtime.enable')
console.log('url:', await ev('location.pathname'))
console.log('editors:', JSON.stringify(await ev('[...document.querySelectorAll(\'[data-testid^="tweetTextarea_"]\')].map(e => ({ t: e.getAttribute("data-testid"), vis: !!e.offsetParent, len: (e.textContent||"").length, txt: (e.textContent||"").slice(0,50) }))')))
console.log('bar:', JSON.stringify(await ev('(() => { const b = document.querySelector(".xr-bar"); return b ? { text: b.innerText.slice(0,120), chips: [...document.querySelectorAll(".xr-chip")].map(c=>c.textContent) } : null })()')))
console.log('hook:', await ev('document.documentElement.dataset.xrQuick || "none"'))
ws.close(); process.exit(0)
