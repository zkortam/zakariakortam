'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The whole body of work in three measured numbers, counting up once when they come into view.
 * Counted from the repositories: TypeScript, TSX, Rust and Python lines, test cases, commits.
 */
const FIGURES = [
  { to: 1.46, fmt: (v: number) => `${v.toFixed(2)}M`, label: 'lines of TypeScript, Rust, and Python' },
  { to: 28295, fmt: (v: number) => Math.round(v).toLocaleString('en-US'), label: 'tests' },
  { to: 8580, fmt: (v: number) => Math.round(v).toLocaleString('en-US'), label: 'commits, all in 2026' },
]

export function BodyOfWork() {
  const ref = useRef<HTMLDivElement>(null)
  const [p, setP] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setP(1)
      return
    }
    let raf = 0
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        const t0 = performance.now()
        const tick = (now: number) => {
          const u = Math.min(1, (now - t0) / 1800)
          setP(1 - Math.pow(1 - u, 4))
          if (u < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      },
      { rootMargin: '0px 0px -20% 0px' },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [])
  return (
    <div ref={ref} className="col-span-full grid grid-cols-1 gap-y-[40px] md:grid-cols-3 md:gap-x-[var(--g)]">
      {FIGURES.map((f) => (
        <div key={f.label} className="bow">
          <p className="bow-v tnum" aria-label={`${f.fmt(f.to)} ${f.label}`} data-final={f.fmt(f.to)}>
            {f.fmt(f.to * p)}
          </p>
          <p className="bow-l">{f.label}</p>
        </div>
      ))}
    </div>
  )
}
