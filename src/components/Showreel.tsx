'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { TLink } from './TLink'
import { featuredProjects } from '@/lib/projects-data'
import { PLATES } from '@/lib/media'
import { domainOf } from '@/lib/site'

const HOLD = 4200

/**
 * Every product's live site in one rounded frame. As the section scrolls in, the frame opens from an inset window to
 * the full panel; inside, the sites cross-fade with a slow push. A glass caption names the one on screen and links
 * to it, and a pause button stops the rotation. Under reduced motion the frame is open and still.
 */
export function Showreel() {
  const items = featuredProjects.filter((p) => PLATES[p.id])
  const root = useRef<HTMLElement>(null)
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const [visible, setVisible] = useState(false)

  // Scroll opens the frame: progress 0 when the section's top reaches the bottom of the screen, 1 once it fills it.
  useEffect(() => {
    const el = root.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.setProperty('--p', '1')
      return
    }
    let raf = 0
    const update = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.9)))
      el.style.setProperty('--p', p.toFixed(4))
    }
    const on = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
    }
  }, [])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (paused || !visible || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setTimeout(() => setI((v) => (v + 1) % items.length), HOLD)
    return () => clearTimeout(t)
  }, [i, paused, visible, items.length])

  const cur = items[i]
  return (
    <section ref={root} className="show" aria-label="Products">
      <div className="show-frame">
        {items.map((p, k) => {
          const { a, b1 } = PLATES[p.id].stills
          return (
            <div key={p.id} className={`show-slide ${k === i ? 'on' : ''}`} aria-hidden={k !== i}>
              <Image src={a.src} alt={a.alt} fill sizes="100vw" quality={82} className="show-img show-wide" priority={k === 0} />
              <Image src={b1.src} alt={b1.alt} fill sizes="100vw" quality={82} className="show-img show-tall" />
            </div>
          )
        })}
        <div className="show-bar">
          <TLink href={`/portfolio/${cur.id}`} className="show-cap glass-pill">
            <span className="show-name">{cur.title}</span>
            <span className="show-dom">{cur.links?.live ? domainOf(cur.links.live) : cur.year}</span>
          </TLink>
          <button type="button" className="show-pause glass-pill" onClick={() => setPaused((v) => !v)} aria-label={paused ? 'Play' : 'Pause'}>
            {paused ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8.5 5.5v13M15.5 5.5v13" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </section>
  )
}
