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
const tgt = await ev(String.raw`(() => {
  const arts = [...document.querySelectorAll('article[data-testid="tweet"]')];
  const art = arts.find(a => /\d/.test(((a.querySelector('[data-testid="tweetText"]')||{}).innerText || ''))) || arts[0];
  const name = ((art.querySelector('[data-testid="User-Name"]')||{}).innerText || '').split('\n')[0];
  const txt = ((art.querySelector('[data-testid="tweetText"]')||{}).innerText || '');
  const btn = art.querySelector('[data-testid="reply"]');
  if (btn) btn.click();
  return { name, txt: txt.slice(0, 70) };
})()`)
console.log('目标推文:', JSON.stringify(tgt))
for (let i = 0; i < 30; i++) { await sleep(800); const ok = await ev('!!document.querySelector(".xr-panel .xr-analysis")'); if (ok === true) break }
const out = await ev('(() => { const p = document.querySelector(".xr-panel"); if (!p) return null; const items = [...p.querySelectorAll(".xr-item textarea")].map(t => t.value); return { sub: (p.querySelector("header span")||{}).textContent, analysis: (p.querySelector(".xr-analysis")||{}).textContent, items, meta: (p.querySelector(".xr-foot span")||{}).textContent, hasPlaceholder: items.some(t => /【|】/.test(t)) } })()')
console.log('结果:', JSON.stringify(out, null, 1))
const { writeFileSync } = await import('node:fs')
const shot = await send('Page.captureScreenshot', { format: 'png' })
if (shot.result && shot.result.data) { writeFileSync('D:/dsh/x-reply-extension/tests/out/no-placeholder.png', Buffer.from(shot.result.data, 'base64')); console.log('shot') }
ws.close(); bws.close(); process.exit(0)
