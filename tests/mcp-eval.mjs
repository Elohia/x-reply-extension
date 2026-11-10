/**
 * 通过 chrome-devtools-mcp 操作正在运行的 Chrome
 * 用法：node tests/mcp-eval.mjs "<页面URL关键字>" "<JS表达式>"
 */
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
let [urlKey, expr] = process.argv.slice(2)
if (expr && expr.startsWith('file:')) expr = readFileSync(expr.slice(5), 'utf8')
const child = spawn('npx -y chrome-devtools-mcp@1.12.0 --autoConnect', {
  stdio: ['pipe', 'pipe', 'pipe'], shell: true,
  env: { ...process.env, HTTPS_PROXY: 'http://127.0.0.1:7890', HTTP_PROXY: 'http://127.0.0.1:7890' },
  windowsHide: true,
})
let buf = ''; const pending = new Map(); let seq = 0
child.stdout.on('data', (d) => {
  buf += d.toString('utf8'); let i
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1)
    if (!line) continue
    let m; try { m = JSON.parse(line) } catch { continue }
    if (m.id !== undefined && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  }
})
child.stderr.on('data', () => {})
const rpc = (method, params, ms = 60000) => new Promise((res) => {
  const id = ++seq; pending.set(id, res)
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params: params || {} }) + '\n')
  setTimeout(() => { if (pending.has(id)) { pending.delete(id); res({ __timeout: true }) } }, ms)
})
await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'xr', version: '1' } })
child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n')

const pages = await rpc('tools/call', { name: 'list_pages', arguments: {} })
const text = (pages.result && pages.result.content && pages.result.content[0] && pages.result.content[0].text) || ''
const lines = text.split('\n').filter((l) => /^\d+:/.test(l.trim()))
const idx = lines.findIndex((l) => l.includes(urlKey))
if (idx < 0) { console.log('没找到页面：', urlKey, '\n', lines.join('\n')); child.kill(); process.exit(2) }
const pageId = parseInt(lines[idx], 10)
const pageIdx = pageId - 1
console.log('选中页面', pageIdx, ':', lines[idx].slice(0, 80))
await rpc('tools/call', { name: 'select_page', arguments: { pageIdx } })

if (expr) {
  const out = await rpc('tools/call', { name: 'evaluate_script', arguments: { pageId, function: '(async () => { return (' + expr + ') })()' } })
  console.log('eval:', JSON.stringify(out).slice(0, 1500))
}
const logs = await rpc('tools/call', { name: 'list_console_messages', arguments: { pageId } })
console.log('console:', JSON.stringify(logs).slice(0, 1500))
child.kill(); process.exit(0)
