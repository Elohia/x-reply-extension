/**
 * CDP 实战：接本地已登录的 Edge（默认 profile）+ 加载插件，在真实 x.com 上验证
 * 端口 9334，用完就关。
 */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const extDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(extDir, 'tests', 'out')
mkdirSync(outDir, { recursive: true })

const CANDIDATES = [
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean)
const EDGE = CANDIDATES.find((x) => existsSync(x))
if (!EDGE) { console.log('NO_BROWSER'); process.exit(2) }
console.log('using:', EDGE)
const PORT = Number(process.env.CDP_PORT || 9335)

// 清掉复制来的 profile 上的单例锁，否则 Chrome 会直接退出、CDP 起不来
const profPath = process.env.CHROME_PROFILE || join(outDir, 'profile-chrome')
for (const f of ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'lockfile', 'Default/LOCK', 'Default/lockfile']) {
  try { rmSync(join(profPath, f), { force: true, recursive: true }) } catch {}
}

const child = spawn(EDGE, [
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profPath,
  '--disable-features=Translate',
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--disable-extensions-except=' + extDir,
  '--load-extension=' + extDir,
  '--window-size=1400,950',
  '--proxy-server=' + (process.env.X_PROXY || 'http://127.0.0.1:7890'),
  'https://x.com/home',
], { stdio: 'ignore', detached: false })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function ready() {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/version'); if (r.ok) return await r.json() } catch {}
    await sleep(300)
  }
  throw new Error('CDP 没起来（可能 Edge 已在运行占用了默认 profile）')
}

const ver = await ready()
console.log('browser:', ver.Browser)

let target = null
for (let i = 0; i < 60 && !target; i++) {
  const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json()
  target = list.find((t) => t.type === 'page' && /x\.com/.test(t.url)) || list.find((t) => t.type === 'page')
  if (!target) await sleep(300)
}
if (!target) throw new Error('没有 page target')

const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0
const pending = new Map()
const events = []
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  else if (m.method) events.push(m)
}
const send = (method, params) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params: params || {} })) })
const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.result && r.result.exceptionDetails) return { __err: r.result.exceptionDetails.text }
  return r.result && r.result.result ? r.result.result.value : undefined
}

await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable')

// 复制来的 profile 里 cookie 解不开（Chrome 127+ ABE），这里用本机已有的 auth_token / ct0 注入
const tok = process.env.TWITTER_AUTH_TOKEN || ''
const ct0 = process.env.TWITTER_CT0 || ''
if (tok && ct0) {
  for (const c of [
    { name: 'auth_token', value: tok },
    { name: 'ct0', value: ct0 },
  ]) {
    const r = await send('Network.setCookie', { name: c.name, value: c.value, domain: '.x.com', path: '/', secure: true, httpOnly: c.name === 'auth_token', sameSite: 'None' })
    console.log('setCookie', c.name, r.result && r.result.success !== false ? 'ok' : JSON.stringify(r.result || r.error))
  }
} else {
  console.log('没有 TWITTER_AUTH_TOKEN / TWITTER_CT0，跳过注入（会看到登录页）')
}
await sleep(1500)
await send('Page.navigate', { url: 'https://x.com/home' })
// 等 SPA 水合：轮询到有推文或超时
let waited = 0
for (; waited < 40; waited++) {
  const n = await evalJs('document.querySelectorAll(\'article[data-testid="tweet"]\').length')
  if (n > 0) break
  await sleep(1000)
}
console.log('等待水合 ' + waited + 's')

const report = await evalJs(`(() => {
  const arts = document.querySelectorAll('article[data-testid="tweet"]')
  const btns = document.querySelectorAll('.xr-btn')
  const login = document.querySelector('[data-testid="loginButton"], a[href="/login"]')
  const first = arts[0] ? (arts[0].querySelector('[data-testid="tweetText"]') || {}).innerText : ''
  return {
    url: location.href,
    tweets: arts.length,
    buttons: btns.length,
    loginWall: !!login && arts.length === 0,
    first: (first || '').slice(0, 60),
    hasEditor: !!document.querySelector('[data-testid^="tweetTextarea_"]'),
  }
})()`)
console.log('页面报告:', JSON.stringify(report))

if (report && report.buttons > 0) {
  const open = await evalJs('(() => { const b = document.querySelector(".xr-btn"); if (!b) return "no"; b.click(); const p = document.querySelector(".xr-panel"); return p ? p.querySelectorAll(".xr-item").length : 0 })()')
  console.log('面板草稿数:', open)
  const fill = await evalJs('(async () => { const b = [...document.querySelectorAll(".xr-panel .xr-item button")].find(x => x.textContent.includes("填入")); if (!b) return "no-btn"; b.click(); await new Promise(r => setTimeout(r, 1500)); const ed = document.querySelector("[data-testid^=tweetTextarea_] [contenteditable], [data-testid^=tweetTextarea_][contenteditable]"); return ed ? ed.innerText.slice(0, 80) : "no-editor" })()')
  console.log('真实回复框:', JSON.stringify(fill))
}

const errs = events.filter((e) => e.method === 'Runtime.exceptionThrown').map((e) => (e.params.exceptionDetails && e.params.exceptionDetails.text) || 'exception')
const logErrs = events.filter((e) => e.method === 'Log.entryAdded' && /error/i.test(e.params.entry.level)).map((e) => e.params.entry.text)
console.log('异常:', errs.length ? errs.join(' | ').slice(0, 300) : '无')
console.log('错误日志:', logErrs.length ? logErrs.join(' | ').slice(0, 300) : '无')

const shot = await send('Page.captureScreenshot', { format: 'png' })
if (shot.result && shot.result.data) {
  const p = join(outDir, 'live-x.png')
  writeFileSync(p, Buffer.from(shot.result.data, 'base64'))
  console.log('截图:', p)
}
ws.close()
try { child.kill() } catch {}
process.exit(0)
