import { clientIp, jsonError, originAllowed, rateLimit } from '@/lib/ask/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** About 30 seconds of Opus or AAC; the client stops recording well before this. */
const MAX_BYTES = 1_500_000
const UPSTREAM_TIMEOUT_MS = 20_000
/** 12 recordings per IP per 10 minutes, the same budget as questions. */
const RATE_LIMIT = 12
const RATE_WINDOW_MS = 10 * 60 * 1000

const EXT: Record<string, string> = { 'audio/webm': 'webm', 'audio/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-m4a': 'm4a', 'audio/aac': 'm4a' }

/** Voice input for Ask: a short recording in, its text out (Azure OpenAI Whisper). */
export async function POST(req: Request) {
  if (!originAllowed(req)) return jsonError(403, 'Not allowed.')
  const base = process.env.AZURE_OPENAI_BASE_URL
  const key = process.env.AZURE_OPENAI_API_KEY
  const deployment = process.env.AZURE_OPENAI_WHISPER || 'whisper'
  if (!base || !key) return jsonError(503, 'Voice input is not available right now.')

  const limited = rateLimit('transcribe', clientIp(req), RATE_LIMIT, RATE_WINDOW_MS)
  if (!limited.ok) return jsonError(429, 'Too many recordings. Try again in a few minutes.', { 'retry-after': String(limited.retryAfter) })

  const type = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  const ext = EXT[type]
  if (!ext) return jsonError(415, 'Unsupported audio format.')
  const len = Number(req.headers.get('content-length') || 0)
  if (len > MAX_BYTES) return jsonError(413, 'That recording is too long.')
  const audio = await req.arrayBuffer()
  if (audio.byteLength > MAX_BYTES) return jsonError(413, 'That recording is too long.')
  if (audio.byteLength < 800) return jsonError(400, 'I did not catch that.')

  // The resource's v1 base, back to its endpoint: Whisper is served on the deployments path.
  const endpoint = base.replace(/\/openai\/v1\/?$/, '').replace(/\/$/, '')
  const form = new FormData()
  form.append('file', new Blob([audio], { type }), `voice.${ext}`)
  form.append('response_format', 'json')

  try {
    const r = await fetch(`${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/audio/transcriptions?api-version=2024-06-01`, {
      method: 'POST',
      headers: { 'api-key': key },
      body: form,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
    if (!r.ok) return jsonError(502, 'I could not hear that. Try again or type it.')
    const { text } = (await r.json()) as { text?: string }
    return Response.json({ text: (text || '').trim().slice(0, 1500) }, { headers: { 'cache-control': 'no-store' } })
  } catch {
    return jsonError(504, 'I could not hear that. Try again or type it.')
  }
}
