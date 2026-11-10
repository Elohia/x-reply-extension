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
  const DEFAULTS = { enabled: true, tone: 'direct', length: 'short', aiEnabled: false, autoOpen: true }
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

  let replyTarget = null // 你自己点了"回复"的那条推文

  // 记录点击：只认"回复"按钮（passive，不阻止默认行为）
  document.addEventListener('click', (e) => {
    if (!settings.enabled) return
    const btn = e.target && e.target.closest && e.target.closest('[data-testid="reply"]')
    if (!btn) return
    const art = btn.closest('article[data-testid="tweet"]')
    if (!art) return
    replyTarget = art
    lastHover = art
    const tweet = textOf(art)
    const who = authorOf(art)
    if (!tweet) return
    try { sessionStorage.setItem('xr:reply', JSON.stringify({ tweet, who, at: Date.now() })) } catch { /* 忽略 */ }
    // 等回复框挂上来再弹（X 的回复框有时是弹窗、有时整页跳）
    if (settings.autoOpen) setTimeout(() => showCandidatesFor(art, tweet, who), 500)
  }, { capture: true, passive: true })

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
    launcher.title = '快速回复（Alt+R）｜可拖动'
    launcher.innerHTML =
      '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
      '<path fill="currentColor" d="M4 3.5h16a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 20 17.5H10.2l-4.1 3.2c-.7.5-1.6 0-1.6-.8v-2.4H4A2.5 2.5 0 0 1 1.5 15V6A2.5 2.5 0 0 1 4 3.5Z"/>' +
      '<path fill="#15202b" d="M7 8.2h6.2v1.9H7zM7 11.4h4.1v1.9H7z"/>' +
      '<path fill="#15202b" d="M15.2 8.2h2.6l-2.1 2.6h2.3l-3.4 4 .8-3h-2z"/>' +
      '</svg>'
    // 拖拽移动，位置记在本地
    try {
      const saved = JSON.parse(localStorage.getItem('xr:launcherPos') || 'null')
      if (saved) { launcher.style.right = 'auto'; launcher.style.bottom = 'auto'; launcher.style.left = saved.x + 'px'; launcher.style.top = saved.y + 'px' }
    } catch { /* 忽略 */ }
    let drag = null
    launcher.addEventListener('mousedown', (e) => { drag = { x: e.clientX, y: e.clientY, left: launcher.offsetLeft, top: launcher.offsetTop }; e.preventDefault() })
    window.addEventListener('mousemove', (e) => {
      if (!drag || !launcher) return
      launcher.style.right = 'auto'; launcher.style.bottom = 'auto'
      launcher.style.left = Math.max(0, Math.min(window.innerWidth - 50, drag.left + (e.clientX - drag.x))) + 'px'
      launcher.style.top = Math.max(0, Math.min(window.innerHeight - 50, drag.top + (e.clientY - drag.y))) + 'px'
    })
    window.addEventListener('mouseup', () => {
      if (!drag || !launcher) { drag = null; return }
      try { localStorage.setItem('xr:launcherPos', JSON.stringify({ x: launcher.offsetLeft, y: launcher.offsetTop })) } catch { /* 忽略 */ }
      drag = null
    })
    launcher.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openPanel() })
    document.body.appendChild(launcher)
  }
  function unmount() {
    if (launcher) { launcher.remove(); launcher = null }
    closePanel(); hideBar()
  }

  /** 找"当前这条推文"：URL 是推文页 → 它；否则用鼠标最后停住的那条；再否则用视口中心那条 */
  function currentTweet() {
    // ① 你刚点了某条推文的"回复"：就是它
    if (replyTarget && replyTarget.isConnected) return replyTarget
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

  /** 点推文「回复」后：生成三条 → 贴在回复框上方（不遮挡输入） */
  async function showCandidatesFor(art, tweet, who) {
    if (panel) closePanel()
    const local = GEN.drafts({ text: tweet }, { tone: settings.tone, length: settings.length })
    ctx = { art, drafts: local, meta: '本地模板', analysis: '' }
    let ed = null
    for (let i = 0; i < 30 && !ed; i++) { await new Promise((r) => setTimeout(r, 150)); ed = findEditor() }
    if (!ed) return
    showBar(ed)

    if (!settings.aiEnabled) return
    const res = await new Promise((resolve) => {
      try { chrome.runtime.sendMessage({ type: 'ai:gen', tweet, author: who }, resolve) } catch { resolve(null) }
    })
    if (!res || !res.ok || !bar) return
    ctx = { art, drafts: res.drafts, meta: 'AI · ' + res.model + ' · ' + res.ms + 'ms', analysis: res.analysis }
    showBar(findEditor() || ed)
  }

  function openPanel(explicit) {
    const ctxIn = explicit && explicit.tweet ? explicit : null
    closePanel()
    const art = ctxIn ? ctxIn.art : currentTweet()
    const tweet = ctxIn ? ctxIn.tweet : textOf(art)
    if (!tweet) return toast('没找到推文：把页面滚到那条推文上再点')
    const who = ctxIn ? ctxIn.who : authorOf(art)

    panel = document.createElement('div')
    panel.className = 'xr-panel'
    const head = document.createElement('header')
    const b = document.createElement('b'); b.textContent = '快速回复'
    const isReplying = replyTarget === art
    const sub = document.createElement('span'); sub.style.cssText = 'opacity:.6;font-size:11px'
    sub.textContent = (isReplying ? '回复 ' : '') + who
    const collapse = document.createElement('button'); collapse.className = 'xr-close'; collapse.type = 'button'; collapse.textContent = '—'; collapse.title = '收起'
    collapse.addEventListener('click', () => { panel.classList.toggle('xr-collapsed'); placePanel() })
    const close = document.createElement('button'); close.className = 'xr-close'; close.type = 'button'; close.textContent = '✕'
    close.addEventListener('click', closePanel)
    head.append(b, sub, collapse, close)
    // 拖动：按住标题栏移动
    let drag = null
    head.style.cursor = 'move'
    head.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return
      drag = { x: e.clientX, y: e.clientY, left: panel.offsetLeft, top: panel.offsetTop }
      e.preventDefault()
    })
    window.addEventListener('mousemove', (e) => {
      if (!drag || !panel) return
      panel.style.left = Math.max(0, drag.left + (e.clientX - drag.x)) + 'px'
      panel.style.top = Math.max(0, drag.top + (e.clientY - drag.y)) + 'px'
    })
    window.addEventListener('mouseup', () => { drag = null })
    const orig = document.createElement('div'); orig.className = 'xr-orig'; orig.textContent = tweet
    const body = document.createElement('div'); body.className = 'xr-body'
    panel.append(head, orig, body)
    document.body.appendChild(panel)
    placePanel()
    render(body, art, tweet, who)
    requestAnimationFrame(placePanel)
  }

  /** 面板定位：优先贴右侧；如果会和回复框重叠，就挪到回复框左边；都不行就贴底 */
  function placePanel() {
    if (!panel) return
    const W = Math.min(400, window.innerWidth - 24)
    const H = Math.min(panel.offsetHeight || 520, window.innerHeight - 24)
    const ed = findEditor()
    const er = ed ? ed.getBoundingClientRect() : null
    const pad = 12
    let left = window.innerWidth - W - 16
    let top = Math.min(Math.max(pad, window.innerHeight - H - 80), window.innerHeight - H - pad)
    if (er) {
      const overlaps = (x, y) => !(x + W < er.left || x > er.right || y + H < er.top || y > er.bottom)
      if (overlaps(left, top)) {
        const leftAlt = Math.max(pad, er.left - W - 12)
        if (leftAlt > pad) left = leftAlt
        else { left = Math.max(pad, Math.min(er.left, window.innerWidth - W - pad)); top = Math.max(pad, Math.min(window.innerHeight - H - pad, er.bottom + 8)) }
      }
    }
    panel.style.left = Math.round(left) + 'px'
    panel.style.top = Math.round(top) + 'px'
    panel.style.width = W + 'px'
    panel.style.maxHeight = (window.innerHeight - 24) + 'px'
    panel.dataset.xrPlaced = '1'
  }

  function render(body, art, tweet, who) {
    body.innerHTML = ''
    // ① 先立刻给三条本地草稿：永远不出现"空面板"
    const local = GEN.drafts({ text: tweet }, { tone: settings.tone, length: settings.length })
    ctx = { art, drafts: local, meta: '本地模板', analysis: '' }
    items(body, local, { notice: '本地模板（等 AI 时可以先看这个）', regen: () => render(body, art, tweet, who) })

    if (!settings.aiEnabled) return

    // ② 再异步换成 AI 版本；失败就保留本地，并把原因写在顶部
    const strip = document.createElement('div')
    strip.className = 'xr-loading'
    strip.textContent = 'AI 正在读这条…'
    body.prepend(strip)
    let done = false
    const timer = setTimeout(() => {
      if (done) return
      strip.textContent = 'AI 超时（>9s），先用本地模板；点「换一批」可重试'
    }, 9000)

    const finish = (res) => {
      done = true
      clearTimeout(timer)
      if (!res || !res.ok) {
        strip.textContent = 'AI 不可用：' + ((res && res.error) || '后台没响应') + '（已用本地模板）'
        return
      }
      strip.remove()
      ctx = { art, drafts: res.drafts, meta: 'AI · ' + res.model + ' · ' + res.ms + 'ms · ' + (res.tokens || 0) + ' tokens', analysis: res.analysis }
      items(body, res.drafts, { analysis: res.analysis, meta: ctx.meta, regen: () => render(body, art, tweet, who) })
    }

    try {
      chrome.runtime.sendMessage({ type: 'ai:gen', tweet, author: who }, (res) => {
        if (chrome.runtime.lastError) return finish(null)
        finish(res)
      })
    } catch (e) {
      finish(null)
    }
  }

  const dePlaceholder = (t) => String(t || '')
    .replace(/【[^】]*】/g, '你那边')
    .replace(/\s+/g, ' ')
    .replace(/，{2,}/g, '，')
    .trim()

  function items(body, drafts, o) {
    body.innerHTML = ''
    drafts = drafts.map((d) => ({ angle: d.angle, text: dePlaceholder(d.text) }))
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

  function isPageComposer(e) {
    // 首页顶部"有什么新鲜事"的发帖框：aria-label 是"帖子文本"，别拿它当回复框
    const label = e.getAttribute('aria-label') || ''
    return label === '帖子文本' || label === 'Post text'
  }
  function findEditor() {
    const vis = (e) => e && e.offsetParent !== null
    const ok = (e) => e && vis(e) && !isPageComposer(e)
    const ae = document.activeElement
    if (ae && ae.getAttribute && ae.getAttribute('contenteditable') === 'true' && ok(ae) && (ae.getAttribute('data-testid') || '').startsWith('tweetTextarea_')) return ae
    const inDialog = Array.from(document.querySelectorAll('[role="dialog"] [data-testid="tweetTextarea_0"]')).filter(vis)
    if (inDialog.length) return inDialog[inDialog.length - 1]
    const all = Array.from(document.querySelectorAll('[data-testid="tweetTextarea_0"]')).filter(ok)
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
    const label = document.createElement('span'); label.className = 'xr-bar-label'
    label.textContent = (replyTarget ? '回复 ' + authorOf(replyTarget) + ' · ' : '') + (ctx.meta || '候选')
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
    const place = () => {
      const e = findEditor(); if (!bar) return; if (!e) return hideBar()
      const r = e.getBoundingClientRect()
      const top = r.top - 46
      bar.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 420)) + 'px'
      bar.style.width = Math.min(r.width || 520, window.innerWidth - 24) + 'px'
      bar.style.top = (top < 8 ? r.bottom + 8 : top) + 'px'
    }
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
