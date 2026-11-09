const port = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const page = list.find((t) => t.type === 'page' && /x\.com/.test(t.url))
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })) })
const evalJs = async (expr) => { const o = await Promise.race([send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), new Promise((x) => setTimeout(() => x({ t: 1 }), 40000))]); if (o.t) return { __timeout: true }; return o.result && o.result.result ? o.result.result.value : o.result }
await send('Runtime.enable')
const out = await evalJs(String.raw`(async () => {
  document.querySelectorAll('.xr-panel').forEach(e => e.remove());
  const b = document.querySelector('.xr-btn');
  if (!b) return { error: 'no btn' };
  b.click();
  await new Promise(r => setTimeout(r, 2500));
  const panel = document.querySelector('.xr-panel');
  const loading = document.querySelector('.xr-loading');
  // 直接问后台
  const res = await new Promise((resolve) => {
    try { chrome.runtime.sendMessage({ type: 'ai:gen', tweet: '用 3 天把 120 万的表压到 8 秒', author: '@t' }, resolve) }
    catch (e) { resolve({ ok: false, error: 'sendMessage 抛错: ' + e.message }) }
  });
  return { panel: !!panel, loading: loading ? loading.textContent : null, panelText: panel ? panel.innerText.slice(0, 200) : '', bg: res };
})()`)
console.log(JSON.stringify(out, null, 1).slice(0, 2000))
ws.close(); process.exit(0)
