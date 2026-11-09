/**
 * 在常驻 9222 实例上对比两种写入方式（都用**真正的 contenteditable**：data-testid="tweetTextarea_0"）
 */
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
  const out = await Promise.race([send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), new Promise((x) => setTimeout(() => x({ t: 1 }), 15000))])
  if (out.t) return { __timeout: true }
  return out.result && out.result.result ? out.result.result.value : out.result && out.result.exceptionDetails
}
await send('Runtime.enable')

const code = String.raw`(async () => {
  const MX = 'MX内容一';
  const report = {};
  const inner = () => document.querySelector('[data-testid="tweetTextarea_0"]');
  const clear = (el) => { el.focus(); document.execCommand('selectAll'); document.execCommand('delete'); };
  const openReply = async () => {
    const b = document.querySelector('article[data-testid="tweet"] [data-testid="reply"]');
    if (b) b.click();
    await new Promise(r => setTimeout(r, 1200));
  };
  await openReply();
  let ed = inner();
  if (!ed) return { error: 'no editor' };

  // A: execCommand（不 selectAll，直接聚焦后在末尾写）
  clear(ed); ed.focus();
  const rangeA = document.createRange(); rangeA.selectNodeContents(ed); rangeA.collapse(false);
  const selA = window.getSelection(); selA.removeAllRanges(); selA.addRange(rangeA);
  let okA = false; try { okA = document.execCommand('insertText', false, 'A' + MX) } catch {}
  await new Promise(r => setTimeout(r, 400));
  report.A = { ret: okA, len: (inner().textContent || '').length, text: (inner().textContent || '').slice(0, 40) };

  // B: beforeinput 打到真正的 contenteditable
  ed = inner(); clear(ed); ed.focus();
  ed.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: 'B' + MX, bubbles: true, cancelable: true, composed: true }));
  await new Promise(r => setTimeout(r, 400));
  report.B = { len: (inner().textContent || '').length, text: (inner().textContent || '').slice(0, 40) };

  // C: paste 事件
  ed = inner(); clear(ed); ed.focus();
  const dt = new DataTransfer(); dt.setData('text/plain', 'C' + MX);
  ed.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 400));
  report.C = { len: (inner().textContent || '').length, text: (inner().textContent || '').slice(0, 40) };

  // D: textInput 事件
  ed = inner(); clear(ed); ed.focus();
  ed.dispatchEvent(new InputEvent('textInput', { inputType: 'insertText', data: 'D' + MX, bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 400));
  report.D = { len: (inner().textContent || '').length, text: (inner().textContent || '').slice(0, 40) };
  return report;
})()`

const out = await evalJs(code)
console.log('结果:', JSON.stringify(out, null, 1))
ws.close()
process.exit(0)
