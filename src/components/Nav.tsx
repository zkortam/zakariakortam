'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { TLink } from './TLink'
import { MobileMenu } from './MobileMenu'
import { EMAIL, NAV } from '@/lib/site'

function isActive(pathname: string, href: string) {
  return pathname === href || (href === '/portfolio' && pathname.startsWith('/portfolio'))
}

export function Nav() {
  const pathname = usePathname()
  const ref = useRef<HTMLElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  // Close the menu on route change (instantly).
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Tone: the section under the bar decides ink or bone.
  useEffect(() => {
    const nav = ref.current
    if (!nav) return
    const live = new Set<Element>()
    const pick = () => {
      let best: Element | null = null
      let bestTop = -Infinity
      live.forEach((el) => {
        const t = el.getBoundingClientRect().top
        if (t > bestTop) {
          bestTop = t
          best = el
        }
      })
      const tone = best ? (best as HTMLElement).dataset.tone : 'dark'
      if (tone && nav.dataset.tone !== tone) nav.dataset.tone = tone
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) live.add(e.target)
          else live.delete(e.target)
        }
        pick()
      },
      { rootMargin: '0px 0px -94% 0px', threshold: 0 },
    )
    document.querySelectorAll('#page [data-tone]').forEach((el) => io.observe(el))
    // On a route commit, settle the tone in the same frame instead of waiting for the observer.
    const now = () => {
      const edge = window.innerHeight * 0.06
      let tone = 'dark'
      document.querySelectorAll<HTMLElement>('#page [data-tone]').forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.top <= edge && r.bottom > 0) tone = el.dataset.tone || tone
      })
      nav.dataset.tone = tone
    }
    window.addEventListener('zk:route', now)
    return () => {
      io.disconnect()
      window.removeEventListener('zk:route', now)
    }
  }, [pathname])

  // Hide on scroll down, show on scroll up; glass only once content is under the bar.
  useEffect(() => {
    const nav = ref.current
    if (!nav) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let lastY = window.scrollY
    let down = 0
    let up = 0
    let raf = 0
    let nearTop = false
    const apply = () => {
      raf = 0
      const y = window.scrollY
      const dy = y - lastY
      lastY = y
      nav.classList.toggle('glassy', y >= 80)
      if (reduced || y <= 400 || nearTop) {
        nav.classList.remove('hide')
        down = up = 0
        return
      }
      if (dy > 0) {
        down += dy
        up = 0
        if (down > 6) nav.classList.add('hide')
      } else if (dy < 0) {
        up -= dy
        down = 0
        if (up > 6) nav.classList.remove('hide')
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply)
    }
    const onMove = (e: PointerEvent) => {
      const near = e.clientY < 72
      if (near !== nearTop) {
        nearTop = near
        if (near) nav.classList.remove('hide')
      }
    }
    const onRoute = () => {
      lastY = window.scrollY
      down = up = 0
      nav.classList.toggle('glassy', lastY >= 80)
      nav.classList.remove('hide')
    }
    apply()
    window.addEventListener('zk:route', onRoute)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('zk:route', onRoute)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])

  return (
    <>
      <header ref={ref} className={`nav ${open ? 'menu-open' : ''}`} data-tone="dark">
        <div aria-hidden="true" className="gl glass-dark" />
        <div aria-hidden="true" className="gl glass-light" />
        <div className="grid-main nav-inner text-body">
          <TLink href="/" className="u-box u-hover col-span-2 justify-self-start font-medium md:col-span-6">
            Zakaria Kortam
            <span aria-hidden="true" className="u-line" />
          </TLink>
          <nav aria-label="Primary" className="hidden md:col-span-4 md:col-start-7 md:flex md:gap-[28px]">
            {NAV.map((l) => (
              <TLink
                key={l.href}
                href={l.href}
                aria-current={isActive(pathname, l.href) ? 'page' : undefined}
                className={`u-box u-hover ${isActive(pathname, l.href) ? 'u-on' : ''}`}
              >
                {l.label}
                <span aria-hidden="true" className="u-line" />
              </TLink>
            ))}
          </nav>
          <span className="hidden justify-self-end md:col-span-2 md:col-start-11 md:block">
            <a href={`mailto:${EMAIL}`} className="u-box u-hover" data-align="end">
              Email
              <span aria-hidden="true" className="u-line" />
            </a>
          </span>
          <button
            ref={btn}
            type="button"
            className="nav-menu-btn col-span-2 col-start-3 -my-[12px] h-[44px] justify-self-end md:hidden"
            aria-expanded={open}
            aria-controls="menu"
            onClick={() => setOpen((o) => !o)}
            data-align="end"
          >
            <span className={`roll ${open ? 'on' : ''}`}>
              <span>
                <span>Menu</span>
                <span aria-hidden={!open}>Close</span>
              </span>
            </span>
            <span className="sr-only">{open ? ', menu open' : ''}</span>
          </button>
          <div className="nav-nojs col-span-2 col-start-3 justify-self-end gap-[16px] md:hidden">
            {NAV.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </header>
      <MobileMenu open={open} onClose={close} returnTo={btn} />
    </>
  )
}
