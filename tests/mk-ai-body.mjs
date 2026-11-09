import { writeFileSync, readFileSync } from 'node:fs'
const key = (readFileSync('F:/dsh-home/.credentials.yaml', 'utf8').match(/DEEPSEEK_API_KEY:\s*(\S+)/) || [])[1]
const SYS = [
  '你在帮一个中文 X 用户写回复草稿。对方是真人：短句、不装、不说客套话。',
  '硬规则：',
  '1) 每条 20–60 字，短句优先；',
  '2) 每条必须带一个具体信息：数字、反例、或可执行动作；推文里没有数字就用【你的数字】占位，绝不编造；',
  '3) 三条角度必须不同：追问细节 / 补一个反例或边界 / 给一句判断；',
  '4) 禁用词：赋能 闭环 抓手 重磅 炸裂 颠覆 底层逻辑 降本增效 赛道 护城河；',
  '5) 不喊口号、不夸人、不写"学习了""说得好"；',
  '6) 先做一句语义分析（这条在说什么、作者想要什么反应），再给三条草稿。',
  '只输出 JSON：{"analysis":"…","drafts":[{"angle":"追问细节","text":"…"},{"angle":"补反例","text":"…"},{"angle":"给判断","text":"…"}]}'
].join('\n')
const tweet = '用 3 天把 120 万的表压到 8 秒，说说我怎么做的'
const body = { model: 'deepseek-chat', temperature: 0.7, max_tokens: 700, response_format: { type: 'json_object' },
  messages: [{ role: 'system', content: SYS }, { role: 'user', content: '推文正文：' + tweet + '\n作者：@azhe_dev' }] }
writeFileSync('F:/dsh-home/tmp/ds-gen.json', JSON.stringify(body), 'utf8')
console.log('key', key ? 'ok' : 'missing')
