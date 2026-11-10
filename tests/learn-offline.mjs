import { readFileSync } from 'node:fs'
const el = (o) => Object.assign({
  style: {}, dataset: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){return false} },
  appendChild(){}, append(){}, prepend(){}, remove(){}, addEventListener(){}, removeEventListener(){},
  setAttribute(){}, getAttribute(){ return null }, closest(){ return null }, matches(){ return false },
  querySelector(){ return null }, querySelectorAll(){ return [] },
  getBoundingClientRect(){ return { x:0,y:0,left:0,top:0,right:0,bottom:0,width:0,height:0 } },
  focus(){}, dispatchEvent(){}, scrollIntoView(){}, offsetParent: null, offsetLeft:0, offsetTop:0,
  textContent: '', innerHTML: '', innerText: '',
}, o)
const arts = []
const texts = ['今天又写了三小时，曝光还是个位数', '把 120 万的表压到 8 秒，用了 3 天', '粉丝卡在 300 好几天了', '刚把插件发到 GitHub，等反馈', '试着做了个自动回复，先自己用', '今天不发帖，只回评论']
for (const t of texts) {
  arts.push(el({ querySelector(sel) { if (sel.includes('tweetText')) return { innerText: t }; return null }, querySelectorAll(){ return [] } }))
}
globalThis.window = globalThis
globalThis.addEventListener = () => {}
globalThis.document = {
  body: el({}), documentElement: el(),
  addEventListener(){}, removeEventListener(){}, createElement: () => el({}),
  getElementById(){ return null },
  querySelector(sel) { if (sel.includes('Profile_Link')) return { getAttribute: () => '/ElohiaO_o' }; return null },
  querySelectorAll(sel) { return sel.includes('article') ? arts : [] },
  elementFromPoint(){ return null },
}
globalThis.location = { href: 'https://x.com/ElohiaO_o', pathname: '/ElohiaO_o' }
globalThis.localStorage = { getItem(){ return null }, setItem(){} }
globalThis.sessionStorage = { getItem(){ return null }, setItem(){}, removeItem(){} }
globalThis.setInterval = () => 0
globalThis.setTimeout = (fn) => { fn(); return 0 }
globalThis.clearInterval = () => {}; globalThis.clearTimeout = () => {}
globalThis.requestAnimationFrame = () => {}
globalThis.MutationObserver = class { observe(){} disconnect(){} }
globalThis.scrollBy = () => {}
globalThis.InputEvent = class {}; globalThis.CustomEvent = class {}
let saved = null
globalThis.chrome = {
  runtime: { onMessage: { addListener(){} }, sendMessage(){}, getManifest: () => ({ version: '0.9.4' }) },
  storage: {
    sync: { get(d, fn){ fn(d) } },
    local: { get(d, fn){ fn(d) }, set(o, fn){ saved = Object.assign(saved || {}, o); fn && fn() } },
    session: { get(){ return Promise.resolve({}) }, set(){ return Promise.resolve() }, remove(){ return Promise.resolve() } },
    onChanged: { addListener(){} },
  },
}
globalThis.XReplyStyle = { avoid: [], stats: {}, rules: [], angles: [], examples: [] }
new Function(readFileSync('D:/dsh/x-reply-extension/src/gen.js','utf8'))()
new Function(readFileSync('D:/dsh/x-reply-extension/src/content.js','utf8'))()
// 直接调内部函数不行，走事件钩子
let learnResult = null
globalThis.document.dispatchEvent = (e) => {
  if (e && e.type === 'xr:learn') { globalThis.__fire = true }
}
console.log('init ok')
