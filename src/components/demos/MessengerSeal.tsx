'use client'

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Stage, mono, useClock, useLive } from './shared'

/**
 * Real end-to-end encryption, done in this browser with WebCrypto, using the building blocks
 * Surf Messenger is made of: an X25519 key agreement (P-256 where X25519 is unavailable), HKDF,
 * a symmetric ratchet that gives every message its own key, and AES-GCM. The middle lane is
 * exactly what a server would carry. The visitor's own messages go through the same chain.
 */

type From = 'maya' | 'you'
type Sealed = { id: number; from: From; plain: string; ct: string; iv: string; key: string; opened: string; bytes: number; start: number; scripted?: boolean }

const SCRIPT: { from: From; text: string }[] = [
  { from: 'maya', text: 'landed, heading to yours' },
  { from: 'you', text: 'perfect, door code is 4417' },
  { from: 'maya', text: 'do you need me to bring anything' },
  { from: 'you', text: 'just yourself, there is food here' },
]
const PER = 3.2 // seconds per message
const SEND = 0.12 // share of PER before the bubble leaves the sender
const LAND = 0.72 // share of PER when it is opened on the other phone
const MAX = 140
const enc = new TextEncoder()
const dec = new TextDecoder()
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b as ArrayBuffer)))
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')

async function agree(): Promise<{ secret: ArrayBuffer; curve: string }> {
  const s = crypto.subtle
  try {
    const a = (await s.generateKey({ name: 'X25519' }, false, ['deriveBits'])) as CryptoKeyPair
    const b = (await s.generateKey({ name: 'X25519' }, false, ['deriveBits'])) as CryptoKeyPair
    const secret = await s.deriveBits({ name: 'X25519', public: b.publicKey }, a.privateKey, 256)
    return { secret, curve: 'X25519' }
  } catch {
    const p = { name: 'ECDH', namedCurve: 'P-256' } as const
    const a = await s.generateKey(p, false, ['deriveBits'])
    const b = await s.generateKey(p, false, ['deriveBits'])
    const secret = await s.deriveBits({ name: 'ECDH', public: b.publicKey }, a.privateKey, 256)
    return { secret, curve: 'P-256' }
  }
}

async function hmac(key: ArrayBuffer, byte: number) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, new Uint8Array([byte]))
}

/** The sending chain: every message advances it once and gets a key that is used once. */
class Chain {
  private constructor(private ck: ArrayBuffer) {}
  static async open() {
    const { secret, curve } = await agree()
    const ikm = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits'])
    const ck = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: enc.encode('surf-demo-root') }, ikm, 256)
    return { chain: new Chain(ck), curve }
  }
  private queue: Promise<unknown> = Promise.resolve()
  /** Seal one message, then open it from the ciphertext alone with the same message key. */
  seal(text: string) {
    const run = this.queue.then(async () => {
      const s = crypto.subtle
      const mk = await hmac(this.ck, 1)
      this.ck = await hmac(this.ck, 2)
      const key = await s.importKey('raw', mk, 'AES-GCM', false, ['encrypt', 'decrypt'])
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const ct = await s.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text))
      const opened = dec.decode(await s.decrypt({ name: 'AES-GCM', iv }, key, ct))
      const fp = hex(await s.digest('SHA-256', mk)).slice(0, 8)
      return { ct: b64(ct), iv: b64(iv), key: fp, opened, bytes: ct.byteLength }
    })
    this.queue = run.catch(() => undefined)
    return run
  }
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function MessengerSeal() {
  const { ref, live, near, reduced } = useLive<HTMLDivElement>()
  const chain = useRef<Chain | null>(null)
  const [curve, setCurve] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Sealed[]>([])
  const [now, setNow] = useState(0)
  const [draft, setDraft] = useState('')
  const nextId = useRef(0)
  const started = useRef(false)

  // Keys are made, and the opening conversation sealed, as the demo comes near.
  useEffect(() => {
    if (!near || started.current || !globalThis.crypto?.subtle) return
    started.current = true
    ;(async () => {
      const { chain: c, curve: cv } = await Chain.open()
      chain.current = c
      const sealed: Sealed[] = []
      for (const [i, m] of SCRIPT.entries()) sealed.push({ id: nextId.current++, from: m.from, plain: m.text, start: 0.4 + i * PER, scripted: true, ...(await c.seal(m.text)) })
      setMsgs(sealed)
      setCurve(cv)
    })().catch(() => (started.current = false))
  }, [near])

  const last = msgs[msgs.length - 1]
  const settled = !last || now > last.start + PER
  useClock(live && !!curve && !reduced && !settled, (_, dt) => setNow((v) => v + dt))
  const t = reduced ? Infinity : now

  const send = async (e: FormEvent) => {
    e.preventDefault()
    const text = draft.trim().slice(0, MAX)
    if (!text || !chain.current) return
    setDraft('')
    const sealed = await chain.current.seal(text)
    setMsgs((list) => {
      // The opening conversation steps aside: anything of it still to come lands at once.
      const done = list.map((m) => (m.scripted && m.start > now - PER ? { ...m, start: now - PER - 0.01 } : m))
      const prev = done.filter((m) => !m.scripted).pop()
      const start = Math.max(now, prev ? prev.start + PER * 0.8 : now)
      return [...done, { id: nextId.current++, from: 'you', plain: text, start, ...sealed }]
    })
  }

  const phase = (m: Sealed) => (t - m.start) / PER
  const sent = (m: Sealed) => phase(m) > SEND
  const arrived = (m: Sealed) => phase(m) > LAND

  // The lane shows the newest message that has left its phone.
  const cur = [...msgs].reverse().find((m) => phase(m) > SEND) ?? null
  const p = cur ? phase(cur) : 0
  const flying = !!cur && p > SEND && p <= LAND
  const fly = flying ? (p - SEND) / (LAND - SEND) : 0
  const shownCt = cur
    ? cur.ct
        .slice(0, 96)
        .split('')
        .map((ch, k, all) => (flying && k / all.length > fly * 1.4 ? GLYPHS[(k * 31 + Math.floor(t * 30)) % GLYPHS.length] : ch))
        .join('')
    : ''
  const index = cur ? msgs.indexOf(cur) + 1 : 0

  return (
    <div ref={ref}>
      <Stage
        caption={
          <>
            <span>
              {curve
                ? `Encrypted in this tab just now: ${curve} key agreement, HKDF, a fresh key per message from a ratchet, AES-256-GCM.`
                : 'Generating keys in this tab.'}
            </span>
            <span>Surf Messenger adds X3DH and the Double Ratchet on top.</span>
          </>
        }
      >
        <div className="ms-grid">
          <Phone who="maya" msgs={msgs} sent={sent} arrived={arrived} />
          <div className="ms-wire" aria-live="polite">
            <p className="demo-label">What the server sees</p>
            <div className={`ms-packet ${mono.className} ${flying ? 'go' : ''}`}>
              {cur ? (
                <>
                  <span className="ms-row">
                    <span>key</span>
                    <span>
                      #{index} · {cur.key}
                    </span>
                  </span>
                  <span className="ms-row">
                    <span>iv</span>
                    <span>{cur.iv}</span>
                  </span>
                  <span className="ms-row">
                    <span>size</span>
                    <span>
                      {cur.bytes} bytes, {cur.bytes - 16} of text and a 16 byte tag
                    </span>
                  </span>
                  <span className="ms-ct">
                    {shownCt}
                    {cur.ct.length > 96 ? '…' : ''}
                  </span>
                </>
              ) : (
                <span className="ms-ct">{curve ? 'Nothing sent yet' : 'Generating keys'}</span>
              )}
            </div>
            <div className="ms-track" aria-hidden="true">
              <i style={{ transform: `translateX(${(cur?.from === 'you' ? 1 - fly : fly) * 100}%)`, opacity: flying ? 1 : 0 }} />
            </div>
          </div>
          <Phone who="you" msgs={msgs} sent={sent} arrived={arrived}>
            <form className="ms-compose" onSubmit={send}>
              <input
                className="ms-in"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={MAX}
                placeholder={curve ? 'Message Maya' : 'Generating keys'}
                disabled={!curve}
                aria-label="Write a message to Maya. It is encrypted in this tab before it is sent."
                enterKeyHint="send"
                autoComplete="off"
              />
              <button type="submit" className="ms-send" disabled={!curve || !draft.trim()} aria-label="Send">
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                  <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </form>
          </Phone>
        </div>
      </Stage>
    </div>
  )
}

function Phone({
  who,
  msgs,
  sent,
  arrived,
  children,
}: {
  who: From
  msgs: Sealed[]
  sent: (m: Sealed) => boolean
  arrived: (m: Sealed) => boolean
  children?: React.ReactNode
}) {
  const thread = useRef<HTMLDivElement>(null)
  const visible = msgs.filter((m) => (m.from === who ? sent(m) : arrived(m))).length
  useLayoutEffect(() => {
    const el = thread.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: visible > 4 ? 'smooth' : 'auto' })
  }, [visible])
  return (
    <div className="ms-phone" aria-label={who === 'you' ? 'Your phone' : 'Maya’s phone'} role="group">
      <div className="ms-bar">
        <span className="ms-dot" />
        <span>{who === 'you' ? 'Maya' : 'You'}</span>
        <span className="ms-lock" aria-hidden="true">
          <svg viewBox="0 0 12 14" width="11" height="13">
            <path d="M3 6V4a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <rect x="1.5" y="6" width="9" height="7" rx="1.6" fill="currentColor" />
          </svg>
        </span>
      </div>
      <div className="ms-thread" ref={thread}>
        {msgs
          .filter((m) => (m.from === who ? sent(m) : arrived(m)))
          .map((m) => (
            <div key={m.id} className={`ms-bubble ${m.from === who ? 'me' : 'them'}`}>
              {m.from === who ? m.plain : m.opened}
            </div>
          ))}
      </div>
      {children}
    </div>
  )
}
