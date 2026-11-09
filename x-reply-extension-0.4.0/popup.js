/* popup：设置（同步项）+ API Key（本地项）+ 连接测试 */
const SYNC = { enabled: true, tone: 'direct', length: 'short', aiEnabled: false, apiBase: 'https://api.deepseek.com', model: 'deepseek-chat' }
const $ = (id) => document.getElementById(id)

chrome.storage.sync.get(SYNC, (v) => {
  $('enabled').checked = v.enabled !== false
  $('aiEnabled').checked = v.aiEnabled === true
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
