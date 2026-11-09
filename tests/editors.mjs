const port = 9222
const pages = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).filter((p) => p.type === 'page')
const page = pages.find((p) => /x\.com/.test(p.url))
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({}) } }, 10000) })
const ev = async (x) => { const o = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); return o.result && o.result.result ? o.result.result.value : o.result }
await send('Runtime.enable')
console.log('dialogs:', await ev('document.querySelectorAll(\'[role="dialog"]\').length'))
console.log('all editors:', JSON.stringify(await ev(String.raw`[...document.querySelectorAll('[data-testid="tweetTextarea_0"]')].map(e => {
  const r = e.getBoundingClientRect();
  const box = e.closest('[role="dialog"]') ? 'dialog' : (e.closest('article[data-testid="tweet"]') ? 'article' : (e.closest('[data-testid="cellInnerDiv"]') ? 'cell' : 'page'));
  return { vis: !!e.offsetParent, y: Math.round(r.y), h: Math.round(r.height), where: box, ph: (e.getAttribute('aria-label')||''), len: (e.textContent||'').length };
})`)))
console.log('bar:', JSON.stringify(await ev('(() => { const b=document.querySelector(".xr-bar"); return b?{label:(b.querySelector(".xr-bar-label")||{}).textContent}:null })()')))
ws.close(); process.exit(0)
