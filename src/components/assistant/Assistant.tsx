'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTransitionNav } from '../Transitions'
import { AskAnswer } from './AskAnswer'
import { EdgeGlow } from './EdgeGlow'
import { useSpeech } from './useSpeech'
import { getLenis } from '@/lib/lenis'
import { projects } from '@/lib/projects-data'
import { EMAIL, NAV, SOCIALS } from '@/lib/site'

type Item = {
  id: string
  label: string
  hint: string
  group: 'Ask' | 'Pages' | 'Projects' | 'Roles' | 'Elsewhere'
  run: () => void
}

type Turn = { id: number; q: string; a: string; state: 'streaming' | 'done' | 'error' }

const STARTERS = ['What is Helio and how does it work?', 'What has he shipped this year?', 'How does he use AI to build?']
const EXAMPLES = [
  'How does AiroFind find cheap flights?',
  'Show me his AI projects',
  'What is Helio and how does it work?',
  'What did he build at FacilisAI?',
  'How does he use AI to build?',
]
const MAX_CHARS = 1500
/** The API accepts 8 messages; older turns drop off the front. */
const MAX_MESSAGES = 8
const LABEL = 'Ask about my work'

/** A query that reads like a question goes to Ask first. */
const looksLikeQuestion = (t: string) => /\?$/.test(t) || t.split(/\s+/).length >= 3

/**
 * The assistant. A slim pill floats at the bottom of the page (after the first screen,
 * away from the footer and out of the way of live demos). Focusing it, ⌘K, Ctrl+K or "/"
 * opens a glass card above it with a flowing edge glow: type a page or project to jump
 * to it, or ask a question and the answer streams in. On phones it is a bottom sheet.
 */
export function Assistant() {
  const { go } = useTransitionNav()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [copied, setCopied] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [inView, setInView] = useState(false)
  const [example, setExample] = useState(-1)
  const [mod, setMod] = useState('⌘K')
  const col = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const abort = useRef<AbortController | null>(null)
  const nextId = useRef(1)
  const pinned = useRef(true)

  const streaming = turns.some((t) => t.state === 'streaming')
  const close = useCallback(() => setOpen(false), [])

  const navigate = useCallback(
    (href: string) => {
      setOpen(false)
      if (href !== location.pathname) go(href)
    },
    [go],
  )

  const ask = useCallback(
    async (question: string) => {
      const text = question.trim().slice(0, MAX_CHARS)
      if (!text || streaming) return
      setOpen(true)
      setQ('')
      const id = nextId.current++
      const history = turns
        .filter((t) => t.state === 'done' && t.a)
        .flatMap((t) => [
          { role: 'user' as const, content: t.q },
          { role: 'assistant' as const, content: t.a.slice(0, MAX_CHARS) },
        ])
      const messages = [...history, { role: 'user' as const, content: text }].slice(-MAX_MESSAGES)
      pinned.current = true
      setTurns((ts) => [...ts, { id, q: text, a: '', state: 'streaming' }])
      const update = (fn: (t: Turn) => Turn) => setTurns((ts) => ts.map((t) => (t.id === id ? fn(t) : t)))

      const ctrl = new AbortController()
      abort.current = ctrl
      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messages }),
          signal: ctrl.signal,
        })
        if (!res.ok || !res.body) {
          let msg = 'Something went wrong. Try again in a moment.'
          try {
            msg = (await res.json()).error || msg
          } catch {}
          update((t) => ({ ...t, a: msg, state: 'error' }))
          return
        }
        const reader = res.body.getReader()
        const dec = new TextDecoder()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = dec.decode(value, { stream: true })
          update((t) => ({ ...t, a: t.a + chunk }))
        }
        update((t) => ({ ...t, state: t.a.trim() ? 'done' : 'error', a: t.a.trim() || 'No answer came back. Try asking again.' }))
      } catch {
        update((t) => ({
          ...t,
          state: t.a ? 'done' : 'error',
          a: t.a || `Could not reach the assistant. You can always email ${EMAIL}.`,
        }))
      } finally {
        if (abort.current === ctrl) abort.current = null
      }
    },
    [streaming, turns],
  )

  const speech = useSpeech(
    (t) => setQ(t.slice(0, MAX_CHARS)),
    (t) => ask(t),
  )

  // Pages, projects, roles and links, for jumping by name.
  const items = useMemo<Item[]>(() => {
    const nav = (href: string) => () => navigate(href)
    return [
      { id: 'home', label: 'Home', hint: '/', group: 'Pages' as const, run: nav('/') },
      ...NAV.map((n) => ({ id: n.href, label: n.label, hint: n.href, group: 'Pages' as const, run: nav(n.href) })),
      ...projects
        .filter((p) => p.kind === 'project')
        .map((p) => ({ id: p.id, label: p.title, hint: p.year, group: 'Projects' as const, run: nav(`/portfolio/${p.id}`) })),
      ...projects
        .filter((p) => p.kind === 'work')
        .map((p) => ({ id: p.id, label: p.org ?? p.title, hint: p.role, group: 'Roles' as const, run: nav(`/portfolio/${p.id}`) })),
      {
        id: 'email',
        label: 'Copy email',
        hint: EMAIL,
        group: 'Elsewhere',
        run: () => {
          navigator.clipboard?.writeText(EMAIL).then(
            () => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1200)
            },
            () => (location.href = `mailto:${EMAIL}`),
          )
        },
      },
      ...SOCIALS.map((s) => ({
        id: s.label,
        label: s.label,
        hint: s.handle,
        group: 'Elsewhere' as const,
        run: () => window.open(s.href, '_blank', 'noopener,noreferrer'),
      })),
    ]
  }, [navigate])

  const t = q.trim()
  const matches = useMemo(() => {
    if (!t) return []
    const lower = t.toLowerCase()
    return items.filter((i) => `${i.label} ${i.hint} ${i.group}`.toLowerCase().includes(lower))
  }, [items, t])

  // With no conversation yet, typing shows a jump list with "Ask" in it.
  // During a conversation, typing is a follow-up; matching pages show as small chips.
  const listMode = turns.length === 0
  const shown = useMemo<Item[]>(() => {
    if (!listMode) return []
    if (!t) {
      const featured = new Set(projects.filter((p) => p.featured && p.kind === 'project').map((p) => p.id))
      return items.filter((i) => (i.group === 'Pages' && i.id !== 'home') || (i.group === 'Projects' && featured.has(i.id)))
    }
    const askRow: Item = { id: 'ask', label: `Ask “${t}”`, hint: 'AI answer', group: 'Ask', run: () => ask(t) }
    return matches.length === 0 || looksLikeQuestion(t) ? [askRow, ...matches] : [...matches, askRow]
  }, [listMode, t, items, matches, ask])

  useEffect(() => setActive(t ? 0 : -1), [t])

  // Hidden parts leave the tab order (React 18 has no inert prop, so set the attribute).
  useEffect(() => {
    col.current?.toggleAttribute('inert', !(open || inView))
    card.current?.toggleAttribute('inert', !open)
  }, [open, inView])

  // Global shortcuts and open events (zk:command from the footer hint, zk:ask from the menu).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable)
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === '/' && !typing && !open) {
        e.preventDefault()
        setOpen(true)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('zk:command', onOpen)
    window.addEventListener('zk:ask', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('zk:command', onOpen)
      window.removeEventListener('zk:ask', onOpen)
    }
  }, [open])

  // Open and close: focus, scroll lock.
  useEffect(() => {
    const lenis = getLenis()
    if (open) {
      if (document.activeElement !== input.current) returnFocus.current = document.activeElement as HTMLElement | null
      lenis?.stop()
      document.documentElement.style.overflow = 'hidden'
      requestAnimationFrame(() => input.current?.focus({ preventScroll: true }))
    } else {
      speech.stop()
      lenis?.start()
      document.documentElement.style.overflow = ''
      const r = returnFocus.current
      returnFocus.current = null
      if (r && r !== document.body) r.focus?.({ preventScroll: true })
      else if (document.activeElement === input.current) input.current?.blur()
    }
    // speech.stop is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => () => abort.current?.abort(), [])
  useEffect(() => setOpen(false), [pathname])

  // When the pill floats: past the first screen (the hero on the home page), away from the
  // footer, and out of the way while someone is using a live demo.
  useEffect(() => {
    let raf = 0
    let aside = false
    let asideTimer = 0
    const measure = () => {
      raf = 0
      const vh = window.innerHeight
      const hero = document.querySelector<HTMLElement>('#page .hero')
      const past = hero ? hero.getBoundingClientRect().bottom < vh * 0.5 : window.scrollY > vh * 0.5
      const footer = document.querySelector<HTMLElement>('#page footer')
      const nearFooter = footer ? footer.getBoundingClientRect().top < vh - 40 : false
      setInView(past && !nearFooter && !aside)
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }
    const setAside = (v: boolean, delay = 0) => {
      clearTimeout(asideTimer)
      asideTimer = window.setTimeout(() => {
        aside = v
        schedule()
      }, delay)
    }
    const inDemo = (n: EventTarget | null) => n instanceof Element && !!n.closest('.demo, video')
    const onOver = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && inDemo(e.target)) setAside(true)
    }
    const onOut = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && inDemo(e.target) && !inDemo(e.relatedTarget)) setAside(false, 700)
    }
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && inDemo(e.target)) {
        setAside(true)
        setAside(false, 2500)
      }
    }
    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('zk:route', schedule)
    document.addEventListener('pointerover', onOver)
    document.addEventListener('pointerout', onOut)
    document.addEventListener('pointerdown', onDown)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(asideTimer)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('zk:route', schedule)
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerout', onOut)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [pathname])

  useEffect(() => {
    if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setMod('Ctrl K')
  }, [])

  // Cycle example questions in the empty pill.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => setExample((i) => (i + 1 >= EXAMPLES.length ? -1 : i + 1)), 4200)
    return () => clearInterval(id)
  }, [])

  // On phones the sheet rides above the on-screen keyboard.
  useEffect(() => {
    const vv = window.visualViewport
    const el = col.current
    if (!vv || !el) return
    const onVV = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      el.style.setProperty('--kb', `${kb}px`)
    }
    onVV()
    vv.addEventListener('resize', onVV)
    vv.addEventListener('scroll', onVV)
    return () => {
      vv.removeEventListener('resize', onVV)
      vv.removeEventListener('scroll', onVV)
    }
  }, [])

  // Follow the answer while it streams, unless the reader has scrolled up.
  const lastTurn = turns[turns.length - 1]
  useEffect(() => {
    const el = body.current
    if (!el) return
    if (turns.length === 0) el.scrollTop = 0
    else if (pinned.current) el.scrollTop = el.scrollHeight
  }, [lastTurn?.a, lastTurn?.id, open, turns.length])

  useEffect(() => {
    if (active >= 0) body.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      input.current?.blur()
      return
    }
    if (listMode && shown.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setOpen(true)
        setActive((a) => Math.min(a + 1, shown.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => Math.max(a - 1, 0))
        return
      }
      if (e.key === 'Enter' && active >= 0 && shown[active]) {
        e.preventDefault()
        shown[active].run()
        return
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      ask(q)
    }
  }

  // Keep Tab inside the assistant while it is open.
  const onColKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }
    if (e.key !== 'Tab' || !open || !col.current) return
    const nodes = Array.from(col.current.querySelectorAll<HTMLElement>('input, button:not([disabled]), a[href]')).filter(
      (n) => n.offsetParent !== null,
    )
    if (!nodes.length) return
    const i = nodes.indexOf(document.activeElement as HTMLElement)
    const next = e.shiftKey ? (i <= 0 ? nodes.length - 1 : i - 1) : i === nodes.length - 1 ? 0 : i + 1
    e.preventDefault()
    nodes[next].focus()
  }

  const shownPill = open || inView
  const orb = speech.listening ? 'listening' : streaming ? 'thinking' : open ? 'awake' : 'idle'
  const chips = !listMode && t ? matches.filter((m) => m.group === 'Projects' || m.group === 'Roles' || m.group === 'Pages').slice(0, 3) : []
  let lastGroup = ''

  return (
    <div className={`asst ${open ? 'is-open' : ''} ${shownPill ? 'is-shown' : ''}`}>
      <EdgeGlow level={open ? (streaming || speech.listening ? 1 : 0.62) : 0} busy={streaming || speech.listening} />
      <div className="asst-scrim" onClick={close} aria-hidden="true" />
      <div className="asst-dock grid-main">
        <div
          ref={col}
          className="asst-col col-span-4 md:col-span-8 md:col-start-3 lg:col-span-6 lg:col-start-4"
          role={open ? 'dialog' : 'region'}
          aria-modal={open || undefined}
          aria-label={LABEL}
          onKeyDown={onColKey}
        >
          <section ref={card} className="asst-card" aria-hidden={!open}>
            <div className="asst-card-top">
              <span className="asst-grab" aria-hidden="true" />
              {turns.length > 0 && (
                <button type="button" className="asst-text-btn" onClick={() => setTurns([])} disabled={streaming}>
                  New question
                </button>
              )}
              <button type="button" className="asst-icon-btn asst-close" onClick={close} aria-label="Close">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div
              ref={body}
              className="asst-body"
              data-lenis-prevent=""
              onScroll={(e) => {
                const el = e.currentTarget
                pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
              }}
            >
              {listMode ? (
                <>
                  {!t && (
                    <ul className="ask-starters" aria-label="Suggested questions">
                      {STARTERS.map((s) => (
                        <li key={s}>
                          <button type="button" onClick={() => ask(s)}>
                            {s}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <ul id="asst-list" role="listbox" aria-label="Pages and projects" className="asst-list">
                    {shown.map((it, i) => {
                      const head = it.group !== lastGroup && it.group !== 'Ask' ? (t ? it.group : !lastGroup ? 'Jump to' : null) : null
                      lastGroup = it.group
                      return (
                        <li key={it.id + it.group} role="presentation">
                          {head && <div className="asst-group">{head}</div>}
                          <div
                            id={`asst-${it.id}`}
                            role="option"
                            aria-selected={i === active}
                            data-i={i}
                            className={`asst-row ${i === active ? 'on' : ''} ${it.group === 'Ask' ? 'is-ask' : ''}`}
                            onMouseMove={() => setActive(i)}
                            onClick={() => it.run()}
                          >
                            <span className="asst-row-l">{it.id === 'email' && copied ? 'Copied' : it.label}</span>
                            <span className="asst-hint">{it.hint}</span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </>
              ) : (
                <ol className="ask-thread">
                  {turns.map((tn, i) => (
                    <li key={tn.id} className="ask-turn">
                      <p className="ask-q">{tn.q}</p>
                      <div
                        className={`ask-a ${tn.state === 'error' ? 'is-error' : ''}`}
                        aria-live={i === turns.length - 1 ? 'polite' : undefined}
                        aria-busy={tn.state === 'streaming'}
                      >
                        {tn.state === 'streaming' && !tn.a ? (
                          <span className="sr-only">Writing an answer</span>
                        ) : (
                          <AskAnswer text={tn.a} onNavigate={navigate} />
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            {chips.length > 0 && (
              <div className="asst-chips">
                {chips.map((c) => (
                  <button key={c.id} type="button" className="ask-chip" onClick={c.run}>
                    Go to {c.label}
                    <span aria-hidden="true">→</span>
                  </button>
                ))}
              </div>
            )}
            <p className="asst-note">Written by AI from his project notes. It can be wrong.</p>
          </section>

          <form
            className="asst-pill"
            onSubmit={(e) => {
              e.preventDefault()
              ask(q)
            }}
            onClick={(e) => {
              if (!open && e.target === e.currentTarget) setOpen(true)
            }}
          >
            <span className={`orb is-${orb}`} aria-hidden="true">
              <span />
            </span>
            <div className="asst-field">
              <input
                ref={input}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value.slice(0, MAX_CHARS))
                  if (!open) setOpen(true)
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={onInputKey}
                aria-label={LABEL}
                aria-controls={open && listMode ? 'asst-list' : undefined}
                aria-activedescendant={open && listMode && active >= 0 && shown[active] ? `asst-${shown[active].id}` : undefined}
                role={listMode ? 'combobox' : undefined}
                aria-expanded={listMode ? open : undefined}
                aria-autocomplete={listMode ? 'list' : undefined}
                enterKeyHint="send"
                maxLength={MAX_CHARS}
                spellCheck={false}
                autoComplete="off"
              />
              {!q && (
                <span className="asst-ph" aria-hidden="true">
                  <span key={speech.listening ? 'l' : example} className="asst-ph-t">
                    {speech.listening
                      ? 'Listening'
                      : open && turns.length
                        ? 'Ask a follow-up'
                        : example < 0
                          ? LABEL
                          : `Try ‘${EXAMPLES[example]}’`}
                  </span>
                </span>
              )}
            </div>
            {!open && !q && <kbd className="asst-kbd">{mod}</kbd>}
            {speech.supported && (
              <button
                type="button"
                className={`asst-icon-btn asst-mic ${speech.listening ? 'on' : ''}`}
                onClick={() => {
                  setOpen(true)
                  if (speech.listening) speech.stop()
                  else speech.start()
                }}
                aria-label={speech.listening ? 'Stop voice input' : 'Ask with your voice'}
                aria-pressed={speech.listening}
              >
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="5.5" y="1.75" width="5" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M3 7.5a5 5 0 0010 0M8 12.5v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            )}
            <button type="submit" className="asst-send" disabled={!q.trim() || streaming} aria-label="Send question">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
