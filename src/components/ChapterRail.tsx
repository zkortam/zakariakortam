'use client'

import { useEffect, useState } from 'react'
import { useLenis } from 'lenis/react'

export type Chapter = { id: string; label: string }

/**
 * Fixed side index that tracks which chapter you're in and lets you jump
 * between them (smooth-scrolled via Lenis). Desktop only.
 */
export function ChapterRail({ chapters }: { chapters: Chapter[] }) {
  const [active, setActive] = useState(chapters[0]?.id)
  const lenis = useLenis()

  useEffect(() => {
    const els = chapters
      .map((c) => document.getElementById(c.id))
      .filter((el): el is HTMLElement => !!el)

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id)
        })
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [chapters])

  const go = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    if (lenis) lenis.scrollTo(el, { offset: -72 })
    else el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav
      aria-label="Sections"
      className="fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-end gap-5 lg:flex"
    >
      {chapters.map((c, i) => {
        const on = active === c.id
        return (
          <button
            key={c.id}
            onClick={() => go(c.id)}
            className="focus-ring group flex items-center gap-3 rounded-full"
            aria-current={on ? 'true' : undefined}
          >
            <span
              className={`font-display text-[11px] tabular-nums transition-all duration-300 ${
                on ? 'text-accent' : 'text-foreground-subtle'
              }`}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <span
              className={`text-[11px] uppercase tracking-[0.14em] transition-all duration-300 ${
                on
                  ? 'text-accent opacity-100'
                  : 'translate-x-1 text-foreground-subtle opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
              }`}
            >
              {c.label}
            </span>
            <span className="relative flex h-3 w-3 items-center justify-center">
              <span
                className={`rounded-full transition-all duration-300 ${
                  on
                    ? 'h-2.5 w-2.5 bg-accent'
                    : 'h-1.5 w-1.5 bg-white/25 group-hover:bg-white/60'
                }`}
              />
            </span>
          </button>
        )
      })}
    </nav>
  )
}
