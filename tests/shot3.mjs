import { writeFileSync } from 'node:fs'
const pages = (await (await fetch('http://127.0.0.1:9222/json/list')).json()).filter((x) => x.type === 'page')
const page = pages.find((t) => /x\.com/.test(t.url))
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })) })
await send('Page.enable')
const s = await send('Page.captureScreenshot', { format: 'png' })
if (s.result && s.result.data) { writeFileSync('D:/dsh/x-reply-extension/tests/out/quick-reply.png', Buffer.from(s.result.data, 'base64')); console.log('saved') }
ws.close(); process.exit(0)
