const port = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const page = list.find((t) => t.type === 'page' && /x\.com/.test(t.url))
if (!page) { console.log('no x.com tab:', list.filter(t=>t.type==='page').map(t=>t.url).join(' | ')); process.exit(2) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })) })
const ev = async (x) => { const o = await Promise.race([send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }), new Promise((r) => setTimeout(() => r({ t: 1 }), 30000))]); if (o.t) return { __timeout: true }; if (o.result && o.result.exceptionDetails) return { __error: (o.result.exceptionDetails.exception || {}).description || o.result.exceptionDetails.text }; return o.result && o.result.result ? o.result.result.value : o.result }
await send('Runtime.enable'); await send('Page.enable')
await send('Page.navigate', { url: 'https://x.com/home' })
for (let i = 0; i < 40; i++) { const n = await ev('document.querySelectorAll(".xr-btn").length'); if (n > 0) break; await new Promise(r => setTimeout(r, 700)) }
console.log('hooks:', await ev('({buttons: document.querySelectorAll(".xr-btn").length, tweets: document.querySelectorAll(\'article[data-testid="tweet"]\').length})'))
const r1 = await ev(String.raw`(async () => {
  const art = document.querySelector('article[data-testid="tweet"]');
  art.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  await new Promise(x => setTimeout(x, 300));
  return { rail: !!document.querySelector('.xr-rail'), btns: [...document.querySelectorAll('.xr-rail-btn')].map(b => b.textContent) };
})()`)
console.log('rail:', JSON.stringify(r1))
const r2 = await ev(String.raw`(async () => {
  const art = document.querySelector('article[data-testid="tweet"]');
  art.dispatchEvent(new CustomEvent('xr:quick', { bubbles: true }));
  await new Promise(x => setTimeout(x, 9000));
  const ed = document.querySelector('[data-testid="tweetTextarea_0"]');
  return {
    hook: document.documentElement.dataset.xrQuick || 'none',
    editorLen: ed ? (ed.textContent || '').length : 0,
    editorText: ed ? (ed.textContent || '').slice(0, 70) : null,
    bar: !!document.querySelector('.xr-bar'),
    chips: [...document.querySelectorAll('.xr-chip')].map(c => c.textContent),
  };
})()`)
console.log('quick:', JSON.stringify(r2))
ws.close(); process.exit(0)
