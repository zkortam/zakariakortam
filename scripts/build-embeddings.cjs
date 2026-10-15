// Embeds every project and role (src/lib/ask/docs.ts) with the Azure "embed-v-4-0"
// deployment and writes src/knowledge/embeddings.json, so /api/search and /api/ask only
// embed the visitor's query at request time.
//
// Run by hand after changing projects-data.ts or src/knowledge/*.md:
//   node scripts/build-knowledge.mjs && node scripts/build-embeddings.cjs
// It reads AZURE_OPENAI_BASE_URL and AZURE_OPENAI_API_KEY from the environment or .env.local.
// Stale entries are detected at runtime by hash and fall back to keyword scoring.
const { readFileSync, writeFileSync, existsSync } = require('node:fs')
const { join } = require('node:path')
const { createHash } = require('node:crypto')

const root = join(__dirname, '..')
// jiti ships with tailwindcss and eslint; it loads the TypeScript module directly.
const jiti = require('jiti')(__filename, { interopDefault: true })
const { projectDocs } = jiti(join(root, 'src/lib/ask/docs.ts'))

const MODEL = 'embed-v-4-0'
const DIMS = 512

function env(name) {
  if (process.env[name]) return process.env[name]
  const f = join(root, '.env.local')
  if (!existsSync(f)) return undefined
  const line = readFileSync(f, 'utf8').split('\n').find((l) => l.startsWith(name + '='))
  return line?.slice(name.length + 1).replace(/^["']|["']$/g, '')
}

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16)

;(async () => {
  const base = env('AZURE_OPENAI_BASE_URL')
  const key = env('AZURE_OPENAI_API_KEY')
  if (!base || !key) throw new Error('AZURE_OPENAI_BASE_URL and AZURE_OPENAI_API_KEY are required')
  const docs = projectDocs()
  const res = await fetch(`${base.replace(/\/$/, '')}/embeddings`, {
    method: 'POST',
    headers: { 'api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input: docs.map((d) => d.text), dimensions: DIMS, input_type: 'document' }),
  })
  if (!res.ok) throw new Error(`embeddings failed: ${res.status}`)
  const json = await res.json()
  const items = docs.map((d, i) => ({
    id: d.id,
    hash: hash(d.text),
    v: json.data[i].embedding.map((x) => Math.round(x * 1e4) / 1e4),
  }))
  const out = join(root, 'src/knowledge/embeddings.json')
  writeFileSync(out, JSON.stringify({ model: MODEL, dims: DIMS, items }) + '\n')
  console.log(`embeddings: ${items.length} projects, ${DIMS} dims -> src/knowledge/embeddings.json`)
})().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
