'use client'

import { Inter } from 'next/font/google'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Stage, mono, useLive } from './shared'
import './messenger.css'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

/*
 * Surf Messenger's thread with Maya, ported from SurfWebsite/app/messenger/screens.tsx (ScreenThread),
 * which is drawn from SurfVersion4's own components: chat-header.tsx, bubble-content.tsx +
 * lib/styles/chat-bubble.ts, bubble-time-status.tsx and message-input.tsx, in the dark theme at the
 * app's 390px width, inside SurfWebsite's Device (components/device.tsx, device-metrics.ts). Icons
 * are Phosphor's own paths (regular unless noted), copied rather than imported.
 *
 * What you send is sealed here exactly as SurfVersion4/lib/crypto does it, with WebCrypto in place of
 * noble: a sending chain from KDF_RK (HKDF, info "SurfRatchetRoot") over an X25519 agreement, then
 * per message mk = HMAC(ck, 0x01), ck = HMAC(ck, 0x02) (chain-kdf.ts), the AES-256-GCM key and IV both
 * expanded from mk (HKDF, info "SurfChainMsg", 44 bytes), the header bound in as AAD
 * (double-ratchet.ts). The lane is the E2EEEnvelopeV2 the server stores (wire.ts, session-manager.ts
 * encrypt()), and Maya's side opens it with her own key.
 */

/* ── icons (@phosphor-icons/react 2.1.10, dist/defs) ── */

const ICON = {
  caretLeft: 'M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z',
  phone:
    'M222.37,158.46l-47.11-21.11-.13-.06a16,16,0,0,0-15.17,1.4,8.12,8.12,0,0,0-.75.56L134.87,160c-15.42-7.49-31.34-23.29-38.83-38.51l20.78-24.71c.2-.25.39-.5.57-.77a16,16,0,0,0,1.32-15.06l0-.12L97.54,33.64a16,16,0,0,0-16.62-9.52A56.26,56.26,0,0,0,32,80c0,79.4,64.6,144,144,144a56.26,56.26,0,0,0,55.88-48.92A16,16,0,0,0,222.37,158.46ZM176,208A128.14,128.14,0,0,1,48,80,40.2,40.2,0,0,1,82.87,40a.61.61,0,0,0,0,.12l21,47L83.2,111.86a6.13,6.13,0,0,0-.57.77,16,16,0,0,0-1,15.7c9.06,18.53,27.73,37.06,46.46,46.11a16,16,0,0,0,15.75-1.14,8.44,8.44,0,0,0,.74-.56L168.89,152l47,21.05h0s.08,0,.11,0A40.21,40.21,0,0,1,176,208Z',
  video:
    'M251.77,73a8,8,0,0,0-8.21.39L208,97.05V72a16,16,0,0,0-16-16H32A16,16,0,0,0,16,72V184a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V159l35.56,23.71A8,8,0,0,0,248,184a8,8,0,0,0,8-8V80A8,8,0,0,0,251.77,73ZM192,184H32V72H192V184Zm48-22.95-32-21.33V116.28L240,95Z',
  dots: 'M140,128a12,12,0,1,1-12-12A12,12,0,0,1,140,128Zm56-12a12,12,0,1,0,12,12A12,12,0,0,0,196,116ZM60,116a12,12,0,1,0,12,12A12,12,0,0,0,60,116Z',
  mic: 'M128,176a48.05,48.05,0,0,0,48-48V64a48,48,0,0,0-96,0v64A48.05,48.05,0,0,0,128,176ZM96,64a32,32,0,0,1,64,0v64a32,32,0,0,1-64,0Zm40,143.6V240a8,8,0,0,1-16,0V207.6A80.11,80.11,0,0,1,48,128a8,8,0,0,1,16,0,64,64,0,0,0,128,0,8,8,0,0,1,16,0A80.11,80.11,0,0,1,136,207.6Z',
  plusBold: 'M228,128a12,12,0,0,1-12,12H140v76a12,12,0,0,1-24,0V140H40a12,12,0,0,1,0-24h76V40a12,12,0,0,1,24,0v76h76A12,12,0,0,1,228,128Z',
  sendFill:
    'M231.4,44.34s0,.1,0,.15l-58.2,191.94a15.88,15.88,0,0,1-14,11.51q-.69.06-1.38.06a15.86,15.86,0,0,1-14.42-9.15L107,164.15a4,4,0,0,1,.77-4.58l57.92-57.92a8,8,0,0,0-11.31-11.31L96.43,148.26a4,4,0,0,1-4.58.77L17.08,112.64a16,16,0,0,1,2.49-29.8l191.94-58.2.15,0A16,16,0,0,1,231.4,44.34Z',
  check: 'M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z',
  checks:
    'M149.61,85.71l-89.6,88a8,8,0,0,1-11.22,0L10.39,136a8,8,0,1,1,11.22-11.41L54.4,156.79l84-82.5a8,8,0,1,1,11.22,11.42Zm96.1-11.32a8,8,0,0,0-11.32-.1l-84,82.5-18.83-18.5a8,8,0,0,0-11.21,11.42l24.43,24a8,8,0,0,0,11.22,0l89.6-88A8,8,0,0,0,245.71,74.39Z',
}

function Icon({ d, size }: { d: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  )
}

/* The Sapphire mark (components/subscriptions/sapphire-mark.tsx). */
function Badge() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" className="sm-badge" aria-hidden="true">
      <path
        fill="#2563eb"
        d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81C14.67 2.63 13.43 1.75 12 1.75S9.33 2.63 8.66 3.94c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34Z"
      />
      <path d="m9 12 2 2 4-4" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ── the thread (screens.tsx THREAD) ── */

type Receipt = 'sent' | 'delivered' | 'read'
type Msg = { id: number; mine?: boolean; text: string; time: string; receipt?: Receipt; fresh?: boolean }

const THREAD: Msg[] = [
  { id: 0, text: 'landed, heading to yours', time: '9:08' },
  { id: 1, mine: true, text: 'perfect, door code is 4417', time: '9:09', receipt: 'read' },
  { id: 2, text: 'do you need me to bring anything', time: '9:10' },
  { id: 3, mine: true, text: 'just yourself, there is food here', time: '9:11', receipt: 'read' },
  { id: 4, text: 'also, the flight lands at 6:40, terminal 2', time: '9:12' },
]
/** What the site's own thread types into the composer (screens.tsx REPLY). */
const REPLY = 'noted, i will be there'
const NOW = '9:41' // the status bar's time
const MAX = 200

/* ── the seal (SurfVersion4/lib/crypto) ── */

type Bytes = Uint8Array<ArrayBuffer>
const enc = new TextEncoder()
const dec = new TextDecoder()
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b))
const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n)) as Bytes
const cat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)) as Bytes
  let at = 0
  for (const p of parts) (out.set(p, at), (at += p.length))
  return out
}
const s = () => crypto.subtle

async function hmac(key: Bytes, byte: number) {
  const k = await s().importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await s().sign('HMAC', k, new Uint8Array([byte]))) as Bytes
}
async function hkdf(ikm: Bytes, salt: Bytes, info: string, length: number) {
  const k = await s().importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await s().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode(info) }, k, length * 8)) as Bytes
}
/** chain-kdf.ts kdfChain: [nextChainKey, messageKey]. */
const kdfChain = async (ck: Bytes) => [await hmac(ck, 0x02), await hmac(ck, 0x01)] as const
/** chain-kdf.ts messageKeyMaterial: the AES key and the IV, both from the message key. */
async function messageKeyMaterial(mk: Bytes) {
  const m = await hkdf(mk, new Uint8Array(32) as Bytes, 'SurfChainMsg', 44)
  return { key: m.slice(0, 32), iv: m.slice(32, 44) }
}
/** double-ratchet.ts kdfRoot: [newRootKey, chainKey]. */
async function kdfRoot(rk: Bytes, dhOut: Bytes) {
  const out = await hkdf(dhOut, rk, 'SurfRatchetRoot', 64)
  return [out.slice(0, 32), out.slice(32, 64)] as const
}
type Header = { dh: string; pn: number; n: number }
/** double-ratchet.ts encodeHeader: dh bytes, then pn and n as big-endian u32. */
function encodeHeader(dh: Uint8Array, h: Header) {
  const nums = new Uint8Array(8)
  new DataView(nums.buffer).setUint32(0, h.pn, false)
  new DataView(nums.buffer).setUint32(4, h.n, false)
  return cat(dh, nums)
}
async function gcm(op: 'encrypt' | 'decrypt', raw: Bytes, iv: Bytes, data: Bytes, aad?: Bytes) {
  const k = await s().importKey('raw', raw, 'AES-GCM', false, [op])
  const p: AesGcmParams = aad ? { name: 'AES-GCM', iv, additionalData: aad } : { name: 'AES-GCM', iv }
  return new Uint8Array(await s()[op](p, k, data)) as Bytes
}

/** An X25519 pair, raw public key out (P-256 only where a browser still lacks X25519). */
async function dhPair() {
  try {
    const kp = (await s().generateKey({ name: 'X25519' }, false, ['deriveBits'])) as CryptoKeyPair
    return { kp, alg: { name: 'X25519' } as const, pub: new Uint8Array(await s().exportKey('raw', kp.publicKey)) as Bytes }
  } catch {
    const alg = { name: 'ECDH', namedCurve: 'P-256' } as const
    const kp = (await s().generateKey(alg, false, ['deriveBits'])) as CryptoKeyPair
    return { kp, alg, pub: new Uint8Array(await s().exportKey('raw', kp.publicKey)) as Bytes }
  }
}
type Pair = Awaited<ReturnType<typeof dhPair>>
const dh = async (mine: Pair, theirs: Pair) =>
  new Uint8Array(await s().deriveBits({ name: mine.alg.name, public: theirs.kp.publicKey } as EcdhKeyDeriveParams, mine.kp.privateKey, 256)) as Bytes

export type Envelope = {
  v: 2
  sender: { userId: string; deviceId: string }
  msgs: { to: string; toUser: string; header: Header; ct: string }[]
  self: { iv: string; ct: string }
}

/**
 * One session, you to Maya's phone, as it stands after the thread above: two of your turns, so this is
 * your third sending chain and the last one carried one message (pn 1). SK stands in for the X3DH output.
 */
class Session {
  private constructor(
    private ours: Pair,
    private cks: Bytes,
    private ckr: Bytes,
    private ad: Bytes,
    private selfKey: Bytes,
    private ids: { you: string; yourDevice: string; maya: string; mayaDevice: string },
  ) {}
  private ns = 0
  private pn = 1

  static async open() {
    const sk = rand(32)
    const maya = await dhPair() // her ratchet key
    const ours = await dhPair() // ours, fresh for this chain
    const [, cks] = await kdfRoot(sk, await dh(ours, maya)) // ratchetInitAlice
    const [, ckr] = await kdfRoot(sk, await dh(maya, ours)) // the same chain, from her side
    // ad: both identity (Ed25519) public keys, sender's first
    const ad = cat(rand(32), rand(32))
    const id = () => crypto.randomUUID()
    return new Session(ours, cks, ckr, ad, rand(32), { you: id(), yourDevice: id(), maya: id(), mayaDevice: id() })
  }

  private queue: Promise<unknown> = Promise.resolve()
  seal(text: string) {
    const run = this.queue.then(async () => {
      const plain = enc.encode(text) as Bytes
      // ratchetEncrypt
      const [next, mk] = await kdfChain(this.cks)
      this.cks = next
      const header: Header = { dh: b64(this.ours.pub), pn: this.pn, n: this.ns++ }
      const { key, iv } = await messageKeyMaterial(mk)
      const aad = cat(this.ad, encodeHeader(this.ours.pub, header))
      const ct = await gcm('encrypt', key, iv, plain, aad)
      // session-manager encrypt(): the own-device copy, under a key that never leaves this device
      const selfIv = rand(12)
      const selfCt = await gcm('encrypt', this.selfKey, selfIv, plain)
      const envelope: Envelope = {
        v: 2,
        sender: { userId: this.ids.you, deviceId: this.ids.yourDevice },
        msgs: [{ to: this.ids.mayaDevice, toUser: this.ids.maya, header, ct: b64(ct) }],
        self: { iv: b64(selfIv), ct: b64(selfCt) },
      }
      // Maya's phone: her receiving chain steps the same way and opens it from the envelope alone
      const [nextR, mkR] = await kdfChain(this.ckr)
      this.ckr = nextR
      const r = await messageKeyMaterial(mkR)
      const opened = dec.decode(await gcm('decrypt', r.key, r.iv, ct, aad))
      return { envelope, opened }
    })
    this.queue = run.catch(() => undefined)
    return run
  }
}

/* ── the demo ── */

type Sent = { envelope: Envelope; opened: string; at: number }

export function MessengerSeal() {
  const { ref, live, near, reduced } = useLive<HTMLDivElement>()
  const session = useRef<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>(THREAD)
  const [draft, setDraft] = useState('')
  const [last, setLast] = useState<Sent | null>(null)
  const nextId = useRef(THREAD.length)
  const started = useRef(false)
  const auto = useRef<'idle' | 'typing' | 'done'>('idle')
  const timers = useRef<number[]>([])

  useEffect(() => {
    if (!near || started.current || !globalThis.crypto?.subtle) return
    started.current = true
    Session.open()
      .then((sess) => {
        session.current = sess
        setReady(true)
      })
      .catch(() => (started.current = false))
  }, [near])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim().slice(0, MAX)
      if (!text || !session.current) return
      const id = nextId.current++
      setDraft('')
      setMsgs((list) => [...list, { id, mine: true, text, time: NOW, receipt: 'sent', fresh: true }])
      const { envelope, opened } = await session.current.seal(text)
      setLast({ envelope, opened, at: id })
      // two ticks once it has arrived and opened on her phone (bubble-time-status.tsx)
      if (opened === text) later(() => setMsgs((list) => list.map((m) => (m.id === id ? { ...m, receipt: 'delivered' } : m))), reduced ? 0 : 900)
    },
    [reduced],
  )

  // The site's own reply types itself in once, the first time the demo is in view; anything the visitor
  // does takes over. Reduced motion sends it straight away so the lane is never empty.
  useEffect(() => {
    if (!ready || auto.current !== 'idle') return
    if (reduced) {
      auto.current = 'done'
      void send(REPLY)
      return
    }
    if (!live) return
    auto.current = 'typing'
    const step = 62
    for (let i = 1; i <= REPLY.length; i++) later(() => auto.current === 'typing' && setDraft(REPLY.slice(0, i)), 900 + i * step)
    later(() => {
      if (auto.current !== 'typing') return
      auto.current = 'done'
      void send(REPLY)
    }, 900 + REPLY.length * step + 450)
  }, [ready, live, reduced, send])

  const takeOver = () => {
    if (auto.current !== 'typing') return
    auto.current = 'done'
    setDraft('')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    takeOver()
    void send(draft)
  }

  const has = draft.length > 0

  return (
    <div ref={ref}>
      <Stage note="Keys are made in this tab. A random secret stands in for the X3DH handshake that would agree them between two phones.">
        <div className="sm-grid">
          <div className="sm-col">
            <Device>
              <div className={`sm-app ${inter.className}`}>
                <ChatHeader />
                <Thread msgs={msgs} reduced={reduced} />
                <form className="sm-composer" onSubmit={submit}>
                  <div className="sm-row">
                    <div className="sm-pill">
                      <input
                        className="sm-field"
                        value={draft}
                        onChange={(e) => {
                          takeOver()
                          setDraft(e.target.value)
                        }}
                        onFocus={takeOver}
                        onPointerDown={takeOver}
                        maxLength={MAX}
                        placeholder="Message…"
                        disabled={!ready}
                        aria-label="Message Maya. It is encrypted in this tab before it is sent."
                        enterKeyHint="send"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <span className="sm-btn" aria-hidden="true">
                        <Icon d={has ? ICON.plusBold : ICON.mic} size={22} />
                      </span>
                    </div>
                    <button type="submit" className="sm-send" disabled={!ready || !draft.trim()} aria-label="Send">
                      <Icon d={has ? ICON.sendFill : ICON.plusBold} size={22} />
                    </button>
                  </div>
                </form>
              </div>
            </Device>
          </div>
          <Lane sent={last} ready={ready} />
        </div>
      </Stage>
    </div>
  )
}

/* ── the phone ── */

/* SurfWebsite components/device.tsx at its 320px design size; the app inside is the real 390. */
function Device({ children }: { children: React.ReactNode }) {
  return (
    <div className="sm-device">
      <div className="sm-frame">
        <span className="sm-rail l" style={{ top: 110, height: 23 }} />
        <span className="sm-rail l" style={{ top: 152, height: 30 }} />
        <span className="sm-rail l" style={{ top: 193, height: 30 }} />
        <span className="sm-rail r" style={{ top: 159, height: 50 }} />
        <div className="sm-body">
          <div className="sm-screen">
            {children}
            <div className={`sm-status ${inter.className}`} aria-hidden="true">
              <span className="sm-time">9:41</span>
              <div className="sm-glyphs">
                <svg width="16" height="10" viewBox="0 0 18 12" fill="currentColor">
                  <rect y="8" width="3" height="4" rx="1" />
                  <rect x="5" y="5" width="3" height="7" rx="1" />
                  <rect x="10" y="2" width="3" height="10" rx="1" />
                  <rect x="15" width="3" height="12" rx="1" opacity="0.35" />
                </svg>
                <svg width="13" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 18a1.6 1.6 0 1 1 0 3.2A1.6 1.6 0 0 1 12 18Zm0-5c1.9 0 3.6.7 4.9 2l-1.7 1.7a4.6 4.6 0 0 0-6.4 0L7.1 15A6.9 6.9 0 0 1 12 13Zm0-5c3.3 0 6.3 1.3 8.5 3.5l-1.7 1.7A9.6 9.6 0 0 0 12 11a9.6 9.6 0 0 0-6.8 2.2L3.5 11.5A11.9 11.9 0 0 1 12 8Z" />
                </svg>
                <svg width="24" height="11" viewBox="0 0 26 12" fill="none">
                  <rect x="0.5" y="1" width="21" height="10" rx="2.8" stroke="currentColor" opacity="0.4" />
                  <rect x="2.5" y="3" width="15" height="6" rx="1.4" fill="currentColor" />
                  <rect x="23" y="4" width="2" height="4" rx="1" fill="currentColor" opacity="0.5" />
                </svg>
              </div>
            </div>
            <span className="sm-home" aria-hidden="true" />
            <div className="sm-island" aria-hidden="true">
              <span />
            </div>
            <span className="sm-glass" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  )
}

function ChatHeader() {
  return (
    <div className="sm-head" aria-hidden="true">
      <div className="sm-headrow">
        <span className="sm-btn sm-back">
          <Icon d={ICON.caretLeft} size={22} />
        </span>
        <span className="sm-av">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/work/derived/surf-maya.webp" alt="" width={32} height={32} />
          <span className="sm-online" />
        </span>
        <div className="sm-who">
          <div className="sm-name">
            <span>mayachen</span>
            <Badge />
          </div>
          <p className="sm-state">Online</p>
        </div>
        <div className="sm-actions">
          <span className="sm-btn">
            <Icon d={ICON.phone} size={22} />
          </span>
          <span className="sm-btn">
            <Icon d={ICON.video} size={22} />
          </span>
          <span className="sm-btn">
            <Icon d={ICON.dots} size={22} />
          </span>
        </div>
      </div>
    </div>
  )
}

function Thread({ msgs, reduced }: { msgs: Msg[]; reduced: boolean }) {
  const el = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const t = el.current
    if (t) t.scrollTo({ top: t.scrollHeight, behavior: reduced || msgs.length <= THREAD.length ? 'auto' : 'smooth' })
  }, [msgs.length, reduced])
  return (
    <div className="sm-thread" ref={el} role="log" aria-label="Conversation with Maya">
      <div className="sm-flow">
        <p className="sm-day">Today</p>
        {msgs.map((m, i) => {
          const next = msgs[i + 1]
          const run = !!next && !!next.mine === !!m.mine
          return (
            <div key={m.id} className={`sm-line ${m.mine ? 'mine' : ''} ${m.fresh ? 'fresh' : ''}`} style={{ marginBottom: run ? 4 : 12 }}>
              <div className={`sm-bubble ${run ? '' : 'tail'}`}>
                <span className="sm-text">{m.text}</span>
                <span className="sm-meta">
                  {m.time}
                  {m.mine && m.receipt && (
                    <span className={m.receipt === 'read' ? 'sm-read' : undefined} aria-label={m.receipt === 'sent' ? 'Sent' : m.receipt === 'delivered' ? 'Delivered' : 'Read'}>
                      <Icon d={m.receipt === 'sent' ? ICON.check : ICON.checks} size={14} />
                    </span>
                  )}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── what the server stores ── */

function Lane({ sent, ready }: { sent: Sent | null; ready: boolean }) {
  const e = sent?.envelope
  const m = e?.msgs[0]
  const k = (name: string) => <span className="sm-k">&quot;{name}&quot;</span>
  const v = (val: string | number) => <span className="sm-v">{typeof val === 'number' ? val : `"${val}"`}</span>
  return (
    <div className="sm-lane" aria-live="polite">
      <p className="sm-label">What the server stores</p>
      {e && m ? (
        <>
          <div key={sent.at} className={`sm-json ${mono.className}`} role="group" aria-label="The encrypted envelope, as stored on the server">
            {(
              [
                [0, '{'],
                [1, <>{k('v')}: {v(e.v)},</>],
                [1, <>{k('sender')}: {'{'}</>],
                [2, <>{k('userId')}: {v(e.sender.userId)},</>],
                [2, <>{k('deviceId')}: {v(e.sender.deviceId)}</>],
                [1, '},'],
                [1, <>{k('msgs')}: [{'{'}</>],
                [2, <>{k('to')}: {v(m.to)},</>],
                [2, <>{k('toUser')}: {v(m.toUser)},</>],
                [2, <>{k('header')}: {'{'}</>],
                [3, <>{k('dh')}: {v(m.header.dh)},</>],
                [3, <>{k('pn')}: {v(m.header.pn)},</>],
                [3, <>{k('n')}: {v(m.header.n)}</>],
                [2, '},'],
                [2, <>{k('ct')}: {v(m.ct)}</>],
                [1, '}],'],
                [1, <>{k('self')}: {'{'}</>],
                [2, <>{k('iv')}: {v(e.self.iv)},</>],
                [2, <>{k('ct')}: {v(e.self.ct)}</>],
                [1, '}'],
                [0, '}'],
              ] as const
            ).map(([depth, line], i) => (
              <div key={i} className="sm-jl" style={{ paddingLeft: `${depth * 2}ch` }}>
                {line}
              </div>
            ))}
          </div>
          <div className="sm-notes">
            <p>
              n is this message&rsquo;s step in the chain. Its key is HMAC(chain key, 0x01), and the chain moves on with HMAC(chain key, 0x02), so each key is used once.
            </p>
            <p>The AES-256-GCM key and its IV are both expanded from that message key, so no IV goes to Maya. The self copy is yours, sealed with a key that stays on this device.</p>
            <p>
              Opened with Maya&rsquo;s key, in this tab: <span className="sm-opened">{sent.opened}</span>
            </p>
          </div>
        </>
      ) : (
        <p className="sm-empty">{ready ? 'Nothing sent yet.' : 'Making keys in this tab.'}</p>
      )}
    </div>
  )
}
