import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const m = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'))
let fail = 0
const need = [m.action.default_popup, ...Object.values(m.icons || {})]
for (const cs of m.content_scripts || []) { need.push(...(cs.js || []), ...(cs.css || [])) }
for (const f of need) {
  const ok = existsSync(join(root, f))
  console.log((ok ? 'OK   ' : 'MISS ') + f)
  if (!ok) fail++
}
if (m.manifest_version !== 3) { console.log('FAIL manifest_version'); fail++ }
console.log(fail ? 'FAILED ' + fail : 'MANIFEST OK')
process.exit(fail ? 1 : 0)
