const port = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ver = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json()
const bws = new WebSocket(ver.webSocketDebuggerUrl)
await new Promise((r, j) => { bws.onopen = r; bws.onerror = j })
let bid = 0; const bp = new Map()
bws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && bp.has(m.id)) { bp.get(m.id)(m); bp.delete(m.id) } }
const bsend = (m, p) => new Promise((res) => { const i = ++bid; bp.set(i, res); bws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (bp.has(i)) { bp.delete(i); res({}) } }, 12000) })
console.log('reload ext:', JSON.stringify((await bsend('Extensions.loadUnpacked', { path: 'D:/dsh/x-reply-extension' })).result))
await sleep(800)
const pages = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).filter((p) => p.type === 'page')
const page = pages.find((p) => /x\.com\/home/.test(p.url)) || pages.find((p) => /x\.com/.test(p.url))
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({}) } }, 12000) })
const ev = async (x) => { const o = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (o.result && o.result.exceptionDetails) return 'exc:' + ((o.result.exceptionDetails.exception || {}).description || '').slice(0, 100); return o.result && o.result.result ? o.result.result.value : o.result }
await send('Page.enable'); await send('Runtime.enable')
await send('Page.reload', {})
for (let i = 0; i < 30; i++) { const n = await ev('document.querySelectorAll(\'article[data-testid="tweet"]\').length'); if (n > 1) break; await sleep(900) }
console.log('tweets:', await ev('document.querySelectorAll(\'article[data-testid="tweet"]\').length'))
// 模拟用户：点开第 2 条推文的回复
const who = await ev(String.raw`(() => {
  const arts = [...document.querySelectorAll('article[data-testid="tweet"]')];
  const art = arts[1];
  const name = (art.querySelector('[data-testid="User-Name"]')||{}).innerText || '';
  const txt = (art.querySelector('[data-testid="tweetText"]')||{}).innerText || '';
  const btn = art.querySelector('[data-testid="reply"]');
  if (btn) btn.click();
  return { name: name.split('\n')[0], txt: txt.slice(0, 40) };
})()`)
console.log('点了回复的推文:', JSON.stringify(who))
await sleep(1500)
await ev('document.getElementById("xr-launcher").click()')
await sleep(900)
console.log('面板:', JSON.stringify(await ev('(() => { const p = document.querySelector(".xr-panel"); if (!p) return null; return { sub: (p.querySelector("header span")||{}).textContent, orig: (p.querySelector(".xr-orig")||{}).textContent.slice(0,40), items: p.querySelectorAll(".xr-item").length, first: (p.querySelector(".xr-item textarea")||{}).value } })()')))
const { writeFileSync } = await import('node:fs')
const shot = await send('Page.captureScreenshot', { format: 'png' })
if (shot.result && shot.result.data) { writeFileSync('D:/dsh/x-reply-extension/tests/out/track-target.png', Buffer.from(shot.result.data, 'base64')); console.log('shot') }
ws.close(); bws.close(); process.exit(0)
