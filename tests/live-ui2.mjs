const port = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const hardStop = setTimeout(() => { console.log('HARD_TIMEOUT'); process.exit(9) }, 90000)
const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const pages = list.filter((t) => t.type === 'page')
console.log('pages:', pages.map((p) => p.url).join(' | '))
const page = pages.find((t) => /x\.com/.test(t.url))
if (!page) { console.log('no x tab'); process.exit(2) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({ __t: 1 }) } }, 15000) })
const ev = async (x) => { const o = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (o.__t) return { __timeout: true }; if (o.result && o.result.exceptionDetails) return { __error: (o.result.exceptionDetails.exception || {}).description || o.result.exceptionDetails.text }; return o.result && o.result.result ? o.result.result.value : o.result }
await send('Runtime.enable')
const st = await ev('({url: location.href, buttons: document.querySelectorAll(".xr-btn").length, tweets: document.querySelectorAll(\'article[data-testid="tweet"]\').length})')
console.log('state:', JSON.stringify(st))
if (st && st.tweets > 0) {
  console.log('rail:', JSON.stringify(await ev(String.raw`(async () => { const a = document.querySelector('article[data-testid="tweet"]'); a.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); await new Promise(r => setTimeout(r, 300)); return { rail: !!document.querySelector('.xr-rail'), btns: [...document.querySelectorAll('.xr-rail-btn')].map(b => b.textContent) } })()`)))
  console.log('quick:', JSON.stringify(await ev(String.raw`(async () => { const a = document.querySelector('article[data-testid="tweet"]'); a.dispatchEvent(new CustomEvent('xr:quick', { bubbles: true })); await new Promise(r => setTimeout(r, 7000)); const ed = document.querySelector('[data-testid="tweetTextarea_0"]'); return { hook: document.documentElement.dataset.xrQuick || 'none', len: ed ? (ed.textContent || '').length : 0, bar: !!document.querySelector('.xr-bar'), chips: [...document.querySelectorAll('.xr-chip')].map(c => c.textContent) } })()`)))
}
clearTimeout(hardStop); ws.close(); process.exit(0)
