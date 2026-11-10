/* 设置页 */
const $ = (id) => document.getElementById(id)
const SYNC = {
  enabled: true, tone: 'direct', length: 'short', aiEnabled: false, autoOpen: true,
  replyLang: 'auto', uiLang: 'auto', apiBase: 'https://api.deepseek.com', model: 'deepseek-chat',
  customSystem: '',
}
const LOCAL = { apiKey: '' }

const say = (m, bad) => { const el = $('status'); el.textContent = m; el.className = bad ? 'bad' : '' }

function load() {
  chrome.storage.sync.get(SYNC, (v) => {
    $('enabled').checked = v.enabled !== false
    $('aiEnabled').checked = v.aiEnabled === true
    $('autoOpen').checked = v.autoOpen !== false
    $('tone').value = v.tone || 'direct'
    $('length').value = v.length || 'short'
    $('replyLang').value = v.replyLang || 'auto'
    $('uiLang').value = v.uiLang || 'auto'
    $('apiBase').value = v.apiBase || ''
    $('model').value = v.model || ''
    $('customSystem').value = v.customSystem || ''
  })
  chrome.storage.local.get(LOCAL, (v) => { $('apiKey').value = v.apiKey || '' })
  chrome.storage.local.get({ myCorpus: null }, (v) => showCorpus(v.myCorpus))
  $('ver').textContent = chrome.runtime.getManifest().version
}

function showCorpus(c) {
  const el = $('corpus')
  if (!c) { el.textContent = '未学习'; return }
  const d = new Date(c.builtAt).toLocaleString()
  el.textContent = '已学 ' + c.count + ' 条 · 中位 ' + c.stats.median + ' 字 · 一句 ' + c.stats.oneSentencePct + '%（' + d + '）'
}

function save() {
  chrome.storage.sync.set({
    enabled: $('enabled').checked,
    aiEnabled: $('aiEnabled').checked,
    autoOpen: $('autoOpen').checked,
    tone: $('tone').value,
    length: $('length').value,
    replyLang: $('replyLang').value,
    uiLang: $('uiLang').value,
    apiBase: $('apiBase').value.trim() || 'https://api.deepseek.com',
    model: $('model').value.trim() || 'deepseek-chat',
    customSystem: $('customSystem').value.trim(),
  }, () => say('已保存'))
  chrome.storage.local.set({ apiKey: $('apiKey').value.trim() })
}

for (const id of ['enabled', 'aiEnabled', 'autoOpen', 'tone', 'length', 'replyLang', 'uiLang', 'customSystem']) {
  $(id).addEventListener('change', save)
}
$('apiBase').addEventListener('change', save)
$('model').addEventListener('change', save)
$('apiKey').addEventListener('change', save)

$('test').addEventListener('click', () => {
  $('testMsg').textContent = '测试中…'
  chrome.runtime.sendMessage({ type: 'ai:test' }, (res) => {
    $('testMsg').textContent = !res ? '后台无响应' : (res.ok ? '通了 ' + res.ms + 'ms' : '失败：' + (res.error || '未知'))
  })
})

$('learn').addEventListener('click', async () => {
  $('corpus').textContent = '正在扫你的主页…（会自动往下滚）'
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab || !/x\.com|twitter\.com/.test(tab.url || '')) { $('corpus').textContent = '先打开你自己的 X 主页再点'; return }
  try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/i18n.js', 'src/reply-style.js', 'src/gen.js', 'src/content.js'] }) } catch (e) { /* 忽略 */ }
  await new Promise((r) => setTimeout(r, 400))
  chrome.tabs.sendMessage(tab.id, { type: 'learn:start' }, (res) => {
    const err = chrome.runtime.lastError
    if (err || !res) { $('corpus').textContent = '页面没响应：刷新那个标签页再点'; return }
    if (!res.ok) { $('corpus').textContent = '失败：' + res.reason; return }
    $('corpus').textContent = '已学 ' + res.count + ' 条（@' + res.handle + '）· 中位 ' + res.stats.median + ' 字'
    chrome.storage.local.get({ myCorpus: null }, (v) => showCorpus(v.myCorpus))
  })
})

$('clearCorpus').addEventListener('click', () => {
  chrome.storage.local.remove('myCorpus', () => { $('corpus').textContent = '未学习'; say('语料已清除') })
})

$('check').addEventListener('click', () => {
  $('updMsg').textContent = '检查中…'
  chrome.runtime.sendMessage({ type: 'xr:checkUpdate' }, (res) => {
    $('updMsg').textContent = res && res.ok ? ('当前 v' + res.local + (res.remote ? ' · 远端 v' + res.remote : '')) : '检查失败'
  })
})

load()
