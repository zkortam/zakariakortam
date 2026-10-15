import { createHash } from 'node:crypto'
import embeddings from '@/knowledge/embeddings.json'
import { projectDocs } from './docs'

/**
 * Meaning-based ranking of every project and role. Project vectors are precomputed
 * (scripts/build-embeddings.cjs); a request embeds only the query, with an in-memory
 * cache for repeats. If Azure is slow or down, or a project's text changed since the
 * vectors were built, that project is ranked by keywords instead.
 */
type Vec = number[]
type Ranked = { id: string; score: number }

const MODEL = embeddings.model
const DIMS = embeddings.dims

const docs = projectDocs()
const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16)
const vectors = new Map<string, Vec>()
for (const d of docs) {
  const e = embeddings.items.find((x) => x.id === d.id)
  if (e && e.hash === hash(d.text)) vectors.set(d.id, e.v)
  else console.warn(`[search] embedding for "${d.id}" is missing or stale; run scripts/build-embeddings.cjs`)
}

const STOP = new Set(
  'a an and are about any as at be by can could did do does for from has have he her him his how i in is it its me my of on or show tell that the their them this to was what when where which who why with work works you your projects project built build made'.split(' '),
)
const tokens = (s: string) => s.toLowerCase().match(/[a-z0-9+#]+/g)?.filter((t) => t.length > 1 && !STOP.has(t)) ?? []

// Whole-word token sets, so "ai" matches "AI" but not "AiroFind".
const fields = docs.map((d) => {
  const [head, ...rest] = d.text.split('\n')
  const set = (x: string) => new Set(x.toLowerCase().match(/[a-z0-9+#]+/g) ?? [])
  return { id: d.id, title: set(d.title), head: set(`${head} ${rest[0] ?? ''}`), body: set(d.text) }
})

function keywordScores(q: string): Map<string, number> {
  const terms = tokens(q)
  const out = new Map<string, number>()
  if (!terms.length) return out
  // Rarer terms count more (a simple inverse document frequency).
  const idf = new Map(terms.map((t) => [t, Math.log(1 + docs.length / (1 + fields.filter((f) => f.body.has(t)).length))]))
  let max = 0
  for (const f of fields) {
    let s = 0
    for (const t of terms) {
      const w = idf.get(t) ?? 0
      if (f.title.has(t)) s += 3 * w
      else if (f.head.has(t)) s += 2 * w
      else if (f.body.has(t)) s += w
    }
    out.set(f.id, s)
    max = Math.max(max, s)
  }
  if (max > 0) for (const [k, v] of out) out.set(k, v / max)
  return out
}

const cache = new Map<string, Vec>()
const CACHE_MAX = 500

const inflight = new Map<string, Promise<Vec | null>>()

/** One embedding call per distinct query; it finishes and fills the cache even if a caller stopped waiting. */
function fetchEmbedding(key: string, q: string): Promise<Vec | null> {
  const running = inflight.get(key)
  if (running) return running
  const base = process.env.AZURE_OPENAI_BASE_URL
  const apiKey = process.env.AZURE_OPENAI_API_KEY
  if (!base || !apiKey || vectors.size === 0) return Promise.resolve(null)
  const p = (async () => {
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/embeddings`, {
        method: 'POST',
        headers: { 'api-key': apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({ model: MODEL, input: [q], dimensions: DIMS, input_type: 'query' }),
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) {
        console.error('[search] embeddings status', res.status)
        return null
      }
      const v = (await res.json())?.data?.[0]?.embedding
      if (!Array.isArray(v) || v.length !== DIMS) return null
      cache.set(key, v)
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string)
      return v as Vec
    } catch (e) {
      console.error('[search] embeddings failed', (e as Error).name)
      return null
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, p)
  return p
}

/**
 * The query's vector, or null if it is not ready within timeoutMs. Azure's embedding latency
 * varies a lot (about 160 ms warm, seconds when cold), so a slow call falls back to keywords
 * for this request and still lands in the cache for the next one.
 */
async function embedQuery(q: string, timeoutMs: number): Promise<Vec | null> {
  const key = q.trim().toLowerCase()
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<null>((r) => (timer = setTimeout(() => r(null), timeoutMs)))
  try {
    return await Promise.race([fetchEmbedding(key, q), late])
  } finally {
    clearTimeout(timer)
  }
}

function cosine(a: Vec, b: Vec) {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na * nb) || 1)
}

export async function rankProjects(q: string, timeoutMs = 550): Promise<{ results: Ranked[]; mode: 'semantic' | 'keyword' }> {
  const kw = keywordScores(q)
  const qv = await embedQuery(q, timeoutMs)
  const round = (n: number) => Math.round(n * 1e4) / 1e4
  const results = docs.map((d) => {
    const k = kw.get(d.id) ?? 0
    const v = qv && vectors.get(d.id)
    // Cosine carries the meaning; keywords break ties and catch exact names.
    return { id: d.id, score: round(v ? cosine(qv, v) + 0.15 * k : 0.5 * k) }
  })
  results.sort((a, b) => b.score - a.score)
  return { results, mode: qv ? 'semantic' : 'keyword' }
}
