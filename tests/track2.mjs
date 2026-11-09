const port = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pages = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).filter((p) => p.type === 'page')
const page = pages.find((p) => /x\.com/.test(p.url)) || pages[0]
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p) => new Promise((res) => { const i = ++seq; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({}) } }, 12000) })
const ev = async (x) => { const o = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (o.result && o.result.exceptionDetails) return 'exc'; return o.result && o.result.result ? o.result.result.value : o.result }
await send('Runtime.enable'); await send('Network.enable'); await send('Page.enable')
console.log('url:', await ev('location.href'))
console.log('has login link:', await ev('!!document.querySelector(\'a[href="/login"]\')'))
// 重新注入 cookie 再进 home
for (const c of [{ name: 'auth_token', value: process.env.TWITTER_AUTH_TOKEN }, { name: 'ct0', value: process.env.TWITTER_CT0 }]) {
  if (c.value) await send('Network.setCookie', { name: c.name, value: c.value, domain: '.x.com', path: '/', secure: true, httpOnly: c.name === 'auth_token', sameSite: 'None' })
}
await send('Page.navigate', { url: 'https://x.com/home' })
for (let i = 0; i < 30; i++) { const n = await ev('document.querySelectorAll(\'article[data-testid="tweet"]\').length'); if (n > 1) break; await sleep(900) }
console.log('tweets:', await ev('document.querySelectorAll(\'article[data-testid="tweet"]\').length'))
const who = await ev(String.raw`(() => {
  const arts = [...document.querySelectorAll('article[data-testid="tweet"]')];
  if (arts.length < 2) return { err: 'not enough tweets' };
  const art = arts[1];
  const name = ((art.querySelector('[data-testid="User-Name"]')||{}).innerText || '').split('\n')[0];
  const txt = ((art.querySelector('[data-testid="tweetText"]')||{}).innerText || '').slice(0, 40);
  const btn = art.querySelector('[data-testid="reply"]');
  if (btn) btn.click();
  return { name, txt };
})()`)
console.log('点了回复:', JSON.stringify(who))
await sleep(1800)
await ev('document.getElementById("xr-launcher").click()')
await sleep(1000)
console.log('面板:', JSON.stringify(await ev('(() => { const p = document.querySelector(".xr-panel"); if (!p) return null; return { sub: (p.querySelector("header span")||{}).textContent, orig: (p.querySelector(".xr-orig")||{}).textContent.slice(0,40), items: p.querySelectorAll(".xr-item").length, first: (p.querySelector(".xr-item textarea")||{}).value } })()')))
ws.close(); process.exit(0)
