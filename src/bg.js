/**
 * 后台：调模型做「回复语义分析 + 三条真人感草稿」
 * ---------------------------------------------------------------
 * 语料包 src/reply-style.js 打包在插件里（抓自 341 条真实中文回复），
 * 所以新用户装完不依赖任何本地文件/CLI，直接就有"像人"的写法基线。
 * 为什么放 background：MV3 background 的 fetch 受 host_permissions 保护，不受 X 页面 CORS 限制。
 */
importScripts('reply-style.js')

const DEFAULTS = { aiEnabled: false, apiBase: 'https://api.deepseek.com', model: 'deepseek-chat', aiStyle: 'direct' }
const S = self.XReplyStyle

function buildSystem() {
  const lines = []
  lines.push('你在帮一个中文 X 用户写**一条**回复。只写这一条的三个候选，供他挑一个改完发出去。')
  lines.push('')
  lines.push('【真实回复是什么样的】下面是从 ' + S.stats.n + ' 条真实中文回复里统计出来的：')
  lines.push('- 长度中位数 ' + S.stats.median + ' 字，P90 ' + S.stats.p90 + ' 字；')
  lines.push('- ' + S.stats.oneSentencePct + '% 只有一句话；问句只占 ' + S.stats.questionPct + '%；')
  lines.push('- ' + S.stats.digitPct + '% 会带数字；表情只占 ' + S.stats.emojiPct + '%；套话只占 ' + S.stats.clichePct + '%。')
  lines.push('所以：主要写陈述句（接一句 + 具体信息），不要条件反射地提问。')
  lines.push('')
  lines.push('【数字规则（硬约束）】')
  lines.push('- 只能使用推文里已经出现的数字（如 1000、4.2%、3 天）。')
  lines.push('- 如果需要一个数字但推文里没有：**不许编、也不许留【】占位**，改成不带数字的说法，例如「我这边试过几次」「身边做这个的基本都这样」。')
  lines.push('- 生成完自检：输出里不允许出现【 或 】。')
  lines.push('')
  lines.push('【怎么写得像真人（重要）】')
  lines.push('- 开头别用这些腔调：这话我认 / 说实话 / 有个反例 / 值得注意 / 本质上 / 归根结底。')
  lines.push('- 引用推文里的一个具体词或数字，别整句复述。')
  lines.push('- 三条长度要不一样：一条很短（≤20 字）、一条 25–45 字、一条 40–70 字。')
  lines.push('- 可以用口语：其实 / 反而 / 结果 / 倒是 / 干脆 / 我这边。')
  lines.push('- 不解释"为什么这条好"，不总结对方观点，不在结尾加反问。')
  lines.push('')
  lines.push('【硬规则】')
  S.rules.forEach((r, i) => lines.push((i + 1) + ') ' + r))
  lines.push('')
  lines.push('【三种形态，每一条各写一种，顺序固定】')
  S.angles.forEach((a) => lines.push('- ' + a.label + '：' + a.note))
  lines.push('')
  lines.push('【真实例句（照着这个语感写，不要抄内容）】')
  S.examples.slice(0, 10).forEach((e) => lines.push('- ' + e))
  lines.push('')
  lines.push('【绝对不要出现】' + S.avoid.join('、'))
  lines.push('')
  lines.push('【先想清楚再写（防词不达意）】')
  lines.push('1) 先用一句话说：他到底在问什么 / 在表达什么情绪 / 想要什么样的回应。')
  lines.push('2) 再写三条：每条必须钉住推文里的**一个具体点**（一个词、一个数、一个动作），不能泛泛表态。')
  lines.push('3) 如果推文在提问，三条里至少一条直接回答那个问题；如果推文在晒数据，先接住那个数据。')
  lines.push('4) 写完自检：把三条分别放回推文下面读一遍，读起来接得上吗？接不上就重写。')
  lines.push('')
  lines.push('【输出】只输出 JSON：')
  lines.push('{"analysis":"一句话：这条在说什么 + 作者想要什么反应","drafts":[{"angle":"' + S.angles[0].label + '","text":"…"},{"angle":"' + S.angles[1].label + '","text":"…"},{"angle":"' + S.angles[2].label + '","text":"…"}]}')
  return lines.join('\n')
}

async function cfg() {
  const local = await chrome.storage.local.get({ apiKey: '' })
  const sync = await chrome.storage.sync.get(DEFAULTS)
  return { ...DEFAULTS, ...sync, apiKey: String(local.apiKey || '').trim() }
}

const endpoint = (base) => { const b = String(base || '').replace(/\/+$/, ''); return /\/v1$/.test(b) ? b + '/chat/completions' : b + '/v1/chat/completions' }

function parseDrafts(raw) {
  let text = String(raw || '').trim().replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '')
  let data = null
  try { data = JSON.parse(text) } catch {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) { try { data = JSON.parse(m[0]) } catch { /* 放弃 */ } }
  }
  if (!data || !Array.isArray(data.drafts)) return null
  const drafts = data.drafts.filter((d) => d && typeof d.text === 'string' && d.text.trim()).slice(0, 3)
    .map((d) => ({ angle: String(d.angle || '草稿'), text: String(d.text).trim() }))
  if (!drafts.length) return null
  return { analysis: String(data.analysis || '').trim(), drafts }
}

async function gen(tweet, author, quote) {
  const c = await cfg()
  if (!c.apiKey) return { ok: false, error: '没填 API Key（点插件图标 → 填 Key → 保存）' }
  const t0 = Date.now()
  try {
    const res = await fetch(endpoint(c.apiBase), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.apiKey },
      body: JSON.stringify({
        model: c.model, temperature: 0.65, max_tokens: 700,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildSystem() },
          { role: 'user', content: '推文：' + String(tweet || '').slice(0, 2000) + '\n作者：' + (author || '未知') + (quote ? '\n他引用/回复的内容：' + String(quote).slice(0, 800) : '') + '\n我想要的语气：' + c.aiStyle },
        ],
      }),
    })
    const text = await res.text()
    if (!res.ok) return { ok: false, error: 'HTTP ' + res.status + ' ' + text.slice(0, 160) }
    const js = JSON.parse(text)
    const content = js.choices && js.choices[0] && js.choices[0].message && js.choices[0].message.content
    const parsed = parseDrafts(content)
    if (!parsed) return { ok: false, error: '模型没按 JSON 回：' + String(content || '').slice(0, 100) }
    return { ok: true, analysis: parsed.analysis, drafts: parsed.drafts, ms: Date.now() - t0, model: c.model, tokens: (js.usage && js.usage.total_tokens) || 0 }
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) }
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'ai:gen') { gen(msg.tweet, msg.author, msg.quote).then(sendResponse); return true }
  if (msg && msg.type === 'ai:test') { gen('测试：用 3 天把 120 万的表压到 8 秒', '@test').then(sendResponse); return true }
})
