/** 极简 i18n：zh / en 两套界面文案；回复语言另由 settings.replyLang 控制 */
(function (root) {
  const DICT = {
    zh: {
      appName: 'X 快速回复',
      panelTitle: '快速回复',
      fill: '填入回复框',
      copy: '复制',
      regen: '换一批',
      copied: '已复制',
      copyFail: '复制失败',
      inserted: '已填入，确认后自己发',
      noTweet: '没找到推文：把页面滚到那条推文上再点',
      noEditor: '没找到回复框：手动点一下「回复」再试',
      replying: '回复',
      localTpl: '本地模板',
      aiReading: 'AI 正在读这条…',
      aiTimeout: 'AI 超时（>9s），先用本地模板',
      aiFail: 'AI 不可用',
      launcherTitle: '快速回复（Alt+R）｜可拖动',
      angleFollow: '接一句',
      anglePush: '顶一句',
      angleOne: '收一句'
    },
    en: {
      appName: 'X Quick Reply',
      panelTitle: 'Quick reply',
      fill: 'Insert',
      copy: 'Copy',
      regen: 'Regenerate',
      copied: 'Copied',
      copyFail: 'Copy failed',
      inserted: 'Inserted — edit and post yourself',
      noTweet: 'No tweet found: scroll one into view and try again',
      noEditor: 'No reply box found: click Reply first',
      replying: 'Replying to',
      localTpl: 'Local templates',
      aiReading: 'Reading this tweet…',
      aiTimeout: 'AI timed out (>9s), using local templates',
      aiFail: 'AI unavailable',
      launcherTitle: 'Quick reply (Alt+R) · draggable',
      angleFollow: 'Follow up',
      anglePush: 'Push back',
      angleOne: 'One-liner'
    }
  }
  function pickLang(setting) {
    if (setting === 'zh' || setting === 'en') return setting
    const nav = (typeof navigator !== 'undefined' && navigator.language) || 'zh'
    return /^zh/i.test(nav) ? 'zh' : 'en'
  }
  function t(key, setting) {
    const lang = pickLang(setting)
    const d = DICT[lang] || DICT.zh
    return d[key] || (DICT.zh[key] || key)
  }
  function angleLabel(angle, setting) {
    const lang = pickLang(setting)
    if (lang === 'zh') return angle
    const map = { '接一句': 'Follow up', '顶一句': 'Push back', '收一句': 'One-liner' }
    return map[angle] || angle
  }
  const api = { t, angleLabel, pickLang, DICT }
  if (typeof module === 'object' && module.exports) module.exports = api
  root.XReplyI18n = api
})(typeof globalThis !== 'undefined' ? globalThis : this)
