import { clientIp, jsonError, originAllowed, rateLimit, readJson } from '@/lib/ask/guard'
import { rankProjects } from '@/lib/ask/search'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_Q = 200
/** Search is cheap (one small embedding, cached) and filters call it while typing, so it allows more than /api/ask. */
const LIMIT = 60
const WINDOW_MS = 10 * 60 * 1000

/** POST { q } -> { results: [{ id, score }], mode }, every project and role ranked by meaning. */
export async function POST(req: Request) {
  if (!originAllowed(req)) return jsonError(403, 'Not allowed.')
  const body = await readJson(req, 2_000)
  if (typeof body === 'string') return jsonError(400, body)
  const q = (body.value as { q?: unknown } | null)?.q
  if (typeof q !== 'string' || !q.trim()) return jsonError(400, 'Expected { q: string }.')
  if (q.length > MAX_Q) return jsonError(400, `Keep the query under ${MAX_Q} characters.`)

  const rl = rateLimit('search', clientIp(req), LIMIT, WINDOW_MS)
  if (!rl.ok) return jsonError(429, 'Too many searches. Try again in a few minutes.', { 'retry-after': String(rl.retryAfter) })

  const { results, mode } = await rankProjects(q.trim())
  return Response.json({ results, mode }, { headers: { 'cache-control': 'no-store' } })
}

export function GET() {
  return jsonError(405, 'Use POST.', { allow: 'POST' })
}
