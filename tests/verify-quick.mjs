const port = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pages = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).filter((x) => x.type === 'page')
const page = pages.find((t) => /x\.com/.test(t.url))
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({ __t: 1 }) } }, 9000) })
const ev = async (x) => { const o = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (o.__t) return { __timeout: true }; if (o.result && o.result.exceptionDetails) return { __error: (o.result.exceptionDetails.exception || {}).description }; return o.result && o.result.result ? o.result.result.value : o.result }
await send('Runtime.enable'); await send('Page.enable')

// 回到首页并等按钮
await send('Page.navigate', { url: 'https://x.com/home' })
for (let i = 0; i < 30; i++) { const n = await ev('document.querySelectorAll(".xr-btn").length'); if (n > 0) break; await sleep(800) }
console.log('ready:', JSON.stringify(await ev('({tweets: document.querySelectorAll(\'article[data-testid="tweet"]\').length, buttons: document.querySelectorAll(".xr-btn").length})')))

console.log('fire:', await ev('(() => { const a = document.querySelector(\'article[data-testid="tweet"]\'); a.dispatchEvent(new CustomEvent("xr:quick", { bubbles: true })); return "ok" })()'))
for (let i = 0; i < 12; i++) {
  await sleep(1500)
  const r = await ev(String.raw`(() => {
    const eds = [...document.querySelectorAll('[data-testid="tweetTextarea_0"]')].filter(e => e.offsetParent !== null);
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].length;
    return { url: location.pathname, dialogs, eds: eds.map(e => ({ inDialog: !!e.closest('[role="dialog"]'), len: (e.textContent||'').length, txt: (e.textContent||'').slice(0,40) })), bar: !!document.querySelector('.xr-bar') }
  })()`)
  console.log('+' + ((i + 1) * 1.5) + 's', JSON.stringify(r))
  if (r && r.eds && r.eds.some(e => e.inDialog && e.len > 0)) break
}
ws.close(); process.exit(0)
