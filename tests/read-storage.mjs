const port = 9222
const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const sw = list.find((t) => t.type === 'service_worker' && String(t.url).includes('hpgkdeocldeeggjgjebbodenebpgfjhk'))
if (!sw) { console.log('no ext sw; targets:', list.map(t=>t.type+':'+String(t.url).slice(0,40)).join(' | ')); process.exit(2) }
const ws = new WebSocket(sw.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({}) } }, 8000) })
const ev = async (x) => { const o = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (o.result && o.result.exceptionDetails) return 'exc'; return o.result && o.result.result ? o.result.result.value : o.result }
await send('Runtime.enable')
const out = await ev('(async () => { const s = await chrome.storage.sync.get(null); const l = await chrome.storage.local.get(null); return { sync: s, hasKey: !!l.apiKey, keyLen: (l.apiKey||"").length, used: l.used || 0 } })()')
console.log(JSON.stringify(out, null, 1))
ws.close(); process.exit(0)
