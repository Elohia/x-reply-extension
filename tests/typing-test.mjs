const port = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pages = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).filter((p) => p.type === 'page')
const page = pages.find((p) => /x\.com/.test(p.url)) || pages[0]
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({}) } }, 12000) })
const ev = async (x) => { const o = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (o.result && o.result.exceptionDetails) return 'exc'; return o.result && o.result.result ? o.result.result.value : o.result }
await send('Runtime.enable'); await send('Page.enable')
console.log('url:', await ev('location.href'))
// 打开一条推文的回复框
const opened = await ev(String.raw`(() => {
  const arts = [...document.querySelectorAll('article[data-testid="tweet"]')];
  if (!arts.length) return 'no tweets';
  const b = arts[0].querySelector('[data-testid="reply"]');
  if (b) b.click();
  return 'clicked';
})()`)
console.log('reply click:', opened)
await sleep(2000)
console.log('editors:', JSON.stringify(await ev('[...document.querySelectorAll(\'[data-testid="tweetTextarea_0"]\')].map(e => ({ vis: !!e.offsetParent, len: (e.textContent||"").length }))')))
console.log('panel exists:', await ev('!!document.querySelector(".xr-panel")'))
console.log('focused:', await ev('document.activeElement ? (document.activeElement.getAttribute("data-testid") || document.activeElement.tagName) : null'))
// 找最上层可见编辑器并聚焦，用 CDP 真打键盘
const focus = await ev(String.raw`(() => {
  const eds = [...document.querySelectorAll('[data-testid="tweetTextarea_0"]')].filter(e => e.offsetParent !== null);
  const e = eds[eds.length-1];
  if (!e) return 'no editor';
  e.focus();
  const r = document.createRange(); r.selectNodeContents(e); r.collapse(false);
  const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  return 'focused';
})()`)
console.log('focus:', focus)
await send('Input.insertText', { text: '手动输入测试' })
await sleep(800)
console.log('after typing:', JSON.stringify(await ev('(() => { const eds=[...document.querySelectorAll(\'[data-testid="tweetTextarea_0"]\')].filter(e=>e.offsetParent!==null); const e=eds[eds.length-1]; return e? (e.textContent||"").slice(0,60) : null })()')))
// 检查是否有我们的元素盖住编辑器
console.log('overlay check:', JSON.stringify(await ev(String.raw`(() => {
  const eds=[...document.querySelectorAll('[data-testid="tweetTextarea_0"]')].filter(e=>e.offsetParent!==null);
  const e=eds[eds.length-1]; if(!e) return 'no editor';
  const r=e.getBoundingClientRect();
  const cx=r.left+r.width/2, cy=r.top+r.height/2;
  const top=document.elementFromPoint(cx, cy);
  return { editorRect:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}, topEl: top ? (top.id || top.className || top.tagName) : null, isInside: top ? e.contains(top) : false };
})()`)))
ws.close(); process.exit(0)
