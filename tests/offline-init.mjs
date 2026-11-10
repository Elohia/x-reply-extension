import { readFileSync } from 'node:fs'
const listeners = []
const el = () => ({
  id: '', className: '', style: {}, dataset: {}, title: '', type: '',
  textContent: '', innerHTML: '', offsetParent: null, offsetLeft: 0, offsetTop: 0,
  classList: { add() {}, remove() {}, toggle() {}, contains() { return false } },
  appendChild() {}, append() {}, prepend() {}, remove() {}, addEventListener() {},
  setAttribute() {}, getAttribute() { return null }, closest() { return null },
  querySelector() { return null }, querySelectorAll() { return [] },
  getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 } },
  matches() { return false }, focus() {}, dispatchEvent() {}, scrollIntoView() {},
})
globalThis.window = globalThis
globalThis.addEventListener = () => {}
globalThis.removeEventListener = () => {}
globalThis.innerWidth = 1400
globalThis.innerHeight = 900
globalThis.getSelection = () => ({ removeAllRanges() {}, addRange() {} })
globalThis.document = {
  body: el(), documentElement: el(), activeElement: null,
  addEventListener(t, f) { listeners.push([t, f]) },
  removeEventListener() {}, createElement: el, getElementById() { return null },
  querySelector() { return null }, querySelectorAll() { return [] }, elementFromPoint() { return null },
}
globalThis.location = { href: 'https://x.com/home', pathname: '/home' }
globalThis.localStorage = { getItem() { return null }, setItem() {}, removeItem() {} }
globalThis.sessionStorage = { getItem() { return null }, setItem() {}, removeItem() {} }
globalThis.setInterval = () => 0
globalThis.setTimeout = (fn) => { try { fn() } catch (e) { console.log('TIMER_THROW:', e.message) } return 0 }
globalThis.clearInterval = () => {}
globalThis.clearTimeout = () => {}
globalThis.requestAnimationFrame = (fn) => { try { fn() } catch {} }
globalThis.MutationObserver = class { observe() {} disconnect() {} }
globalThis.InputEvent = class { constructor(t, o) { Object.assign(this, o) } }
globalThis.CustomEvent = class { constructor(t, o) { Object.assign(this, o) } }
const store = {}
globalThis.chrome = {
  runtime: { onMessage: { addListener(fn) { globalThis.__listener = fn } }, sendMessage() {}, getManifest: () => ({ version: '0.9.3' }) },
  storage: {
    sync: { get(d, fn) { fn(d) } },
    local: { get(d, fn) { fn(d) }, set(o, fn) { Object.assign(store, o); fn && fn() } },
    session: { get() { return Promise.resolve({}) }, set() { return Promise.resolve() }, remove() { return Promise.resolve() } },
    onChanged: { addListener() {} },
  },
}
globalThis.XReplyStyle = { avoid: [], stats: {}, rules: [], angles: [], examples: [] }
try {
  new Function(readFileSync('D:/dsh/x-reply-extension/src/gen.js', 'utf8'))()
  new Function(readFileSync('D:/dsh/x-reply-extension/src/content.js', 'utf8'))()
  console.log('INIT OK, listener =', typeof globalThis.__listener)
  if (globalThis.__listener) {
    let got = null
    globalThis.__listener({ type: 'xr:ping' }, {}, (r) => { got = r })
    console.log('PING =', JSON.stringify(got))
  }
} catch (e) {
  console.log('INIT THROW =', e && e.message)
}
