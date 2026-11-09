/**
 * 复用常驻调试实例（9222）：装插件 → 注入 cookie → 打开 x.com/home
 * 不启动/不关闭浏览器，随用随连。
 */
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const extDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.CDP_PORT || 9222)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const ver = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json()
console.log('browser:', ver.Browser)

// 1) 确保插件已加载（CDP Extensions 域，browser 级）
const bws = new WebSocket(ver.webSocketDebuggerUrl)
await new Promise((res, rej) => { bws.onopen = res; bws.onerror = rej })
let bid = 0; const bp = new Map()
bws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && bp.has(m.id)) { bp.get(m.id)(m); bp.delete(m.id) } }
const bsend = (m, p) => new Promise((res) => { const i = ++bid; bp.set(i, res); bws.send(JSON.stringify({ id: i, method: m, params: p || {} })) })
const r = await bsend('Extensions.loadUnpacked', { path: extDir })
console.log('extension:', (r.result && r.result.id) || JSON.stringify(r.error))

// 2) 页面：cookie + 导航
const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const target = list.find((t) => t.type === 'page')
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })) })
const evalJs = async (expr) => {
  const out = await Promise.race([send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), new Promise((x) => setTimeout(() => x({ t: 1 }), 12000))])
  if (out.t) return undefined
  return out.result && out.result.result ? out.result.result.value : undefined
}
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
for (const c of [{ name: 'auth_token', value: process.env.TWITTER_AUTH_TOKEN }, { name: 'ct0', value: process.env.TWITTER_CT0 }]) {
  if (c.value) await send('Network.setCookie', { name: c.name, value: c.value, domain: '.x.com', path: '/', secure: true, httpOnly: c.name === 'auth_token', sameSite: 'None' })
}
await send('Page.navigate', { url: 'https://x.com/home' })
for (let i = 0; i < 40; i++) { const n = (await evalJs('document.querySelectorAll(\'article[data-testid="tweet"]\').length')) || 0; if (n > 0) break; await sleep(1000) }
const rep = await evalJs('(() => ({ url: location.href, tweets: document.querySelectorAll(\'article[data-testid="tweet"]\').length, buttons: document.querySelectorAll(".xr-btn").length }))()')
console.log('页面:', JSON.stringify(rep))
ws.close(); bws.close()
process.exit(0)
