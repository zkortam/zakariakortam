/**
 * Request guards shared by /api/ask and /api/search: origin check and per-IP rate limit.
 *
 * Rate limit: a fixed window per IP and bucket, kept in an in-memory LRU.
 * Limits of this approach, accepted for a portfolio:
 * - State lives in one server instance. Vercel may run several instances and recycles
 *   them, so the real ceiling is the limit per instance, and a cold start resets it.
 * - The IP comes from x-forwarded-for, which Vercel sets; self-hosted behind another
 *   proxy it could be spoofed.
 * - The LRU holds at most LRU_MAX keys; under a flood of distinct IPs old entries are
 *   evicted early. The Azure deployment's own quota is the hard backstop on cost.
 */
const LRU_MAX = 5000
const hits = new Map<string, { count: number; reset: number }>()

export function rateLimit(
  bucket: string,
  ip: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfter: number } {
  const key = `${bucket}:${ip}`
  const now = Date.now()
  let e = hits.get(key)
  if (e && now >= e.reset) e = undefined
  if (!e) e = { count: 0, reset: now + windowMs }
  hits.delete(key) // re-insert so Map order tracks recency
  hits.set(key, e)
  if (hits.size > LRU_MAX) hits.delete(hits.keys().next().value as string)
  if (e.count >= limit) return { ok: false, retryAfter: Math.ceil((e.reset - now) / 1000) }
  e.count++
  return { ok: true }
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
}

/** Origins allowed in production, besides the request's own host. */
const SITE_ORIGINS = new Set(['https://zakariakortam.com', 'https://www.zakariakortam.com'])

/**
 * In production only the site itself may call these routes. A browser always sends Origin
 * on a cross-site POST, so this stops other sites from spending the quota through their
 * visitors. It does not stop a script that forges headers; the rate limit covers that.
 * Same-host requests are allowed so Vercel previews work without a list of preview URLs.
 */
export function originAllowed(req: Request): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  const origin = req.headers.get('origin')
  if (!origin) return false
  if (SITE_ORIGINS.has(origin)) return true
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  try {
    return !!host && new URL(origin).host === host
  } catch {
    return false
  }
}

export function jsonError(status: number, error: string, headers: Record<string, string> = {}) {
  return Response.json({ error }, { status, headers: { 'cache-control': 'no-store', ...headers } })
}

/** Reads a JSON body with a byte cap. Returns a string on failure. */
export async function readJson(req: Request, maxBytes: number): Promise<{ value: unknown } | string> {
  if (Number(req.headers.get('content-length') || 0) > maxBytes) return 'That is too long.'
  try {
    const text = await req.text()
    if (text.length > maxBytes) return 'That is too long.'
    return { value: JSON.parse(text) }
  } catch {
    return 'Expected JSON.'
  }
}
