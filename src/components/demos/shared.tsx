'use client'

import { Geist_Mono } from 'next/font/google'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export const mono = Geist_Mono({ subsets: ['latin'], display: 'swap' })

/**
 * True while the element is on screen (and motion is allowed); demos only run while visible.
 * `near` turns true once the demo is within a screen or so of the viewport and stays true, so heavy
 * code (engines, workers) can start loading just before the visitor arrives.
 */
export function useLive<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [live, setLive] = useState(false)
  const [near, setNear] = useState(false)
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onMq = () => setReduced(mq.matches)
    mq.addEventListener('change', onMq)
    const el = ref.current
    if (!el) return () => mq.removeEventListener('change', onMq)
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting), { rootMargin: '0px 0px -10% 0px' })
    const nio = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        setNear(true)
        nio.disconnect()
      },
      { rootMargin: '100% 0px 100% 0px' },
    )
    io.observe(el)
    nio.observe(el)
    return () => {
      io.disconnect()
      nio.disconnect()
      mq.removeEventListener('change', onMq)
    }
  }, [])
  return { ref, live, near, reduced }
}

/** rAF loop with elapsed seconds, paused while not live. */
export function useClock(live: boolean, cb: (t: number, dt: number) => void) {
  const cbRef = useRef(cb)
  cbRef.current = cb
  useEffect(() => {
    if (!live) return
    let raf = 0
    let last = performance.now()
    let t = 0
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      t += dt
      cbRef.current(t, dt)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [live])
}

/** The stage every demo sits on: a dark, lit panel with a quiet caption row underneath. */
export function Stage({
  children,
  caption,
  className = '',
}: {
  children: ReactNode
  caption?: ReactNode
  className?: string
}) {
  return (
    <figure className={`demo ${className}`}>
      <div className="demo-stage">{children}</div>
      {caption && <figcaption className="demo-cap">{caption}</figcaption>}
    </figure>
  )
}
