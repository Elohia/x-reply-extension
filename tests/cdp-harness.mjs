/**
 * CDP 调试台：用真实 Chrome/Edge 加载插件，在受控的 x.com 页面里跑一遍
 * ---------------------------------------------------------------
 * 1) --load-extension 把插件装进临时 profile
 * 2) Fetch 拦截 https://x.com/mock ，返回一份仿 X 的 DOM（不碰你的真实账号）
 * 3) CDP 检查：.xr-btn 是否注入 → 点开面板 → 点「填入回复框」→ 读 textarea 的值
 * 4) 收集 console 报错 + 截图
 */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const extDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(extDir, 'tests', 'out')
mkdirSync(outDir, { recursive: true })

const CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
]
const exe = CANDIDATES.find((p) => existsSync(p))
if (!exe) { console.log('NO_BROWSER'); process.exit(2) }

const profile = join(outDir, 'profile')
const PORT = 9333

const MOCK = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>X / Home</title>
<style>
 body{margin:0;background:#000;color:#e7e9ea;font:15px/1.5 -apple-system,'Segoe UI',sans-serif}
 .col{max-width:600px;margin:0 auto;border-left:1px solid #2f3336;border-right:1px solid #2f3336;min-height:100vh}
 article{padding:12px 16px;border-bottom:1px solid #2f3336}
 .row{display:flex;gap:10px;align-items:center;color:#71767b;font-size:15px}
 .row .n{color:#e7e9ea;font-weight:700}
 .tx{margin:6px 0 10px;white-space:pre-wrap}
 .grp{display:flex;gap:36px}
 .grp button{background:none;border:0;color:#71767b;cursor:pointer;display:flex;gap:6px;align-items:center}
 #editorWrap{display:none;padding:12px 16px;border-bottom:1px solid #2f3336}
 #editorWrap.on{display:block}
 [contenteditable]{min-height:52px;border:1px solid #2f3336;border-radius:12px;padding:10px;outline:none}
</style></head><body>
<div class="col">
  <article data-testid="tweet">
    <div class="row"><div class="n" data-testid="User-Name">阿哲 <span>@azhe_dev</span></div></div>
    <div class="tx" data-testid="tweetText">用 3 天把 120 万的表压到 8 秒，说说我怎么做的</div>
    <div class="grp" role="group">
      <button data-testid="reply" id="replyBtn">回复 12</button>
      <button>转推</button><button>喜欢 88</button>
    </div>
  </article>
  <article data-testid="tweet">
    <div class="row"><div class="n" data-testid="User-Name">小林 <span>@lin_ai</span></div></div>
    <div class="tx" data-testid="tweetText">有没有人知道 DSH 插件怎么本地调试？试了 3 次都不行</div>
    <div class="grp" role="group">
      <button data-testid="reply">回复 4</button><button>转推</button><button>喜欢 9</button>
    </div>
  </article>
  <div id="editorWrap">
    <div contenteditable="true" data-testid="tweetTextarea_0" role="textbox" aria-label="回复"></div>
  </div>
</div>
<script>
  document.querySelectorAll('[data-testid="reply"]').forEach(function(b){
    b.addEventListener('click', function(){ document.getElementById('editorWrap').classList.add('on') })
  })
</script>
</body></html>`

const child = spawn(exe, [
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--disable-extensions-except=' + extDir,
  '--load-extension=' + extDir,
  '--window-size=1280,900',
  'about:blank',
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function jsonVersion() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/version')
      if (r.ok) return await r.json()
    } catch { /* 还没起来 */ }
    await sleep(250)
  }
  throw new Error('CDP 没起来')
}

const ver = await jsonVersion()
console.log('browser:', ver.Browser)

// 拿一个 page target
let pageWs = null
for (let i = 0; i < 40 && !pageWs; i++) {
  const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json()
  const page = list.find((t) => t.type === 'page')
  if (page) pageWs = page.webSocketDebuggerUrl
  else await sleep(250)
}
if (!pageWs) throw new Error('没有 page target')

const ws = new WebSocket(pageWs)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0
const pending = new Map()
const events = []
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  else if (m.method) events.push(m)
}
function send(method, params) {
  const id = ++seq
  return new Promise((res) => { pending.set(id, res); ws.send(JSON.stringify({ id, method, params: params || {} })) })
}
const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  return r.result && r.result.result ? r.result.result.value : undefined
}

await send('Page.enable')
await send('Runtime.enable')
await send('Log.enable')
await send('Fetch.enable', { patterns: [{ urlPattern: 'https://x.com/mock*', requestStage: 'Request' }] })

// 拦截 mock 页面
ws.addEventListener('message', async (ev) => {
  const m = JSON.parse(ev.data)
  if (m.method === 'Fetch.requestPaused') {
    const { requestId, request } = m.params
    if (request.url.startsWith('https://x.com/mock')) {
      await send('Fetch.fulfillRequest', {
        requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }],
        body: Buffer.from(MOCK, 'utf8').toString('base64'),
      })
    } else {
      await send('Fetch.continueRequest', { requestId })
    }
  }
})

await send('Page.navigate', { url: 'https://x.com/mock' })
await sleep(2500)

const btnCount = await evalJs('document.querySelectorAll(".xr-btn").length')
console.log('注入按钮数:', btnCount)

const opened = await evalJs('(() => { const b = document.querySelector(".xr-btn"); if (!b) return "no-btn"; b.click(); return document.querySelectorAll(".xr-panel .xr-item").length })()')
console.log('面板草稿数:', opened)

const draft0 = await evalJs('(() => { const t = document.querySelector(".xr-panel .xr-item textarea"); return t ? t.value : "" })()')
console.log('第一条草稿:', draft0)

const filled = await evalJs('(async () => { const btns = [...document.querySelectorAll(".xr-panel .xr-item button")].filter(b => b.textContent.includes("填入")); if (!btns.length) return "no-fill-btn"; btns[0].click(); await new Promise(r => setTimeout(r, 1200)); const ed = document.querySelector("#editorWrap [contenteditable]"); return ed ? ed.innerText : "no-editor" })()')
console.log('回复框内容:', JSON.stringify(filled))

const errors = events
  .filter((e) => e.method === 'Log.entryAdded' || (e.method === 'Runtime.exceptionThrown'))
  .map((e) => e.method === 'Log.entryAdded' ? (e.params.entry.level + ': ' + e.params.entry.text) : ('exception: ' + (e.params.exceptionDetails && e.params.exceptionDetails.text)))
  .filter((t) => !/favicon|net::ERR/i.test(t))
console.log('控制台问题:', errors.length ? errors.join(' | ').slice(0, 400) : '无')

const shot = await send('Page.captureScreenshot', { format: 'png' })
if (shot.result && shot.result.data) {
  const p = join(outDir, 'cdp-panel.png')
  writeFileSync(p, Buffer.from(shot.result.data, 'base64'))
  console.log('截图:', p)
}

ws.close()
try { child.kill() } catch { /* 已退出 */ }
process.exit(0)
