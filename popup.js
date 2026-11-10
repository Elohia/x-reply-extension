/* popup：设置（同步项）+ API Key（本地项）+ 连接测试 */
const SYNC = { enabled: true, tone: 'direct', length: 'short', aiEnabled: false, autoOpen: true, apiBase: 'https://api.deepseek.com', model: 'deepseek-chat' }
const $ = (id) => document.getElementById(id)

chrome.storage.sync.get(SYNC, (v) => {
  $('enabled').checked = v.enabled !== false
  $('aiEnabled').checked = v.aiEnabled === true
  $('autoOpen').checked = v.autoOpen !== false
  $('tone').value = v.tone || 'direct'
  $('length').value = v.length || 'short'
  $('apiBase').value = v.apiBase || 'https://api.deepseek.com'
  $('model').value = v.model || 'deepseek-chat'
})
chrome.storage.local.get({ apiKey: '' }, (v) => { $('apiKey').value = v.apiKey || '' })
chrome.storage.local.get({ used: 0 }, (v) => { $('used').textContent = String(v.used || 0) })

const msg = (text, cls) => { $('msg').textContent = text; $('msg').className = cls || '' }

$('enabled').addEventListener('change', (e) => chrome.storage.sync.set({ enabled: e.target.checked }))
$('aiEnabled').addEventListener('change', (e) => chrome.storage.sync.set({ aiEnabled: e.target.checked }))
$('autoOpen').addEventListener('change', (e) => chrome.storage.sync.set({ autoOpen: e.target.checked }))
$('tone').addEventListener('change', (e) => chrome.storage.sync.set({ tone: e.target.value }))
$('length').addEventListener('change', (e) => chrome.storage.sync.set({ length: e.target.value }))

$('save').addEventListener('click', async () => {
  const patch = {
    apiBase: $('apiBase').value.trim() || 'https://api.deepseek.com',
    model: $('model').value.trim() || 'deepseek-chat',
  }
  await chrome.storage.sync.set(patch)
  await chrome.storage.local.set({ apiKey: $('apiKey').value.trim() })
  msg('已保存', 'ok')
})

$('test').addEventListener('click', async () => {
  msg('测试中…')
  await chrome.storage.sync.set({ apiBase: $('apiBase').value.trim() || 'https://api.deepseek.com', model: $('model').value.trim() || 'deepseek-chat' })
  await chrome.storage.local.set({ apiKey: $('apiKey').value.trim() })
  chrome.runtime.sendMessage({ type: 'ai:test' }, (res) => {
    if (!res || !res.ok) return msg('失败：' + ((res && res.error) || '无响应'), 'bad')
    msg('通了：' + res.drafts.length + ' 条 / ' + res.ms + 'ms / ' + res.tokens + ' tokens', 'ok')
  })
})

$('reset').addEventListener('click', () => chrome.storage.local.set({ used: 0 }, () => { $('used').textContent = '0' }))
$('demo').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('demo.html') }))

/* 学习我的推文：需要当前标签页是「你自己的主页」 */
const showCorpus = (c) => {
  const el = document.getElementById('learnStatus')
  if (!el) return
  if (!c) { el.textContent = '未学习'; return }
  const d = new Date(c.builtAt).toLocaleString()
  el.textContent = '已学 ' + c.count + ' 条 · 中位 ' + c.stats.median + ' 字 · 一句 ' + c.stats.oneSentencePct + '%（' + d + '）'
}
chrome.storage.local.get({ myCorpus: null }, (v) => showCorpus(v.myCorpus))
async function ensureInjected(tabId) {
  // 老标签页里的脚本可能是旧版/已失效：补注入一次最新的
  if (!chrome.scripting || !chrome.scripting.executeScript) return false
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['src/reply-style.js', 'src/gen.js', 'src/content.js'] })
    return true
  } catch (e) { return false }
}

function ping(tabId) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, { type: 'xr:ping' }, (res) => {
        const err = chrome.runtime.lastError
        resolve(err ? null : (res || null))
      })
    } catch (e) { resolve(null) }
  })
}

function sendLearn(tabId) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, { type: 'learn:start' }, (res) => {
        const err = chrome.runtime.lastError // 必须读一下，否则控制台报 Unchecked runtime.lastError
        if (err) return resolve(null)
        resolve(res || null)
      })
    } catch (e) { resolve(null) }
  })
}

document.getElementById('learn')?.addEventListener('click', async () => {
  const el = document.getElementById('learnStatus')
  el.textContent = '正在扫你的主页…（会自动往下滚，几十秒）'
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab || !/x\.com|twitter\.com/.test(tab.url || '')) { el.textContent = '先打开你自己的 X 主页再点'; return }
  try {
    el.textContent = '准备脚本…'
    await ensureInjected(tab.id) // 幂等：已注入过的会自己跳过
    await new Promise((r) => setTimeout(r, 300))
    let p = await ping(tab.id)
    if (!p) return (el.textContent = '这个页面里脚本起不来（可能是 Chrome 商店页/PDF/x.com 之外的页面）：换到 x.com 你的主页再点')
    el.textContent = '脚本 v' + (p.version || '?') + '，开始扫…'
    let res = await sendLearn(tab.id)
    if (!res) {
      el.textContent = '旧页面没响应，正在补注入最新脚本…'
      const ok = await ensureInjected(tab.id)
      if (!ok) return (el.textContent = '当前扩展版本太旧（无 scripting 权限）：到 chrome://extensions 点「刷新」升级到 0.9.2 后再试')
      await new Promise((r) => setTimeout(r, 600))
      res = await sendLearn(tab.id)
    }
    if (!res) return (el.textContent = '仍然没响应：到 chrome://extensions 点该扩展「刷新」，再刷新这个页面')
    if (!res.ok) return (el.textContent = '失败：' + res.reason)
    el.textContent = '已学 ' + res.count + ' 条（@' + res.handle + '）· 中位 ' + res.stats.median + ' 字'
    chrome.storage.local.get({ myCorpus: null }, (v) => showCorpus(v.myCorpus))
  } catch (e) { el.textContent = '失败：' + e.message }
})

document.getElementById('openOptions')?.addEventListener('click', (e) => {
  // 链接本身能开；这里只是兜底（某些版本 openOptionsPage 会静默失败）
  try {
    e.preventDefault()
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') })
  } catch (err) { /* 让链接默认行为生效 */ }
})
