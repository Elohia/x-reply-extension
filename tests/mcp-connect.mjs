/**
 * 通过 chrome-devtools-mcp --autoConnect 接入"正在运行的 Chrome"
 * 首次连接 Chrome 会弹授权框，需要用户点「允许」
 */
import { spawn } from 'node:child_process'

const log = (...a) => console.log(...a)
const child = spawn('npx -y chrome-devtools-mcp@1.12.0 --autoConnect', {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true,
  env: { ...process.env, HTTPS_PROXY: 'http://127.0.0.1:7890', HTTP_PROXY: 'http://127.0.0.1:7890' },
  windowsHide: true,
})

let buf = ''
const pending = new Map()
let seq = 0
child.stdout.on('data', (d) => {
  buf += d.toString('utf8')
  let i
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim()
    buf = buf.slice(i + 1)
    if (!line) continue
    let msg
    try { msg = JSON.parse(line) } catch { continue }
    if (msg.id !== undefined && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
    else if (msg.method) log('event:', msg.method)
  }
})
child.stderr.on('data', (d) => log('stderr:', d.toString('utf8').trim().slice(0, 300)))

const rpc = (method, params, ms = 15000) => new Promise((resolve) => {
  const id = ++seq
  pending.set(id, resolve)
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params: params || {} }) + '\n')
  setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ __timeout: true }) } }, ms)
})

const init = await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'xr-debug', version: '0.1' } })
log('initialize:', JSON.stringify(init).slice(0, 200))
child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n')

const list = await rpc('tools/list', {})
const tools = (list.result && list.result.tools) || []
log('tools(' + tools.length + '):', tools.map((t) => t.name).join(', ').slice(0, 500))

// 触发连接：list_pages 会让 Chrome 弹授权
log('calling list_pages（Chrome 会弹授权框，请点允许）…')
const pages = await rpc('tools/call', { name: 'list_pages', arguments: {} }, 120000)
log('list_pages:', JSON.stringify(pages).slice(0, 600))

child.kill()
process.exit(0)
