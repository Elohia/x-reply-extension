const port = Number(process.env.CDP_PORT || 9222)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const target = list.find((t) => t.type === 'page' && /x\.com/.test(t.url)) || list.find((t) => t.type === 'page')
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })) })
const evalJs = async (expr) => {
  const out = await Promise.race([send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), new Promise((x) => setTimeout(() => x({ t: 1 }), 20000))])
  if (out.t) return { __timeout: true }
  return out.result && out.result.result ? out.result.result.value : out.result
}
await send('Runtime.enable')
await send('Page.enable')
await sleep(500)
const out = await evalJs(String.raw`(async () => {
  const btn = document.querySelector('.xr-btn');
  if (!btn) return { error: 'no .xr-btn（插件没注入）' };
  btn.click();
  await new Promise(r => setTimeout(r, 400));
  const ta = document.querySelector('.xr-panel .xr-item textarea');
  const draft = ta ? ta.value : '';
  const replyBtn = document.querySelector('article[data-testid="tweet"] [data-testid="reply"]');
  if (replyBtn) replyBtn.click();
  await new Promise(r => setTimeout(r, 1500));
  const fill = [...document.querySelectorAll('.xr-panel .xr-item button')].find(b => b.textContent.includes('填入'));
  if (!fill) return { error: 'no fill button', draft };
  fill.click();
  await new Promise(r => setTimeout(r, 1800));
  const ed = document.querySelector('[data-testid="tweetTextarea_0"]');
  const t = ed ? (ed.textContent || '') : '';
  return { draftLen: draft.length, editorLen: t.length, hits: t.split(draft).length - 1, text: t.slice(0, 80) };
})()`)
console.log('插件填入复验:', JSON.stringify(out))
ws.close()
process.exit(0)
