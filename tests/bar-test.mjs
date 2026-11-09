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
for (let i = 0; i < 30; i++) { await sleep(700); const ok = await ev('!!document.querySelector(".xr-bar")'); if (ok === true) break }
console.log('面板存在(应为false):', await ev('!!document.querySelector(".xr-panel")'))
console.log('编辑器可见性:', JSON.stringify(await ev(String.raw`(() => { const eds=[...document.querySelectorAll('[data-testid="tweetTextarea_0"]')].filter(e=>e.offsetParent!==null); const e=eds[eds.length-1]; if(!e) return null; const r=e.getBoundingClientRect(); return { y: Math.round(r.y), h: Math.round(r.height), visible: r.top>=0 && r.bottom<=window.innerHeight, focused: document.activeElement===e }; })()`)))
console.log('候选条:', JSON.stringify(await ev(String.raw`(() => {
  const b=document.querySelector('.xr-bar'); const eds=[...document.querySelectorAll('[data-testid="tweetTextarea_0"]')].filter(e=>e.offsetParent!==null); const e=eds[eds.length-1];
  if(!b) return null;
  const br=b.getBoundingClientRect(), er=e?e.getBoundingClientRect():null;
  const overlap = er? !(br.right<er.left||br.left>er.right||br.bottom<er.top||br.top>er.bottom):null;
  return { label:(b.querySelector('.xr-bar-label')||{}).textContent, chips:[...b.querySelectorAll('.xr-chip')].map(c=>c.textContent), overlapWithEditor: overlap, bar:{x:Math.round(br.x),y:Math.round(br.y),w:Math.round(br.width),h:Math.round(br.height)}, editor: er?{y:Math.round(er.y),h:Math.round(er.height)}:null };
})()`)))
// 打字（条开着）
await ev(String.raw`(() => { const eds=[...document.querySelectorAll('[data-testid="tweetTextarea_0"]')].filter(e=>e.offsetParent!==null); const e=eds[eds.length-1]; e.focus(); return 1 })()`)
await send('Input.dispatchKeyEvent', { type: 'keyDown', text: '能', key: '能' })
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: '能' })
await sleep(500)
console.log('打字结果:', JSON.stringify(await ev('(() => { const eds=[...document.querySelectorAll(\'[data-testid="tweetTextarea_0"]\')].filter(e=>e.offsetParent!==null); const e=eds[eds.length-1]; return e?(e.textContent||"").slice(0,20):null })()')))
// 点第一条候选填入
await ev('(() => { const c=[...document.querySelectorAll(".xr-chip")][0]; if (c) c.click(); return 1 })()')
await sleep(1200)
console.log('点候选后:', JSON.stringify(await ev('(() => { const eds=[...document.querySelectorAll(\'[data-testid="tweetTextarea_0"]\')].filter(e=>e.offsetParent!==null); const e=eds[eds.length-1]; return e?(e.textContent||"").slice(0,50):null })()')))
ws.close(); bws.close(); process.exit(0)
