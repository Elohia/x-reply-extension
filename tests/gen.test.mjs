import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const gen = require('../src/gen.js')

const cases = [
  { text: '用 3 天把 120 万的表压到 8 秒，说说我怎么做的' },
  { text: '有没有人知道 DSH 插件怎么本地调试？试了 3 次都不行' },
  { text: '刚上线一个小游戏，注册转化 4.2%，感觉还行' },
  { text: 'AI agent 真正难的是让它在没有人在的时候也能自己判断该不该动手' },
]
const BAN = ['赋能', '闭环', '抓手', '重磅', '炸裂', '颠覆']
let hard = 0
let soft = 0
for (const c of cases) {
  const d = gen.drafts(c, {})
  if (d.length !== 3) { console.log('FAIL count', d.length); hard++ }
  console.log('--- ' + c.text.slice(0, 28))
  for (const x of d) {
    const r = gen.check(x.text)
    const hardIssues = r.issues.filter((i) => i.startsWith('营销词') || i === '空的' || i.startsWith('偏长') || i.startsWith('表情太多'))
    const softIssues = r.issues.filter((i) => !hardIssues.includes(i))
    if (hardIssues.length) hard++
    if (softIssues.length) soft++
    console.log((hardIssues.length ? 'FAIL' : 'OK  ') + ' [' + x.angle + '] ' + x.text + (softIssues.length ? '  (待填/待改: ' + softIssues.join('; ') + ')' : ''))
  }
}
console.log('hard=' + hard + ' soft=' + soft)
console.log(hard === 0 ? 'ALL PASS（软提示=需要本人补数字，属预期）' : 'FAILED')
process.exit(hard === 0 ? 0 : 1)
