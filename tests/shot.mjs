import { writeFileSync } from 'node:fs'
const port = 9222
const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const target = list.find((t) => t.type === 'page' && /x\.com/.test(t.url))
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })) })
await send('Page.enable')
const s = await send('Page.captureScreenshot', { format: 'png' })
if (s.result && s.result.data) {
  const p = 'D:/dsh/x-reply-extension/tests/out/live-fixed.png'
  writeFileSync(p, Buffer.from(s.result.data, 'base64'))
  console.log('saved', p)
}
ws.close(); process.exit(0)
