const port = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pages = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).filter((p) => p.type === 'page')
const page = pages.find((p) => /x\.com\/home/.test(p.url)) || pages.find((p) => /x\.com/.test(p.url))
if (!page) { console.log('no x tab:', pages.map(p => p.url).join(' | ')); process.exit(2) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({}) } }, 12000) })
const ev = async (x) => { const o = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (o.result && o.result.exceptionDetails) return 'exc:' + ((o.result.exceptionDetails.exception || {}).description || '').slice(0, 120); return o.result && o.result.result ? o.result.result.value : o.result }
await send('Runtime.enable')
console.log('state:', JSON.stringify(await ev('({url: location.href, tweets: document.querySelectorAll(\'article[data-testid="tweet"]\').length, launcher: !!document.getElementById("xr-launcher"), panel: !!document.querySelector(".xr-panel")})')))
// 若面板没开就先开
if (await ev('!!document.querySelector(".xr-panel")') !== true) {
  await ev('document.getElementById("xr-launcher").click()')
  await sleep(900)
}
console.log('draft:', JSON.stringify(await ev('(() => { const t = document.querySelector(".xr-panel .xr-item textarea"); return t ? t.value : null })()')))
await ev('(() => { const b = [...document.querySelectorAll(".xr-panel .xr-item button")].find(x => x.textContent.includes("填入")); if (b) b.click(); return 1 })()')
await sleep(3500)
console.log('after fill:', JSON.stringify(await ev('(() => { const eds = [...document.querySelectorAll(\'[data-testid="tweetTextarea_0"]\')].filter(e => e.offsetParent !== null); const e = eds[eds.length-1]; return { url: location.pathname, len: e ? (e.textContent||"").length : 0, txt: e ? (e.textContent||"").slice(0,60) : "", bar: !!document.querySelector(".xr-bar"), toast: (document.querySelector(".xr-toast")||{}).textContent || "" } })()')))
ws.close(); process.exit(0)
