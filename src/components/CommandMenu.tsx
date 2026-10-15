'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTransitionNav } from './Transitions'
import { getLenis } from '@/lib/lenis'
import { projects } from '@/lib/projects-data'
import { EMAIL, NAV, SOCIALS } from '@/lib/site'

type Item = {
  id: string
  label: string
  hint: string
  group: 'Pages' | 'Projects' | 'Roles' | 'Elsewhere'
  run: () => void
}

/** Opened with ⌘K, Ctrl+K or "/". Jump to any page or project from the keyboard. */
export function CommandMenu() {
  const { go } = useTransitionNav()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [copied, setCopied] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  const close = useCallback(() => setOpen(false), [])

  const items = useMemo<Item[]>(() => {
    const nav = (href: string) => () => {
      setOpen(false)
      if (href !== location.pathname) go(href)
    }
    return [
      { id: 'home', label: 'Home', hint: '/', group: 'Pages', run: nav('/') },
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
              setTimeout(() => {
                setCopied(false)
                setOpen(false)
              }, 900)
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
        run: () => {
          setOpen(false)
          window.open(s.href, '_blank', 'noopener,noreferrer')
        },
      })),
    ]
  }, [go])

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return items
    return items.filter((i) => `${i.label} ${i.hint} ${i.group}`.toLowerCase().includes(t))
  }, [items, q])

  // Global shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)
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
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('zk:command', onOpen)
    }
  }, [open])

  // Open and close side effects: focus, scroll lock.
  useEffect(() => {
    const lenis = getLenis()
    if (open) {
      returnFocus.current = document.activeElement as HTMLElement | null
      setQ('')
      setActive(0)
      lenis?.stop()
      document.documentElement.style.overflow = 'hidden'
      requestAnimationFrame(() => input.current?.focus())
    } else {
      lenis?.start()
      document.documentElement.style.overflow = ''
      returnFocus.current?.focus?.()
    }
  }, [open])

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => setActive(0), [q])

  // Keep the active row in view.
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, shown.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      shown[active]?.run()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  let lastGroup = ''

  return (
    <div className={`cmdk ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="cmdk-scrim" onClick={close} />
      <div className="cmdk-panel glass-dark" role="dialog" aria-modal="true" aria-label="Jump to">
        <div className="cmdk-field">
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Jump to a page or project"
            aria-label="Jump to a page or project"
            aria-controls="cmdk-list"
            aria-activedescendant={shown[active] ? `cmdk-${shown[active].id}` : undefined}
            role="combobox"
            aria-expanded={open}
            tabIndex={open ? 0 : -1}
            spellCheck={false}
            autoComplete="off"
          />
          <kbd>esc</kbd>
        </div>
        <ul ref={list} id="cmdk-list" role="listbox" className="cmdk-list" data-lenis-prevent="">
          {shown.length === 0 && <li className="cmdk-empty">Nothing matches “{q}”.</li>}
          {shown.map((it, i) => {
            const head = it.group !== lastGroup ? it.group : null
            lastGroup = it.group
            return (
              <li key={it.id + it.group} role="presentation">
                {head && <div className="cmdk-group">{head}</div>}
                <div
                  id={`cmdk-${it.id}`}
                  role="option"
                  aria-selected={i === active}
                  data-i={i}
                  className={`cmdk-row ${i === active ? 'on' : ''}`}
                  onMouseMove={() => setActive(i)}
                  onClick={() => it.run()}
                >
                  <span>{it.id === 'email' && copied ? 'Copied' : it.label}</span>
                  <span className="cmdk-hint">{it.hint}</span>
                </div>
              </li>
            )
          })}
        </ul>
        <div className="cmdk-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> to move
          </span>
          <span>
            <kbd>enter</kbd> to open
          </span>
        </div>
      </div>
    </div>
  )
}
