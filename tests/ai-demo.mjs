import { readFileSync } from 'node:fs'
const port = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const key = (readFileSync('F:/dsh-home/.credentials.yaml', 'utf8').match(/DEEPSEEK_API_KEY:\s*(\S+)/) || [])[1]
console.log('key:', key ? key.slice(0, 6) + '…' : 'missing')
const ver = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json()
const bws = new WebSocket(ver.webSocketDebuggerUrl)
await new Promise((r, j) => { bws.onopen = r; bws.onerror = j })
let bid = 0; const bp = new Map()
bws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && bp.has(m.id)) { bp.get(m.id)(m); bp.delete(m.id) } }
const bsend = (m, p) => new Promise((res) => { const i = ++bid; bp.set(i, res); bws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (bp.has(i)) { bp.delete(i); res({}) } }, 15000) })
const created = await bsend('Target.createTarget', { url: 'chrome-extension://hpgkdeocldeeggjgjebbodenebpgfjhk/popup.html' })
const tid = (created.result || {}).targetId
await sleep(1500)
const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const pop = list.find((t) => t.id === tid)
const ws = new WebSocket(pop.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({}) } }, 15000) })
await send('Runtime.enable')
await send('Runtime.evaluate', { expression: 'chrome.storage.local.set({apiKey:' + JSON.stringify(key) + '}); chrome.storage.sync.set({aiEnabled:true, apiBase:"https://api.deepseek.com", model:"deepseek-chat"}); "ok"', awaitPromise: true, returnByValue: true })
console.log('storage set')
await bsend('Target.closeTarget', { targetId: tid })
ws.close(); bws.close()
await sleep(500)

// 回 x.com 测 AI 三条
const pages = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).filter((p) => p.type === 'page')
const page = pages.find((p) => /x\.com/.test(p.url))
const pws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { pws.onopen = r; pws.onerror = j })
let s2 = 0; const p2 = new Map()
pws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && p2.has(m.id)) { p2.get(m.id)(m); p2.delete(m.id) } }
const send2 = (m, p) => new Promise((res) => { const i = ++s2; p2.set(i, res); pws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (p2.has(i)) { p2.delete(i); res({}) } }, 20000) })
const ev = async (x) => { const o = await send2('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (o.result && o.result.exceptionDetails) return 'exc'; return o.result && o.result.result ? o.result.result.value : o.result }
await send2('Runtime.enable'); await send2('Page.enable')
await send2('Page.reload', {})
for (let i = 0; i < 30; i++) { const n = await ev('document.querySelectorAll(\'article[data-testid="tweet"]\').length'); if (n > 1) break; await sleep(900) }
const tgt = await ev(String.raw`(() => {
  const arts = [...document.querySelectorAll('article[data-testid="tweet"]')];
  const art = arts[1];
  const name = ((art.querySelector('[data-testid="User-Name"]')||{}).innerText || '').split('\n')[0];
  const txt = ((art.querySelector('[data-testid="tweetText"]')||{}).innerText || '');
  const btn = art.querySelector('[data-testid="reply"]');
  if (btn) btn.click();
  return { name, txt: txt.slice(0, 60) };
})()`)
console.log('目标:', JSON.stringify(tgt))
await sleep(1500)
await ev('document.getElementById("xr-launcher").click()')
for (let i = 0; i < 30; i++) { await sleep(700); const ok = await ev('!!document.querySelector(".xr-panel .xr-analysis")'); if (ok === true) break }
console.log('AI 结果:', JSON.stringify(await ev('(() => { const p = document.querySelector(".xr-panel"); if (!p) return null; return { sub: (p.querySelector("header span")||{}).textContent, analysis: (p.querySelector(".xr-analysis")||{}).textContent, items: [...p.querySelectorAll(".xr-item textarea")].map(t => t.value), meta: (p.querySelector(".xr-foot span")||{}).textContent } })()')))
pws.close(); process.exit(0)
