const port = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const page = list.find((t) => t.type === 'page' && /x\.com/.test(t.url))
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })) })
const evalJs = async (expr) => { const o = await Promise.race([send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), new Promise((x) => setTimeout(() => x({ t: 1 }), 45000))]); if (o.t) return { __timeout: true }; return o.result && o.result.result ? o.result.result.value : o.result }
await send('Page.enable'); await send('Runtime.enable')
await send('Page.reload', {})
for (let i = 0; i < 40; i++) { const n = (await evalJs('document.querySelectorAll(".xr-btn").length')) || 0; if (n > 0) break; await sleep(1000) }
console.log('按钮:', (await evalJs('document.querySelectorAll(".xr-btn").length')))
const out = await evalJs(String.raw`(async () => {
  const b = document.querySelector('.xr-btn');
  b.click();
  for (let i = 0; i < 60; i++) {
    if (document.querySelector('.xr-analysis') || document.querySelectorAll('.xr-panel .xr-item').length) break;
    await new Promise(r => setTimeout(r, 500));
  }
  const panel = document.querySelector('.xr-panel');
  return {
    panel: !!panel,
    text: panel ? panel.innerText.slice(0, 400) : '',
    items: [...document.querySelectorAll('.xr-panel .xr-item')].map(e => ({ angle: (e.querySelector('.xr-angle')||{}).textContent, text: (e.querySelector('textarea')||{}).value })),
  };
})()`)
console.log(JSON.stringify(out, null, 1).slice(0, 1500))
ws.close(); process.exit(0)
