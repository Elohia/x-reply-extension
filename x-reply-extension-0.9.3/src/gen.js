/**
 * gen.js —— 本地兜底模板（不联网也能给出三条）
 * 目标：不出现"这话我认/关键那步"这类一眼假的固定句；每条都落到推文里的具体信息。
 */
(function (root, factory) {
  const api = factory(root.XReplyStyle || null)
  if (typeof module === 'object' && module.exports) module.exports = api
  root.XReplyGen = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function (STYLE) {
  const AVOID = (STYLE && STYLE.avoid) || []
  const strip = (s) => { let t = String(s || ''); for (const w of AVOID) t = t.split(w).join(''); return t }
  const clean = (t) => String(t || '').replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim()
  const nums = (t) => (clean(t).match(/\d+(?:\.\d+)?\s*(?:%|万|亿|千|k|K|天|个月|年|次|条|人|个|美元|块|元)?/g) || []).filter((x) => x.length >= 2).slice(0, 3)
  const topic = (t) => {
    if (/(代码|插件|脚本|API|部署|报错|调试|模型|prompt|GitHub|编译|依赖|MCP)/i.test(t)) return 'tech'
    if (/\d+\s*(%|万|亿)|转化|留存|曝光|播放|成本|营收|ROI|数据|流量/.test(t)) return 'data'
    if (/(粉丝|曝光|流量|涨粉|互动|播放|阅读|推荐)/.test(t)) return 'growth'
    if (/(上线|发布|产品|小程序|游戏|功能|用户|注册|下载|版本)/.test(t)) return 'product'
    return 'view'
  }
  // 用推文文本做稳定散列，保证同一推文每次生成一致，不同推文不撞句
  const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h }
  const pick = (arr, seed, off) => arr[(seed + (off || 0)) % arr.length]

  const POOL = {
    tech: {
      add: ['环境比代码更容易出事：同一份脚本换台机器就挂。你是在原机复现的吗？', '这套思路我认。真正难的是回滚那一步，你留了降级开关吗？', '我上周照着类似做法跑了一遍，卡在依赖版本上，你锁版本了吗？'],
      push: ['不完全对。同一个做法在我这边你那边就跑不通，差别在数据规模。', '有个反例：小数据上很顺，量一上来先崩的是内存，不是逻辑。', '前提得加一句：并发高的时候这招会反噬，你压过并发吗？'],
      stop: ['能跑通就算赢。', '先让它跑起来，再谈优雅。', '这套更像工程活，不是灵感活。'],
    },
    data: {
      add: ['这个数我更关心口径：是按点击还是按曝光算的？', '数字挺亮，但样本多久？一周和一个月完全是两回事。', '如果按天看会抖，你取的是几天均值？'],
      push: ['换个口径就翻车：我这边的同一件事换成曝光算，直接变负。', '这数有幸存者偏差吧，失败的那些没进统计。', '短期好看不代表稳，我这边过一阵就开始回落。'],
      stop: ['口径不清，数再大也没法比。', '先定义，再比较。'],
    },
    growth: {
      add: ['曝光卡住这事我也遇到过，改发布时间比改内容见效快。', '粉丝不涨的时候我在评论区待了三天，比发十条管用。', '这个数别只看总量，看单条中位数更准。'],
      push: ['不一定是内容问题：我这边同样的帖换个时间发，差三倍。', '反过来也可能不是算法，是互动率太低导致不推。', '别急着追热点，追完人还是留不住。'],
      stop: ['先稳住更新节奏，再谈爆发。', '互动比曝光更值得盯。'],
    },
    product: {
      add: ['上线只是开始，接下来最难的是让人知道。你第一批用户从哪来的？', '功能做对了，但入口太深——新用户基本找不到。', '这个我试过：改文案比改功能更有效，你先试的那一版是什么？'],
      push: ['不一定。同样功能我这边上线三周没人用，最后是靠推送救回来的。', '有个坑：老用户会反对改版，你打算怎么过渡？', '前提是有人愿意为它付钱，否则只是自嗨。'],
      stop: ['做出来没人知道，是最常见的死法。', '先解决有人用，再解决好用。'],
    },
    view: {
      add: ['这个判断我同意一半：规模一上来就未必成立。', '顺着说一句：真正难的是坚持到能验证的那天。', '我更想知道你是什么时候开始这么想的？'],
      push: ['反过来想：如果这件事不成立，谁会先受损？', '这话对，但前提是运气别太差。', '听着对，落地时大多数人死在第二步。'],
      stop: ['方向对，别急着大规模铺。', '先做小，再看要不要放大。'],
    },
  }

  function drafts(tweet, opts) {
    const text = clean(tweet && tweet.text)
    if (!text) return []
    const k = topic(text)
    const seed = hash(text)
    const n = nums(text)
    const pool = POOL[k]
    const withNum = (s) => (n[0] ? s.replace('你那边', n[0]) : s)
    const len = opts && opts.length === 'mid' ? 95 : 62
    const out = [
      { angle: '接一句', text: withNum(pick(pool.add, seed, 0)) },
      { angle: '顶一句', text: withNum(pick(pool.push, seed, 1)) },
      { angle: '收一句', text: pick(pool.stop, seed, 2) },
    ]
    const noPlaceholder = (x) => x.replace(/【[^】]*】/g, '你那边')
    return out.map((d) => {
      let t = noPlaceholder(strip(d.text)).replace(/\s+/g, ' ').trim()
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

  return { drafts, check, topic }
})
