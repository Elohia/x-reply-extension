/**
 * X 快速回复 · content script（0.4.0 独立版）
 * ------------------------------------------------------------
 * 不再监听页面：没有 MutationObserver、不给每条推文注入按钮。
 * 只有一个悬浮按钮（Alt+R 也行）：
 *   点一下 → 读「你正在看的那条推文」→ AI/本地生成三条 → 面板里选一条 → 填入回复框
 * 完全独立：不依赖 twitter-cli、不依赖本地文件，语料打包在 src/reply-style.js
 */
(function () {
  'use strict'
  const GEN = window.XReplyGen
  if (!GEN) return
  const DEFAULTS = { enabled: true, tone: 'direct', length: 'short', aiEnabled: false }
  let settings = { ...DEFAULTS }
  let panel = null
  let launcher = null
  let lastHover = null
  let bar = null
  let ctx = null

  chrome.storage.sync.get(DEFAULTS, (v) => {
    settings = { ...DEFAULTS, ...v }
    if (settings.enabled) mount(); else unmount()
  })
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'sync' && area !== 'local') return
    for (const k of Object.keys(ch)) if (k in DEFAULTS) settings[k] = ch[k].newValue
    if (settings.enabled) mount(); else unmount()
  })

  // 唯一一个"监听"：记录鼠标最后停在哪个推文上（passive，零开销）
  document.addEventListener('mouseover', (e) => {
    if (!settings.enabled) return
    const art = e.target && e.target.closest && e.target.closest('article[data-testid="tweet"]')
    if (art) lastHover = art
  }, { capture: true, passive: true })

  document.addEventListener('keydown', (e) => {
    if (!settings.enabled) return
    if (e.altKey && (e.key === 'r' || e.key === 'R')) { e.preventDefault(); openPanel() }
    if (e.key === 'Escape') { closePanel(); hideBar() }
  })

  function mount() {
    if (launcher) return
    launcher = document.createElement('button')
    launcher.id = 'xr-launcher'
    launcher.type = 'button'
    launcher.title = '快速回复（Alt+R）'
    launcher.textContent = '回'
    launcher.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openPanel() })
    document.body.appendChild(launcher)
  }
  function unmount() {
    if (launcher) { launcher.remove(); launcher = null }
    closePanel(); hideBar()
  }

  /** 找"当前这条推文"：URL 是推文页 → 它；否则用鼠标最后停住的那条；再否则用视口中心那条 */
  function currentTweet() {
    const m = location.pathname.match(/\/status\/(\d+)/)
    const all = Array.from(document.querySelectorAll('article[data-testid="tweet"]'))
    if (m) {
      const id = m[1]
      const hit = all.find((a) => (a.querySelector('a[href*="/status/' + id + '"]') || null))
      if (hit) return hit
    }
    if (lastHover && lastHover.isConnected) return lastHover
    // 取「离视口中心最近、且部分可见」的那条
    const mid = window.innerHeight / 2
    let best = null, bestScore = Infinity
    for (const a of all) {
      const r = a.getBoundingClientRect()
      if (r.bottom < 40 || r.top > window.innerHeight - 40) continue
      const score = Math.abs((r.top + r.bottom) / 2 - mid)
      if (score < bestScore) { bestScore = score; best = a }
    }
    if (best) return best
    return all[0] || null
  }

  const textOf = (a) => { const el = a && a.querySelector('[data-testid="tweetText"]'); return el ? el.innerText.trim() : '' }
  const authorOf = (a) => { const el = a && a.querySelector('[data-testid="User-Name"]'); return el ? el.innerText.split('\n')[0].trim() : '' }

  function closePanel() { if (panel) { panel.remove(); panel = null } }

  function openPanel() {
    closePanel()
    const art = currentTweet()
    if (!art) return toast('没找到推文：把页面滚到那条推文上再点')
    const tweet = textOf(art)
    if (!tweet) return toast('这条推文没有正文（可能是图片/转推）')
    const who = authorOf(art)

    panel = document.createElement('div')
    panel.className = 'xr-panel'
    const head = document.createElement('header')
    const b = document.createElement('b'); b.textContent = '快速回复'
    const sub = document.createElement('span'); sub.style.cssText = 'opacity:.6;font-size:11px'; sub.textContent = who
    const close = document.createElement('button'); close.className = 'xr-close'; close.type = 'button'; close.textContent = '✕'
    close.addEventListener('click', closePanel)
    head.append(b, sub, close)
    const orig = document.createElement('div'); orig.className = 'xr-orig'; orig.textContent = tweet
    const body = document.createElement('div'); body.className = 'xr-body'
    panel.append(head, orig, body)
    document.body.appendChild(panel)
    const r = launcher.getBoundingClientRect()
    panel.style.left = Math.max(12, Math.min(r.left - 350, window.innerWidth - 400)) + 'px'
    panel.style.top = Math.max(12, r.top - 420) + 'px'
    render(body, art, tweet, who)
  }

  function render(body, art, tweet, who) {
    body.innerHTML = ''
    if (!settings.aiEnabled) return renderLocal(body, art, tweet)
    const loading = document.createElement('div'); loading.className = 'xr-loading'; loading.textContent = 'AI 读这条，写三个人话回复…'
    body.appendChild(loading)
    chrome.runtime.sendMessage({ type: 'ai:gen', tweet, author: who }, (res) => {
      if (!panel) return
      if (!res || !res.ok) return renderLocal(body, art, tweet, res && res.error ? 'AI 不可用：' + res.error : 'AI 没响应')
      ctx = { art, drafts: res.drafts, meta: 'AI · ' + res.model + ' · ' + res.ms + 'ms · ' + (res.tokens || 0) + ' tokens', analysis: res.analysis }
      items(body, res.drafts, { analysis: res.analysis, meta: ctx.meta, regen: () => render(body, art, tweet, who) })
    })
  }

  function renderLocal(body, art, tweet, notice) {
    body.innerHTML = ''
    const drafts = GEN.drafts({ text: tweet }, { tone: settings.tone, length: settings.length })
    ctx = { art, drafts, meta: '本地模板', analysis: '' }
    items(body, drafts, { notice: notice ? notice + '（用本地模板）' : '本地模板（填 Key 可换模型生成）', regen: () => render(body, art, tweet, '') })
  }

  function items(body, drafts, o) {
    body.innerHTML = ''
    if (o.analysis) { const d = document.createElement('div'); d.className = 'xr-analysis'; d.textContent = o.analysis; body.appendChild(d) }
    for (const it of drafts) {
      const box = document.createElement('div'); box.className = 'xr-item'
      const ang = document.createElement('div'); ang.className = 'xr-angle'; ang.textContent = it.angle
      const ta = document.createElement('textarea'); ta.value = it.text
      const warn = document.createElement('div'); warn.className = 'xr-warn'
      const chk = () => { const r = GEN.check(ta.value); warn.textContent = r.ok ? '' : r.issues.join('；'); warn.style.display = r.ok ? 'none' : 'block' }
      ta.addEventListener('input', chk); chk()
      const acts = document.createElement('div'); acts.className = 'xr-actions'
      const fill = document.createElement('button'); fill.className = 'primary'; fill.type = 'button'; fill.textContent = '填入回复框'
      fill.addEventListener('click', () => fillReply(ctx && ctx.art, ta.value))
      const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = '复制'
      copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(ta.value); toast('已复制') } catch { toast('复制失败') } })
      acts.append(fill, copy)
      box.append(ang, ta, warn, acts); body.appendChild(box)
    }
    const foot = document.createElement('div'); foot.className = 'xr-foot'
    const again = document.createElement('button'); again.type = 'button'; again.textContent = '换一批'
    again.addEventListener('click', () => o.regen && o.regen())
    const tip = document.createElement('span'); tip.textContent = o.meta || o.notice || ''
    foot.append(again, tip); body.appendChild(foot)
  }

  function findEditor() {
    const vis = (e) => e && e.offsetParent !== null
    const ae = document.activeElement
    if (ae && ae.getAttribute && ae.getAttribute('contenteditable') === 'true' && vis(ae) && (ae.getAttribute('data-testid') || '').startsWith('tweetTextarea_')) return ae
    const inDialog = Array.from(document.querySelectorAll('[role="dialog"] [data-testid="tweetTextarea_0"]')).filter(vis)
    if (inDialog.length) return inDialog[inDialog.length - 1]
    const all = Array.from(document.querySelectorAll('[data-testid="tweetTextarea_0"]')).filter(vis)
    return all.length ? all[all.length - 1] : null
  }

  function insertText(ed, t) {
    const cnt = () => String(ed.textContent || '').split(t).length - 1
    if (cnt() >= 1) return true

    // 先清空再写：实测「清空 + 折叠光标 + execCommand」只写一份；
    // 直接插到已有内容后面，X 的编辑器会把同一段应用两次。
    ed.focus()
    try { document.execCommand('selectAll') } catch { /* 忽略 */ }
    try { document.execCommand('delete') } catch { /* 忽略 */ }

    const sel = window.getSelection()
    const r = document.createRange()
    r.selectNodeContents(ed)
    r.collapse(false)
    sel.removeAllRanges()
    sel.addRange(r)

    try { document.execCommand('insertText', false, t) } catch { /* 忽略 */ }
    if (cnt() === 1) return true
    if (cnt() > 1) {
      // 还是两份：全选后整体替换成一份
      ed.focus()
      try { document.execCommand('selectAll') } catch { /* 忽略 */ }
      try { document.execCommand('insertText', false, t) } catch { /* 忽略 */ }
    }
    return cnt() >= 1
  }

  async function fillReply(art, t) {
    let ed = findEditor()
    if (!ed && art) {
      const btn = art.querySelector('[data-testid="reply"]')
      if (btn) btn.click()
      for (let i = 0; i < 30 && !ed; i++) { await new Promise((r) => setTimeout(r, 150)); ed = findEditor() }
    }
    if (!ed) return toast('没找到回复框：手动点一下「回复」再试')
    insertText(ed, t)
    chrome.storage.local.get({ used: 0 }, (v) => chrome.storage.local.set({ used: (v.used || 0) + 1 }))
    showBar(ed)
    toast('已填入，确认后自己发')
  }

  /* 候选条：只在"我们刚填过"之后出现，靠定时器定位，不监听 DOM */
  let barTimer = null
  function showBar(ed) {
    hideBar()
    if (!ctx || !ctx.drafts) return
    bar = document.createElement('div'); bar.className = 'xr-bar'
    const label = document.createElement('span'); label.className = 'xr-bar-label'; label.textContent = ctx.meta || '候选'
    const wrap = document.createElement('div'); wrap.className = 'xr-bar-chips'
    for (const d of ctx.drafts.slice(0, 3)) {
      const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'xr-chip'; chip.textContent = d.angle; chip.title = d.text
      chip.addEventListener('click', () => {
        const now = findEditor(); if (!now) return
        now.focus(); document.execCommand('selectAll'); document.execCommand('delete'); insertText(now, d.text)
        toast('已换进回复框')
      })
      wrap.appendChild(chip)
    }
    const x = document.createElement('button'); x.type = 'button'; x.className = 'xr-bar-close'; x.textContent = '✕'; x.addEventListener('click', hideBar)
    bar.append(label, wrap, x)
    document.body.appendChild(bar)
    const place = () => { const e = findEditor(); if (!bar) return; if (!e) return hideBar(); const r = e.getBoundingClientRect(); bar.style.left = Math.max(8, r.left) + 'px'; bar.style.width = Math.min(r.width || 520, window.innerWidth - 24) + 'px'; bar.style.top = Math.max(8, r.top - 44) + 'px' }
    place()
    barTimer = setInterval(place, 900)
  }
  function hideBar() { if (barTimer) { clearInterval(barTimer); barTimer = null } if (bar) { bar.remove(); bar = null } }

  function toast(m) {
    let el = document.querySelector('.xr-toast')
    if (!el) { el = document.createElement('div'); el.className = 'xr-toast'; document.body.appendChild(el) }
    el.textContent = m; el.classList.add('on')
    clearTimeout(el._h); el._h = setTimeout(() => el.classList.remove('on'), 1800)
  }
})()
