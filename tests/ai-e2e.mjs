/**
 * 端到端：设置 API Key → 真实时间线点 R → 看 AI 分析 + 3 条草稿 → 填入
 * 连常驻 9222，不启动/不关闭浏览器。
 */
import { readFileSync } from 'node:fs'
const port = 9222
const key = (readFileSync('F:/dsh-home/.credentials.yaml', 'utf8').match(/DEEPSEEK_API_KEY:\s*(\S+)/) || [])[1]
if (!key) { console.log('no key'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const ver = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json()
const bws = new WebSocket(ver.webSocketDebuggerUrl)
await new Promise((res, rej) => { bws.onopen = res; bws.onerror = rej })
let bid = 0; const bp = new Map()
bws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && bp.has(m.id)) { bp.get(m.id)(m); bp.delete(m.id) } }
const bsend = (m, p) => new Promise((res) => { const i = ++bid; bp.set(i, res); bws.send(JSON.stringify({ id: i, method: m, params: p || {} })) })
const ext = await bsend('Extensions.loadUnpacked', { path: 'D:/dsh/x-reply-extension' })
const extId = (ext.result && ext.result.id) || ''
console.log('extension:', extId || JSON.stringify(ext.error))

// 1) 打开扩展页设置 key（扩展页有 chrome.storage）
const created = await bsend('Target.createTarget', { url: 'chrome-extension://' + extId + '/popup.html' })
const targetId = created.result && created.result.targetId
for (let i = 0; i < 20; i++) { const l = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json(); if (l.some((t) => t.id === targetId)) break; await sleep(200) }
const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const popup = list.find((t) => t.id === targetId)
const pws = new WebSocket(popup.webSocketDebuggerUrl)
await new Promise((res, rej) => { pws.onopen = res; pws.onerror = rej })
let pid2 = 0; const pp = new Map()
pws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pp.has(m.id)) { pp.get(m.id)(m); pp.delete(m.id) } }
const psend = (m, p) => new Promise((res) => { const i = ++pid2; pp.set(i, res); pws.send(JSON.stringify({ id: i, method: m, params: p || {} })) })
await psend('Runtime.enable')
const setRes = await psend('Runtime.evaluate', {
  expression: 'chrome.storage.local.set({apiKey:' + JSON.stringify(key) + '}); chrome.storage.sync.set({aiEnabled:true, apiBase:"https://api.deepseek.com", model:"deepseek-chat"}); "ok"',
  awaitPromise: true, returnByValue: true,
})
console.log('设置:', setRes.result && setRes.result.result && setRes.result.result.value)
await bsend('Target.closeTarget', { targetId })
pws.close()

// 2) 到 x.com 上点 R
const l2 = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const page = l2.find((t) => t.type === 'page' && /x\.com/.test(t.url))
if (!page) { console.log('no x.com page'); process.exit(3) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })) })
const evalJs = async (expr) => {
  const o = await Promise.race([send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), new Promise((x) => setTimeout(() => x({ t: 1 }), 60000))])
  if (o.t) return { __timeout: true }
  return o.result && o.result.result ? o.result.result.value : o.result
}
await send('Runtime.enable')
await sleep(800)
const out = await evalJs(String.raw`(async () => {
  const btns = document.querySelectorAll('.xr-btn');
  if (!btns.length) return { error: '没有 R 按钮（插件没加载？）', tweets: document.querySelectorAll('article[data-testid="tweet"]').length };
  btns[0].click();
  // 等 AI 回来（最多 30s）
  for (let i = 0; i < 60; i++) {
    const ana = document.querySelector('.xr-analysis');
    const items = document.querySelectorAll('.xr-panel .xr-item');
    if (ana || items.length) break;
    await new Promise(r => setTimeout(r, 500));
  }
  const ana = document.querySelector('.xr-analysis');
  const items = [...document.querySelectorAll('.xr-panel .xr-item')].map(el => ({
    angle: (el.querySelector('.xr-angle') || {}).textContent || '',
    text: (el.querySelector('textarea') || {}).value || '',
  }));
  const foot = (document.querySelector('.xr-panel .xr-foot span') || {}).textContent || '';
  return { analysis: ana ? ana.textContent : '', items, meta: foot };
})()`)
console.log(JSON.stringify(out, null, 1))
ws.close(); bws.close()
process.exit(0)
