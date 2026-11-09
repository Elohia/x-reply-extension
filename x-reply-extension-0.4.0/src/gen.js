/**
 * gen.js —— 本地模板兜底（不联网也能出三条）
 * 统计口径来自真实语料（src/reply-style.js）：
 *   中位数 30 字、74% 一句、问句仅 9%、60% 带数字、套话仅 2%
 * 所以这里默认写陈述句：接一句（补具体信息）/ 顶一句（反例或边界）/ 收一句（短判断）
 */
(function (root, factory) {
  const api = factory(root.XReplyStyle || null)
  if (typeof module === 'object' && module.exports) module.exports = api
  root.XReplyGen = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function (STYLE) {
  const AVOID = (STYLE && STYLE.avoid) || ['学习了', '说得好', '赋能', '闭环', '抓手']
  const strip = (s) => { let t = String(s || ''); for (const w of AVOID) t = t.split(w).join(''); return t }

  const clean = (t) => String(t || '').replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim()
  const nums = (t) => (clean(t).match(/\d+(?:\.\d+)?\s*(?:%|万|亿|千|k|K|天|个月|年|次|条|人|个|美元|块|元)?/g) || []).filter((x) => x.length >= 2).slice(0, 3)
  const topic = (t) => {
    if (/(代码|插件|脚本|API|部署|报错|调试|模型|prompt|GitHub|编译|依赖|MCP)/i.test(t)) return 'tech'
    if (/\d+\s*(%|万|亿)|转化|留存|曝光|播放|成本|营收|ROI|数据/.test(t)) return 'data'
    if (/(上线|发布|产品|小程序|游戏|功能|用户|注册|下载|版本)/.test(t)) return 'product'
    return 'view'
  }
  const firstClause = (t) => { const s = clean(t).split(/[。！？!?\n]/)[0] || ''; return s.length > 18 ? s.slice(0, 18) + '…' : s }

  function drafts(tweet, opts) {
    const text = clean(tweet && tweet.text)
    if (!text) return []
    const n = nums(text)
    const k = topic(text)
    const len = opts && opts.length === 'mid' ? 90 : 55
    const out = []

    // 接一句：顺着他的话补一个具体的东西
    if (k === 'tech') {
      out.push({ angle: '接一句', text: (n[0] ? n[0] + ' 这个量级' : '这套做法') + '我这边跑过，卡点通常在环境而不是代码，你把复现步骤贴出来更好判断。' })
    } else if (k === 'data') {
      out.push({ angle: '接一句', text: (n[0] ? n[0] + ' 的样本' : '这批样本') + '看着还行，但口径很关键：先说是按什么统计的，再谈高低。' })
    } else if (k === 'product') {
      out.push({ angle: '接一句', text: '上线这步最难的是没人知道。' + (n[0] ? n[0] + ' 这个数' : '第一批人') + '从哪来的，比功能本身更决定生死。' })
    } else {
      out.push({ angle: '接一句', text: '这话我认。' + (n[0] ? n[0] + ' 这个数' : '关键那步') + '才是最花时间的，前面都是热身。' })
    }

    // 顶一句：反例/边界（带占位符，让本人填）
    out.push({
      angle: '顶一句',
      text: k === 'data'
        ? '反过来也成立：同样的数换个口径就翻车，我这边【你的数字】那次就是这么被坑的。'
        : '也不一定。同样的做法我这边【你的数字】就顶不住，前提不同结论就反了。',
    })

    // 收一句：短判断
    out.push({ angle: '收一句', text: '盯着看的人多，动手做完的少。' })

    return out.map((d) => {
      let t = strip(d.text).replace(/\s+/g, ' ').trim()
      if (t.length > len) t = t.slice(0, len - 1) + '…'
      return { angle: d.angle, text: t }
    })
  }

  function check(text) {
    const issues = []
    const s = clean(text)
    if (!s) issues.push('空')
    if (s.length > 120) issues.push('偏长（' + s.length + ' 字）')
    if (/【[^】]*】/.test(s)) issues.push('还有占位符没填：' + (s.match(/【[^】]*】/g) || []).join(' '))
    const concrete = /[0-9]/.test(s) || /(我|你)(这边|当时|试过|遇到|用的)/.test(s) || /(多少|哪个|什么版本|样本|起点|口径|前提|量级)/.test(s)
    if (!concrete) issues.push('缺具体信息（数字 / 亲历 / 可回答的细节）')
    for (const w of AVOID) if (s.includes(w)) issues.push('套话：' + w)
    const emo = (s.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length
    if (emo > 1) issues.push('表情太多')
    return { ok: issues.length === 0, issues }
  }

  return { drafts: drafts, check: check, topic: topic }
})
