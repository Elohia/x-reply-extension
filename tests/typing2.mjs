const port = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pages = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).filter((p) => p.type === 'page')
const page = pages.find((p) => /x\.com/.test(p.url))
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({}) } }, 12000) })
const ev = async (x) => { const o = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (o.result && o.result.exceptionDetails) return 'exc'; return o.result && o.result.result ? o.result.result.value : o.result }
await send('Runtime.enable')
// 面板与编辑器的位置关系
console.log('layout:', JSON.stringify(await ev(String.raw`(() => {
  const p = document.querySelector('.xr-panel');
  const eds=[...document.querySelectorAll('[data-testid="tweetTextarea_0"]')].filter(e=>e.offsetParent!==null);
  const e=eds[eds.length-1];
  const pr = p ? p.getBoundingClientRect() : null;
  const er = e ? e.getBoundingClientRect() : null;
  const overlap = pr && er ? !(pr.right < er.left || pr.left > er.right || pr.bottom < er.top || pr.top > er.bottom) : null;
  return { panel: pr ? {x:Math.round(pr.x),y:Math.round(pr.y),w:Math.round(pr.width),h:Math.round(pr.height)} : null, editor: er ? {x:Math.round(er.x),y:Math.round(er.y),w:Math.round(er.width),h:Math.round(er.height)} : null, overlap };
})()`)))
// 真实键盘事件测试
const f = await ev(String.raw`(() => { const eds=[...document.querySelectorAll('[data-testid="tweetTextarea_0"]')].filter(e=>e.offsetParent!==null); const e=eds[eds.length-1]; if(!e) return 'no editor'; e.focus(); return document.activeElement === e ? 'focused' : ('active=' + document.activeElement.getAttribute('data-testid')); })()`)
console.log('focus:', f)
await send('Input.dispatchKeyEvent', { type: 'keyDown', text: '你', key: '你', windowsVirtualKeyCode: 0 })
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: '你' })
await sleep(600)
console.log('after key:', JSON.stringify(await ev('(() => { const eds=[...document.querySelectorAll(\'[data-testid="tweetTextarea_0"]\')].filter(e=>e.offsetParent!==null); const e=eds[eds.length-1]; return e ? (e.textContent||"").slice(0,40) : null })()')))
console.log('panel open:', await ev('!!document.querySelector(".xr-panel")'), 'bar:', await ev('!!document.querySelector(".xr-bar")'))
ws.close(); process.exit(0)
