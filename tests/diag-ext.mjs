import { spawn } from 'node:child_process'
import { existsSync, rmSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const extDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(extDir, 'tests', 'out')
mkdirSync(outDir, { recursive: true })
const prof = process.env.CHROME_PROFILE
for (const f of ['SingletonLock','SingletonCookie','SingletonSocket','lockfile','Default/LOCK','Default/lockfile']) { try { rmSync(join(prof, f), { force: true, recursive: true }) } catch {} }
const port = 9350
const child = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--remote-debugging-port=' + port, '--user-data-dir=' + prof,
  '--disable-extensions-except=' + extDir, '--load-extension=' + extDir,
  '--proxy-server=http://127.0.0.1:7890', '--no-first-run', '--no-default-browser-check',
  'about:blank',
], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
for (let i = 0; i < 60; i++) { try { const r = await fetch('http://127.0.0.1:' + port + '/json/version'); if (r.ok) break } catch {} await sleep(300) }
const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
console.log('targets:')
for (const t of list) console.log(' -', t.type, String(t.url).slice(0, 90))
const extTargets = list.filter((t) => String(t.url).startsWith('chrome-extension://'))
console.log('extension targets:', extTargets.length)
if (extTargets[0]) {
  const ws = new WebSocket(extTargets[0].webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let id = 0; const pend = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) })
  const r = await send('Runtime.evaluate', { expression: 'JSON.stringify({id: chrome.runtime.id, name: chrome.runtime.getManifest().name})', returnByValue: true })
  console.log('manifest:', r.result && r.result.result && r.result.result.value)
  ws.close()
}
try { child.kill() } catch {}
process.exit(0)
