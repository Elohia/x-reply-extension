import { writeFileSync } from 'node:fs'
const list = await (await fetch('http://127.0.0.1:9222/json/list')).json()
const page = list.find((t) => t.type === 'page' && /x\.com/.test(t.url))
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })) })
await send('Page.enable')
const s = await send('Page.captureScreenshot', { format: 'png' })
if (s.result && s.result.data) { writeFileSync('D:/dsh/x-reply-extension/tests/out/ai-panel.png', Buffer.from(s.result.data, 'base64')); console.log('ok') }
ws.close(); process.exit(0)
