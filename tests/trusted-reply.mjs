const port = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ver = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json()
const bws = new WebSocket(ver.webSocketDebuggerUrl)
await new Promise((r, j) => { bws.onopen = r; bws.onerror = j })
let bid = 0; const bp = new Map()
bws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && bp.has(m.id)) { bp.get(m.id)(m); bp.delete(m.id) } }
const bsend = (m, p) => new Promise((res) => { const i = ++bid; bp.set(i, res); bws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (bp.has(i)) { bp.delete(i); res({}) } }, 12000) })
console.log('reload:', JSON.stringify((await bsend('Extensions.loadUnpacked', { path: 'D:/dsh/x-reply-extension' })).result))
await sleep(600)
const pages = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).filter((p) => p.type === 'page')
const page = pages.find((p) => /x\.com/.test(p.url))
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({}) } }, 15000) })
const ev = async (x) => { const o = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (o.result && o.result.exceptionDetails) return 'exc'; return o.result && o.result.result ? o.result.result.value : o.result }
await send('Runtime.enable'); await send('Network.enable'); await send('Page.enable')
for (const c of [{ name: 'auth_token', value: process.env.TWITTER_AUTH_TOKEN }, { name: 'ct0', value: process.env.TWITTER_CT0 }]) {
  if (c.value) await send('Network.setCookie', { name: c.name, value: c.value, domain: '.x.com', path: '/', secure: true, httpOnly: c.name === 'auth_token', sameSite: 'None' })
}
await send('Page.navigate', { url: 'https://x.com/home' })
for (let i = 0; i < 30; i++) { const n = await ev('document.querySelectorAll(\'article[data-testid="tweet"]\').length'); if (n > 1) break; await sleep(900) }
const pos = await ev(String.raw`(() => { const a=document.querySelector('article[data-testid="tweet"]'); const b=a && a.querySelector('[data-testid="reply"]'); if(!b) return null; const r=b.getBoundingClientRect(); return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) }; })()`)
console.log('reply btn at:', JSON.stringify(pos))
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos.x, y: pos.y })
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 1 })
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 1 })
await sleep(2500)
console.log('editors:', JSON.stringify(await ev(String.raw`[...document.querySelectorAll('[data-testid="tweetTextarea_0"]')].map(e => { const r=e.getBoundingClientRect(); return { vis:!!e.offsetParent, y:Math.round(r.y), aria:(e.getAttribute('aria-label')||''), inDialog: !!e.closest('[role="dialog"]'), focused: document.activeElement===e }; })`)))
console.log('bar:', JSON.stringify(await ev('(() => { const b=document.querySelector(".xr-bar"); if(!b) return null; const r=b.getBoundingClientRect(); return { label:(b.querySelector(".xr-bar-label")||{}).textContent, y:Math.round(r.y), chips:[...b.querySelectorAll(".xr-chip")].map(c=>c.textContent) }; })()')))
// 直接打字（X 自己会聚焦回复框）
await send('Input.dispatchKeyEvent', { type: 'keyDown', text: '手', key: '手' })
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: '手' })
await sleep(600)
console.log('typing:', JSON.stringify(await ev(String.raw`[...document.querySelectorAll('[data-testid="tweetTextarea_0"]')].map(e => ({ aria:(e.getAttribute('aria-label')||''), len:(e.textContent||'').length, txt:(e.textContent||'').slice(0,20) }))`)))
ws.close(); bws.close(); process.exit(0)
