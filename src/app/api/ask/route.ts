import { systemPrompt } from '@/lib/ask/knowledge'
import { clientIp, jsonError, originAllowed, rateLimit, readJson } from '@/lib/ask/guard'
import { rankProjects } from '@/lib/ask/search'
import { projects } from '@/lib/projects-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_MESSAGES = 8
const MAX_CHARS = 1500
const MAX_BODY_BYTES = 16_000
const MAX_COMPLETION_TOKENS = 220
const UPSTREAM_TIMEOUT_MS = 30_000
const RETRIEVAL_TIMEOUT_MS = 600

/** 12 questions per IP per 10 minutes (see guard.ts for the limits of an in-memory LRU). */
const RATE_LIMIT = 12
const RATE_WINDOW_MS = 10 * 60 * 1000

type Msg = { role: 'user' | 'assistant'; content: string }

const REFUSAL =
  'I can only answer questions about Zakaria’s work and projects. Try asking what he has built, or how one of his projects works.\n\n[All work](/portfolio) · [About](/about)'

function parse(body: unknown): Msg[] | string {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { messages?: unknown }).messages)) {
    return 'Expected { messages: [...] }.'
  }
  const raw = (body as { messages: unknown[] }).messages
  if (raw.length === 0) return 'Ask a question.'
  if (raw.length > MAX_MESSAGES) return `At most ${MAX_MESSAGES} messages per conversation.`
  const out: Msg[] = []
  for (const m of raw) {
    if (!m || typeof m !== 'object') return 'Each message needs a role and content.'
    const { role, content } = m as { role?: unknown; content?: unknown }
    if (role !== 'user' && role !== 'assistant') return 'Role must be user or assistant.'
    if (typeof content !== 'string' || !content.trim()) return 'Messages cannot be empty.'
    if (content.length > MAX_CHARS) return `Keep each message under ${MAX_CHARS} characters.`
    out.push({ role, content: content.trim() })
  }
  if (out[out.length - 1].role !== 'user') return 'The last message must be a question.'
  return out
}

/** House style: no em or en dashes, even if the model slips. */
function clean(s: string): string {
  return s.replace(/(\d)\s*[–—]\s*(\d)/g, '$1 to $2').replace(/\s*[–—]\s*/g, ', ')
}

/** The projects most related to the question, as a hint for which pages to cite and link. */
async function retrievalNote(question: string): Promise<string | null> {
  const { results, mode } = await rankProjects(question, RETRIEVAL_TIMEOUT_MS)
  if (mode !== 'semantic') return null
  const top = results.slice(0, 6).map((r) => {
    const p = projects.find((x) => x.id === r.id)
    return `${p?.org ?? p?.title ?? r.id} (/portfolio/${r.id})`
  })
  return `Search over his projects ranks these as most related to the visitor's latest message, most relevant first: ${top.join(', ')}. Use this to choose which projects to mention and link, but only if they actually answer the question.`
}

const textResponse = (body: BodyInit) =>
  new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  })

export async function POST(req: Request) {
  if (!originAllowed(req)) return jsonError(403, 'Not allowed.')

  // Cerebras first (an answer in about 0.2 s), Azure as the fallback.
  const providers = [
    process.env.CEREBRAS_API_KEY && {
      name: 'cerebras',
      url: 'https://api.cerebras.ai/v1/chat/completions',
      headers: { authorization: `Bearer ${process.env.CEREBRAS_API_KEY}` },
      model: process.env.CEREBRAS_MODEL || 'gpt-oss-120b',
      extra: { reasoning_effort: 'low' },
    },
    process.env.AZURE_OPENAI_BASE_URL &&
      process.env.AZURE_OPENAI_API_KEY &&
      process.env.AZURE_OPENAI_MODEL && {
        name: 'azure',
        url: `${process.env.AZURE_OPENAI_BASE_URL.replace(/\/$/, '')}/chat/completions`,
        headers: { 'api-key': process.env.AZURE_OPENAI_API_KEY },
        model: process.env.AZURE_OPENAI_MODEL,
        // This model reasons by default and reasoning tokens count against the cap; skip it.
        extra: { reasoning_effort: 'none' },
      },
  ].filter(Boolean) as unknown as { name: string; url: string; headers: Record<string, string>; model: string; extra: Record<string, unknown> }[]
  if (!providers.length) return jsonError(503, 'Ask is not available right now.')

  const body = await readJson(req, MAX_BODY_BYTES)
  if (typeof body === 'string') return jsonError(body === 'Expected JSON.' ? 400 : 413, body)
  const messages = parse(body.value)
  if (typeof messages === 'string') return jsonError(400, messages)

  const rl = rateLimit('ask', clientIp(req), RATE_LIMIT, RATE_WINDOW_MS)
  if (!rl.ok) {
    return jsonError(429, 'You have asked a lot in a short time. Try again in a few minutes.', {
      'retry-after': String(rl.retryAfter),
    })
  }

  const note = await retrievalNote(messages[messages.length - 1].content).catch(() => null)
  const system = note ? `${systemPrompt()}\n\n${note}` : systemPrompt()

  const timeout = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
  const signal = AbortSignal.any([timeout, req.signal])

  let upstream: Response | null = null
  let lastErr = ''
  for (const pv of providers) {
    try {
      const r = await fetch(pv.url, {
        method: 'POST',
        headers: { ...pv.headers, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: pv.model,
          messages: [{ role: 'system', content: system }, ...messages],
          stream: true,
          max_completion_tokens: MAX_COMPLETION_TOKENS,
          ...pv.extra,
        }),
        signal,
      })
      // A content-filter refusal is an answer, not an outage: do not fall through.
      if (r.ok || (r.status === 400 && pv.name === 'azure')) {
        upstream = r
        break
      }
      lastErr = `${pv.name} ${r.status}`
      console.error('[ask] provider failed', lastErr)
      upstream = r
    } catch (e) {
      lastErr = `${pv.name} ${timeout.aborted ? 'timeout' : (e as Error).name}`
      console.error('[ask] provider error', lastErr)
      if (timeout.aborted) return jsonError(504, 'The answer took too long. Try again.')
    }
  }
  if (!upstream) return jsonError(502, 'Ask is busy right now. Try again shortly.')
  if (!upstream.ok || !upstream.body) {
    let code = ''
    try {
      code = String((await upstream.json())?.error?.code ?? '')
    } catch {}
    console.error('[ask] upstream status', upstream.status, code)
    // Azure's content filter (including its jailbreak shield) rejects the request itself.
    // Answer like any other off-topic request instead of showing an error.
    if (upstream.status === 400 && /content_filter/i.test(code)) return textResponse(REFUSAL)
    return jsonError(upstream.status === 429 ? 503 : 502, 'Ask is busy right now. Try again shortly.')
  }

  // Read the upstream SSE and forward only the answer text, as a plain text stream.
  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buf = ''

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) {
            controller.close()
            return
          }
          buf += decoder.decode(value, { stream: true })
          let out = ''
          let nl: number
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl).trim()
            buf = buf.slice(nl + 1)
            if (!line.startsWith('data:')) continue
            const data = line.slice(5).trim()
            if (data === '[DONE]') continue
            try {
              const delta = JSON.parse(data)?.choices?.[0]?.delta?.content
              if (typeof delta === 'string') out += delta
            } catch {
              // A malformed event is skipped rather than ending the answer.
            }
          }
          if (out) {
            controller.enqueue(encoder.encode(clean(out)))
            return
          }
        }
      } catch (e) {
        console.error('[ask] stream interrupted', timeout.aborted ? 'timeout' : (e as Error).name)
        controller.enqueue(encoder.encode('\n\n[The answer was cut off. Try asking again.]'))
        controller.close()
      }
    },
    cancel() {
      reader.cancel().catch(() => {})
    },
  })

  return textResponse(stream)
}

export function GET() {
  return jsonError(405, 'Use POST.', { allow: 'POST' })
}
