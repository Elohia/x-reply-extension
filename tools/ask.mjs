import fs from 'node:fs'
const [name, a2, a3] = process.argv.slice(2)
let args = {}
if (a2 && a2.startsWith('args:')) args = JSON.parse(fs.readFileSync(a2.slice(5), 'utf8'))
else {
  if (a2) args.pageId = Number(a2)
  if (a3) args.function = a3.startsWith('file:') ? fs.readFileSync(a3.slice(5), 'utf8') : a3
}
const res = await fetch('http://127.0.0.1:9777/rpc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: name, args: args }) })
const js = await res.json()
console.log(js.text !== undefined ? js.text : JSON.stringify(js))
