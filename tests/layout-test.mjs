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
await ev('(() => { const a = document.querySelector(\'article[data-testid="tweet"]\'); const b = a && a.querySelector(\'[data-testid="reply"]\'); if (b) b.click(); return 1 })()')
await sleep(2500)
console.log('layout:', JSON.stringify(await ev(String.raw`(() => {
  const p=document.querySelector('.xr-panel'); const eds=[...document.querySelectorAll('[data-testid="tweetTextarea_0"]')].filter(e=>e.offsetParent!==null); const e=eds[eds.length-1];
  if(!p||!e) return {panel:!!p, editor:!!e};
  const pr=p.getBoundingClientRect(), er=e.getBoundingClientRect();
  const overlap=!(pr.right<er.left||pr.left>er.right||pr.bottom<er.top||pr.top>er.bottom);
  return { panel:{x:Math.round(pr.x),y:Math.round(pr.y),w:Math.round(pr.width)}, editor:{x:Math.round(er.x),y:Math.round(er.y),w:Math.round(er.width)}, overlap };
})()`)))
// 打字测试（面板开着）
await ev(String.raw`(() => { const eds=[...document.querySelectorAll('[data-testid="tweetTextarea_0"]')].filter(e=>e.offsetParent!==null); const e=eds[eds.length-1]; e.focus(); return 1 })()`)
await send('Input.dispatchKeyEvent', { type: 'keyDown', text: '能', key: '能' })
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: '能' })
await sleep(500)
console.log('typing while panel open:', JSON.stringify(await ev('(() => { const eds=[...document.querySelectorAll(\'[data-testid="tweetTextarea_0"]\')].filter(e=>e.offsetParent!==null); const e=eds[eds.length-1]; return e ? (e.textContent||"").slice(0,20) : null })()')))
// 收起
await ev('(() => { const b=[...document.querySelectorAll(".xr-panel header button")].find(x=>x.textContent==="—"); if(b) b.click(); return 1 })()')
await sleep(300)
console.log('collapsed:', JSON.stringify(await ev('(() => { const p=document.querySelector(".xr-panel"); return p ? { collapsed: p.classList.contains("xr-collapsed"), bodyVisible: p.querySelector(".xr-body").offsetParent !== null } : null })()')))
ws.close(); bws.close(); process.exit(0)
