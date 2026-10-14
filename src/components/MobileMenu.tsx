'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { usePathname } from 'next/navigation'
import { TLink } from './TLink'
import { EMAIL, NAV, SOCIALS } from '@/lib/site'
import { getLenis } from '@/lib/lenis'

export function MobileMenu({
  open,
  onClose,
  returnTo,
}: {
  open: boolean
  onClose: () => void
  returnTo: RefObject<HTMLButtonElement | null>
}) {
  const ref = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const [instant, setInstant] = useState(false)
  const lastPath = useRef(pathname)

  // A route change closes the menu with no animation.
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname
      setInstant(true)
      const t = setTimeout(() => setInstant(false), 50)
      return () => clearTimeout(t)
    }
  }, [pathname])

  useEffect(() => {
    const html = document.documentElement
    if (!open) return
    html.style.overflow = 'hidden'
    getLenis()?.stop()
    const el = ref.current
    const first = el?.querySelector<HTMLElement>('a')
    first?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !el) return
      const nodes = [returnTo.current, ...Array.from(el.querySelectorAll<HTMLElement>('a'))].filter(Boolean) as HTMLElement[]
      const i = nodes.indexOf(document.activeElement as HTMLElement)
      e.preventDefault()
      const next = e.shiftKey ? (i <= 0 ? nodes.length - 1 : i - 1) : i === nodes.length - 1 ? 0 : i + 1
      nodes[next]?.focus()
    }
    document.addEventListener('keydown', onKey)
    const btn = returnTo.current
    return () => {
      document.removeEventListener('keydown', onKey)
      html.style.overflow = ''
      getLenis()?.start()
      btn?.focus({ preventScroll: true })
    }
  }, [open, onClose, returnTo])

  return (
    <div
      ref={ref}
      id="menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      aria-hidden={!open}
      className={`menu md:hidden ${open ? 'open' : ''} ${instant ? 'instant' : ''}`}
    >
      <div aria-hidden="true" className="light light-rose" style={{ width: '90vmax', height: '90vmax', left: '80%', top: '15%', opacity: 0.8 }} />
      <nav aria-label="Menu" className="grid-main relative pt-[128px]">
        <ul className="col-span-4 flex flex-col gap-[4px]">
          {NAV.map((l, i) => (
            <li key={l.href} className="ln">
              <span className="mi" style={{ ['--i' as string]: i }}>
                <TLink href={l.href} className="oc block text-display" tabIndex={open ? 0 : -1}>
                  {l.label}
                </TLink>
              </span>
            </li>
          ))}
        </ul>
      </nav>
      <div className="grid-main absolute bottom-[20px] left-0 right-0">
        <div className="col-span-4">
          <a href={`mailto:${EMAIL}`} className="u-box u-hover text-read" tabIndex={open ? 0 : -1}>
            {EMAIL}
            <span aria-hidden="true" className="u-line" />
          </a>
          <div className="mt-[16px] flex flex-wrap gap-x-[20px] text-body" style={{ color: 'var(--bone-64)' }}>
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${s.label}, opens in a new tab`}
                tabIndex={open ? 0 : -1}
                className="flex h-[44px] items-center"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
