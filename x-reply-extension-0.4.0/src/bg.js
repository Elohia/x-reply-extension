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

async function gen(tweet, author) {
  const c = await cfg()
  if (!c.apiKey) return { ok: false, error: '没填 API Key（点插件图标 → 填 Key → 保存）' }
  const t0 = Date.now()
  try {
    const res = await fetch(endpoint(c.apiBase), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.apiKey },
      body: JSON.stringify({
        model: c.model, temperature: 0.8, max_tokens: 600,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildSystem() },
          { role: 'user', content: '推文：' + String(tweet || '').slice(0, 2000) + '\n作者：' + (author || '未知') + '\n我想要的语气：' + c.aiStyle },
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
  if (msg && msg.type === 'ai:gen') { gen(msg.tweet, msg.author).then(sendResponse); return true }
  if (msg && msg.type === 'ai:test') { gen('测试：用 3 天把 120 万的表压到 8 秒', '@test').then(sendResponse); return true }
})
