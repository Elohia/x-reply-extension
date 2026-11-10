/** 常驻 MCP 守护：只连一次 chrome-devtools-mcp，之后用本机 HTTP 复用 */
import { spawn } from 'node:child_process'
import http from 'node:http'

const PORT = Number(process.env.MCP_PORT || 9777)
const child = spawn('npx -y chrome-devtools-mcp@1.12.0 --autoConnect', {
  stdio: ['pipe', 'pipe', 'pipe'], shell: true,
  env: Object.assign({}, process.env, { HTTPS_PROXY: 'http://127.0.0.1:7890', HTTP_PROXY: 'http://127.0.0.1:7890' }),
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
    let m
    try { m = JSON.parse(line) } catch { continue }
    if (m.id !== undefined && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  }
})
child.stderr.on('data', () => {})
child.on('exit', (code) => { console.log('mcp exited ' + code); process.exit(0) })

const rpc = (method, params, ms) => new Promise((res) => {
  const id = ++seq
  pending.set(id, res)
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: id, method: method, params: params || {} }) + '\n')
  setTimeout(() => { if (pending.has(id)) { pending.delete(id); res({ __timeout: true }) } }, ms || 120000)
})

await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'xr-daemon', version: '1' } })
child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n')

const call = async (name, args) => {
  const r = await rpc('tools/call', { name: name, arguments: args || {} })
  const content = (r.result && r.result.content) || []
  const text = content.map((c) => c.text).join('\n')
  return { ok: !r.__timeout && !(r.result && r.result.isError), text: text || JSON.stringify(r) }
}

http.createServer((req, res) => {
  if (req.method === 'GET') { res.end('ok'); return }
  let body = ''
  req.on('data', (c) => { body += c })
  req.on('end', async () => {
    let out
    try {
      const cmd = JSON.parse(body || '{}')
      if (cmd.name === 'ping') out = { ok: true }
      else out = await call(cmd.name, cmd.args)
    } catch (e) { out = { ok: false, text: 'daemon error: ' + e.message } }
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(out))
  })
}).listen(PORT, '127.0.0.1', () => console.log('daemon listening ' + PORT))
