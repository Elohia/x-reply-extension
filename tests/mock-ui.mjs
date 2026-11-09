/**
 * 免登录 UI 验收：mock x.com 页 → 右侧悬浮组 / 面板 / 一键回复 / 回复栏工具条
 * 用 9222 常驻实例，Fetch 拦截 https://x.com/mock 返回仿 X 的 DOM。
 */
const port = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const HTML = `<!doctype html><meta charset="utf-8"><title>X / Home</title>
<style>body{margin:0;background:#000;color:#e7e9ea;font:15px/1.5 -apple-system,'Segoe UI',sans-serif}
.col{max-width:600px;margin:0 auto}article{padding:12px 16px;border-bottom:1px solid #2f3336}
.tx{margin:6px 0 10px;white-space:pre-wrap}.grp{display:flex;gap:36px}
.grp button{background:none;border:0;color:#71767b;cursor:pointer}
#wrap{display:none;padding:12px 16px}#wrap.on{display:block}
[contenteditable]{min-height:52px;border:1px solid #2f3336;border-radius:12px;padding:10px;outline:none}</style>
<div class="col">
<article data-testid="tweet"><div data-testid="User-Name">阿哲 @azhe_dev</div>
<div class="tx" data-testid="tweetText">用 3 天把 120 万的表压到 8 秒，说说我怎么做的</div>
<div class="grp" role="group"><button data-testid="reply">回复 12</button><button>转推</button><button>喜欢 88</button></div></article>
<article data-testid="tweet"><div data-testid="User-Name">小林 @lin_ai</div>
<div class="tx" data-testid="tweetText">上线一周，注册转化 4.2%，但没人说话</div>
<div class="grp" role="group"><button data-testid="reply">回复 4</button><button>转推</button><button>喜欢 9</button></div></article>
<div id="wrap"><div contenteditable="true" data-testid="tweetTextarea_0" role="textbox"></div></div>
</div>
<script>document.querySelectorAll('[data-testid="reply"]').forEach(b=>b.addEventListener('click',()=>document.getElementById('wrap').classList.add('on')))</script>`

const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const page = list.find((t) => t.type === 'page' && /x\.com/.test(t.url))
if (!page) { console.log('no x.com tab'); process.exit(2) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })) })
const evalJs = async (expr) => {
  const o = await Promise.race([send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), new Promise((x) => setTimeout(() => x({ t: 1 }), 30000))])
  if (o.t) return { __timeout: true }
  if (o.result && o.result.exceptionDetails) return { __error: o.result.exceptionDetails.exception && o.result.exceptionDetails.exception.description || o.result.exceptionDetails.text }
  return o.result && o.result.result ? o.result.result.value : o.result
}
await send('Page.enable'); await send('Runtime.enable')
await send('Fetch.enable', { patterns: [{ urlPattern: 'https://x.com/mock*', requestStage: 'Request' }] })
ws.addEventListener('message', async (e) => {
  const m = JSON.parse(e.data)
  if (m.method === 'Fetch.requestPaused') {
    const { requestId, request } = m.params
    if (request.url.startsWith('https://x.com/mock')) {
      await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }], body: Buffer.from(HTML, 'utf8').toString('base64') })
    } else { await send('Fetch.continueRequest', { requestId }) }
  }
})
await send('Page.navigate', { url: 'https://x.com/mock' })
for (let i = 0; i < 30; i++) { const n = await evalJs('document.querySelectorAll(".xr-btn").length'); if (n > 0) break; await sleep(500) }

const out = await evalJs(String.raw`(async () => {
  const art = document.querySelector('article[data-testid="tweet"]');
  const r = { buttons: document.querySelectorAll('.xr-btn').length };
  art.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  await new Promise(x => setTimeout(x, 250));
  r.rail = !!document.querySelector('.xr-rail');
  r.railButtons = [...document.querySelectorAll('.xr-rail-btn')].map(b => b.textContent);

  // 一键回复（走测试钩子，等价于点 ⚡）
  art.dispatchEvent(new CustomEvent('xr:quick', { bubbles: true }));
  await new Promise(x => setTimeout(x, 7000));
  r.hook = document.documentElement.dataset.xrQuick || 'none';
  const ed = document.querySelector('[data-testid="tweetTextarea_0"]');
  r.editorVisible = ed ? !!ed.offsetParent : false;
  r.editorLen = ed ? (ed.textContent || '').length : 0;
  r.editorText = ed ? (ed.textContent || '').slice(0, 60) : null;
  r.bar = !!document.querySelector('.xr-bar');
  r.chips = [...document.querySelectorAll('.xr-chip')].map(c => c.textContent);

  // 点第二个候选换一条
  const chips = [...document.querySelectorAll('.xr-chip')].filter(c => !c.classList.contains('xr-chip-ghost'));
  if (chips[1]) { chips[1].click(); await new Promise(x => setTimeout(x, 700)); }
  r.afterSwapLen = ed ? (ed.textContent || '').length : 0;
  r.afterSwap = ed ? (ed.textContent || '').slice(0, 60) : null;
  return r;
})()`)
console.log(JSON.stringify(out, null, 1).slice(0, 2200))
await send('Fetch.disable')
ws.close(); process.exit(0)
