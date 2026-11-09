import { readFileSync } from 'node:fs'
import { requestRaw } from 'file:///D:/dsh/dsh-x-scroll/lib/http.mjs'
const yaml = readFileSync('F:/dsh-home/.credentials.yaml', 'utf8')
const key = (yaml.match(/DEEPSEEK_API_KEY:\s*(\S+)/) || [])[1]
console.log('key?', !!key, key ? key.slice(0, 6) + '…' : '')
if (!key) process.exit(2)
const sys = [
  '你在帮一个中文 X 用户写回复草稿。对方是真人，说话短、不装。',
  '硬规则：',
  '1. 每条 20–60 字；短句优先，允许一句半。',
  '2. 每条必须带一个具体信息：数字、反例、或可执行动作。如果推文里没有数字，用【你的数字】占位，绝不编造。',
  '3. 三条角度不同：追问细节 / 补一个反例或边界 / 给一句判断。',
  '4. 不写：赋能 闭环 抓手 重磅 炸裂 颠覆 底层逻辑 降本增效 赛道 护城河。',
  '5. 不喊口号、不夸人、不说"学习了"。',
  '6. 先做一句语义分析（这条在说什么、作者情绪、想要什么反应），再给草稿。',
  '只输出 JSON：{"analysis":"一句分析","drafts":[{"angle":"追问细节","text":"…"},{"angle":"补反例","text":"…"},{"angle":"给判断","text":"…"}]}',
].join('\n')
const user = '推文正文：用 3 天把 120 万的表压到 8 秒，说说我怎么做的\n作者：@azhe_dev'
const body = JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperature: 0.7, response_format: { type: 'json_object' }, max_tokens: 600 })
const t0 = Date.now()
const res = await requestRaw({
  host: 'api.deepseek.com', path: '/v1/chat/completions', method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
  body: Buffer.from(body, 'utf8'), proxyUrl: 'http://127.0.0.1:7890', timeoutMs: 60000,
})
console.log('status', res.status, 'ms', Date.now() - t0)
const js = JSON.parse(res.body.toString('utf8'))
const txt = js.choices && js.choices[0] && js.choices[0].message.content
console.log('raw:', String(txt).slice(0, 700))
