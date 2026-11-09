/**
 * CDP 附加 + 调试：Chrome 137+ 用 Extensions.loadUnpacked 加载未打包插件
 * 流程：连 browser target → loadUnpacked → 开 x.com → 注入 cookie → 等水合 → 验按钮/面板/填入
 */
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const extDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(extDir, 'tests', 'out')
mkdirSync(outDir, { recursive: true })
const prof = process.env.CHROME_PROFILE || join(outDir, 'chrome-profile')
const port = Number(process.env.CDP_PORT || 9351)
const CHROME = process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
if (!existsSync(CHROME)) { console.log('NO_CHROME'); process.exit(2) }
for (const f of ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'lockfile', 'Default/LOCK', 'Default/lockfile']) {
  try { rmSync(join(prof, f), { force: true, recursive: true }) } catch {}
}

const child = spawn(CHROME, [
  '--remote-debugging-port=' + port,
  '--user-data-dir=' + prof,
  '--proxy-server=' + (process.env.X_PROXY || 'http://127.0.0.1:7890'),
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1400,950',
  'about:blank',
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ver = null
for (let i = 0; i < 80; i++) {
  try { const r = await fetch('http://127.0.0.1:' + port + '/json/version'); if (r.ok) { ver = await r.json(); break } } catch {}
  await sleep(300)
}
if (!ver) { console.log('CDP 没起来'); process.exit(2) }
console.log('browser:', ver.Browser)

// —— browser 级连接：装插件 ——
const bws = new WebSocket(ver.webSocketDebuggerUrl)
await new Promise((res, rej) => { bws.onopen = res; bws.onerror = rej })
let bid = 0
const bpend = new Map()
bws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && bpend.has(m.id)) { bpend.get(m.id)(m); bpend.delete(m.id) } }
const bsend = (method, params) => new Promise((res) => { const i = ++bid; bpend.set(i, res); bws.send(JSON.stringify({ id: i, method, params: params || {} })) })

let extId = ''
try {
  const r = await bsend('Extensions.loadUnpacked', { path: extDir })
  extId = (r.result && r.result.id) || ''
  console.log('loadUnpacked:', extId || JSON.stringify(r.error || r.result))
} catch (e) { console.log('loadUnpacked 异常:', e.message) }

// —— page 级连接 ——
let target = null
for (let i = 0; i < 40 && !target; i++) {
  const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
  target = list.find((t) => t.type === 'page')
  if (!target) await sleep(300)
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0
const pend = new Map()
const events = []
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
  else if (m.method) events.push(m)
}
const send = (method, params) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) })
const evalJs = async (expression) => {
  const r = await Promise.race([
    send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }),
    new Promise((res) => setTimeout(() => res({ __timeout: true }), 8000)),
  ])
  if (r.__timeout) return undefined
  return r.result && r.result.result ? r.result.result.value : undefined
}

await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable')

const tok = process.env.TWITTER_AUTH_TOKEN || ''
const ct0 = process.env.TWITTER_CT0 || ''
if (tok && ct0) {
  for (const c of [{ name: 'auth_token', value: tok }, { name: 'ct0', value: ct0 }]) {
    const r = await send('Network.setCookie', { name: c.name, value: c.value, domain: '.x.com', path: '/', secure: true, httpOnly: c.name === 'auth_token', sameSite: 'None' })
    console.log('cookie', c.name, r.result && r.result.success !== false ? 'ok' : 'fail')
  }
}

await send('Page.navigate', { url: 'https://x.com/home' })
await sleep(4000)
let waited = 0
for (; waited < 40; waited++) {
  const n = (await evalJs('document.querySelectorAll(\'article[data-testid="tweet"]\').length')) || 0
  if (n > 0) break
  await sleep(1000)
}

const before = await evalJs('(() => ({ url: location.href, tweets: document.querySelectorAll(\'article[data-testid="tweet"]\').length, buttons: document.querySelectorAll(".xr-btn").length }))()')
console.log('附加前:', JSON.stringify(before))

// 插件是后装的：刷新一次让 content script 进场
await send('Page.reload', {})
await sleep(6000)
const after = await evalJs('(() => ({ url: location.href, tweets: document.querySelectorAll(\'article[data-testid="tweet"]\').length, buttons: document.querySelectorAll(".xr-btn").length }))()')
console.log('刷新后:', JSON.stringify(after))

let panel = 0
let filled = ''
let firstText = ''
if (after && after.buttons > 0) {
  firstText = await evalJs('(() => { const a = document.querySelector(\'article[data-testid="tweet"]\'); const t = a && a.querySelector(\'[data-testid="tweetText"]\'); return t ? t.innerText.slice(0,50) : "" })()')
  panel = await evalJs('(() => { const b = document.querySelector(".xr-btn"); b.click(); const p = document.querySelector(".xr-panel"); return p ? p.querySelectorAll(".xr-item").length : 0 })()')
  filled = await evalJs('(async () => { const b = [...document.querySelectorAll(".xr-panel .xr-item button")].find(x => x.textContent.includes("填入")); if (!b) return "no-btn"; const el = document.querySelector(\'[data-testid^="tweetTextarea_"]\'); if (el) el.click(); await new Promise(r => setTimeout(r, 1200)); b.click(); await new Promise(r => setTimeout(r, 1500)); return document.querySelector(\'[data-testid^="tweetTextarea_"]\').innerText.slice(0,60) })()')
}
console.log('第一条推文:', JSON.stringify(firstText))
console.log('面板草稿数:', panel)
const editors = await evalJs('(async () => { await new Promise(r => setTimeout(r, 300)); return [...document.querySelectorAll(\'[data-testid^="tweetTextarea_"]\')].map(e => ({ testid: e.getAttribute("data-testid"), visible: e.offsetParent !== null, text: e.innerText })) })()')
console.log('所有编辑器:', JSON.stringify(editors))
console.log('填入结果:', JSON.stringify(filled))

const errs = events.filter((e) => e.method === 'Runtime.exceptionThrown').map((e) => e.params.exceptionDetails && e.params.exceptionDetails.text)
console.log('页面异常:', errs.length ? errs.join(' | ').slice(0, 200) : '无')

const shot = await send('Page.captureScreenshot', { format: 'png' })
if (shot.result && shot.result.data) {
  const p = join(outDir, 'live-attached.png')
  writeFileSync(p, Buffer.from(shot.result.data, 'base64'))
  console.log('截图:', p)
}
ws.close(); bws.close()
try { child.kill() } catch {}
process.exit(0)
