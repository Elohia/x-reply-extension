const port = 9222
const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const page = list.find((t) => t.type === 'page' && /x\.com/.test(t.url))
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({}) } }, 8000) })
const ev = async (x) => { const o = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); return o.result && o.result.result ? o.result.result.value : o.result }
await send('Runtime.enable')
console.log(JSON.stringify(await ev(String.raw`(() => {
  const e = [...document.querySelectorAll('[data-testid="tweetTextarea_0"]')].filter(x => x.offsetParent !== null).pop();
  if (!e) return 'no editor';
  const walk = (n, d) => ({ tag: n.tagName, cls: (n.className||'').toString().slice(0,20), txt: (n.textContent||'').slice(0,30), kids: d > 0 ? [...n.children].map(c => walk(c, d-1)) : undefined });
  return { children: e.childElementCount, text: (e.textContent||''), tree: [...e.children].map(c => walk(c, 1)) };
})()`), null, 1).slice(0, 1500))
ws.close(); process.exit(0)
