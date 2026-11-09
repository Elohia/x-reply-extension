import { readFileSync } from 'node:fs'
import { requestRaw } from 'file:///D:/dsh/dsh-x-scroll/lib/http.mjs'
const yaml = readFileSync('F:/dsh-home/.credentials.yaml', 'utf8')
const key = (yaml.match(/DEEPSEEK_API_KEY:\s*(\S+)/) || [])[1]
const body = JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: '只回两个字：收到' }], max_tokens: 10 })
for (const proxy of ['', 'http://127.0.0.1:7890']) {
  try {
    const r = await requestRaw({ host: 'api.deepseek.com', path: '/v1/chat/completions', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: Buffer.from(body), proxyUrl: proxy, timeoutMs: 30000 })
    console.log(proxy || 'direct', '->', r.status, r.body.toString('utf8').slice(0, 120))
  } catch (e) { console.log(proxy || 'direct', 'ERR', String(e.message).slice(0, 120)) }
}
