'use client'

import { useEffect, useRef, useState } from 'react'
import { Stage, mono, useClock, useLive } from './shared'

/**
 * Real end-to-end encryption, done in this browser with WebCrypto, using the building blocks
 * Surf Messenger is made of: an X25519 key agreement (P-256 where X25519 is unavailable), HKDF,
 * a symmetric ratchet that gives every message its own key, and AES-GCM. The middle lane is
 * exactly what a server would carry.
 */

type Sealed = { from: 'maya' | 'you'; plain: string; ct: string; iv: string; key: string; opened: string }

const SCRIPT: { from: Sealed['from']; text: string }[] = [
  { from: 'maya', text: 'landed, heading to yours' },
  { from: 'you', text: 'perfect, door code is 4417' },
  { from: 'maya', text: 'do you need me to bring anything' },
  { from: 'you', text: 'just yourself, there is food here' },
]
const PER = 3.2 // seconds per message
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

/** Seal the whole conversation: one chain step per message, each message key used once. */
async function sealAll(): Promise<{ msgs: Sealed[]; curve: string }> {
  const s = crypto.subtle
  const { secret, curve } = await agree()
  const ikm = await s.importKey('raw', secret, 'HKDF', false, ['deriveBits'])
  let chain = await s.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: enc.encode('surf-demo-root') }, ikm, 256)
  const msgs: Sealed[] = []
  for (const m of SCRIPT) {
    const mk = await hmac(chain, 1)
    chain = await hmac(chain, 2)
    const key = await s.importKey('raw', mk, 'AES-GCM', false, ['encrypt', 'decrypt'])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ct = await s.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(m.text))
    const opened = dec.decode(await s.decrypt({ name: 'AES-GCM', iv }, key, ct))
    const fp = hex(await s.digest('SHA-256', mk)).slice(0, 8)
    msgs.push({ from: m.from, plain: m.text, ct: b64(ct), iv: b64(iv), key: fp, opened })
  }
  return { msgs, curve }
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function MessengerSeal() {
  const { ref, live, reduced } = useLive<HTMLDivElement>()
  const [data, setData] = useState<{ msgs: Sealed[]; curve: string } | null>(null)
  const [t, setT] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (!live || started.current || !crypto?.subtle) return
    started.current = true
    sealAll().then(setData, () => (started.current = false))
  }, [live])

  useClock(live && !!data && !reduced, (time) => setT(time % (PER * SCRIPT.length + 1.6)))

  const msgs = data?.msgs ?? []
  const shownT = reduced ? PER * SCRIPT.length : t
  const idx = Math.min(SCRIPT.length - 1, Math.floor(shownT / PER))
  const local = (shownT % PER) / PER
  const done = shownT >= PER * SCRIPT.length

  const sent = (i: number) => i < idx || done || (i === idx && local > 0.12)
  const arrived = (i: number) => i < idx || done || (i === idx && local > 0.72)
  const cur = msgs[idx]
  const flying = !done && !!cur && local > 0.12 && local <= 0.72
  const fly = flying ? (local - 0.12) / 0.6 : 0

  // Ciphertext as it crosses: random glyphs settle into the real bytes.
  const shownCt = cur
    ? cur.ct
        .slice(0, 44)
        .split('')
        .map((ch, k) => (flying && k / 44 > fly * 1.4 ? GLYPHS[(k * 31 + Math.floor(shownT * 30)) % GLYPHS.length] : ch))
        .join('')
    : ''

  return (
    <div ref={ref}>
      <Stage
        caption={
          <>
            <span>
              {data
                ? `Encrypted in this tab just now: ${data.curve} key agreement, HKDF, a fresh key per message from a ratchet, AES-256-GCM.`
                : 'Generating keys in this tab.'}
            </span>
            <span>Surf Messenger adds X3DH and the Double Ratchet on top.</span>
          </>
        }
      >
        <div className="ms-grid">
          <Phone who="maya" msgs={msgs} sent={sent} arrived={arrived} />
          <div className="ms-wire">
            <p className="demo-label">What the server sees</p>
            <div className={`ms-packet ${mono.className} ${flying ? 'go' : ''}`} style={{ ['--p' as string]: fly }}>
              {cur ? (
                <>
                  <span className="ms-row">
                    <span>key</span>
                    <span>#{idx + 1} · {cur.key}</span>
                  </span>
                  <span className="ms-row">
                    <span>iv</span>
                    <span>{cur.iv}</span>
                  </span>
                  <span className="ms-ct">{shownCt}…</span>
                </>
              ) : (
                <span className="ms-ct">…</span>
              )}
            </div>
            <div className="ms-track" aria-hidden="true">
              <i style={{ transform: `translateX(${(cur?.from === 'you' ? 1 - fly : fly) * 100}%)`, opacity: flying ? 1 : 0 }} />
            </div>
          </div>
          <Phone who="you" msgs={msgs} sent={sent} arrived={arrived} />
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
}: {
  who: Sealed['from']
  msgs: Sealed[]
  sent: (i: number) => boolean
  arrived: (i: number) => boolean
}) {
  return (
    <div className="ms-phone">
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
      <div className="ms-thread">
        {msgs.map((m, i) => {
          const mine = m.from === who
          const visible = mine ? sent(i) : arrived(i)
          return (
            <div key={i} className={`ms-bubble ${mine ? 'me' : 'them'} ${visible ? 'in' : ''}`}>
              {mine ? m.plain : m.opened}
            </div>
          )
        })}
      </div>
    </div>
  )
}
