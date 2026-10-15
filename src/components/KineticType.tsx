'use client'

import { useEffect } from 'react'

/*
 * The wordmark carries a little mass. Scroll speed stretches it a hair along the direction of travel,
 * the trailing edge lagging, and a near-critically damped spring brings it home. Max 2.4%, transform
 * only, on the .wordmark element itself (its parts keep their own entrance animations). Only runs
 * while a wordmark is on screen, never with reduced motion or on a struggling machine (html.lite-2).
 */

const MAX = 0.024
const GAIN = 0.0065 // per px/ms of scroll speed
const K = 220 // spring stiffness
const ZETA = 0.86 // damping ratio: settles with the faintest overshoot, never wobbles

export function KineticType() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const html = document.documentElement
    const visible = new Set<HTMLElement>()
    let raf = 0
    let lastY = window.scrollY
    let lastT = performance.now()
    let vel = 0 // smoothed px/ms, signed
    let s = 0 // stretch, signed (positive: scrolling down)
    let sv = 0

    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        const el = e.target as HTMLElement
        if (e.isIntersecting) visible.add(el)
        else {
          visible.delete(el)
          el.style.transform = ''
          el.style.willChange = ''
        }
      }
    })
    const watch = () => document.querySelectorAll<HTMLElement>('.wordmark').forEach((el) => io.observe(el))
    watch()

    const write = () => {
      const a = Math.abs(s)
      const t = a < 0.0002 ? '' : `scaleY(${(1 + a).toFixed(4)})`
      visible.forEach((el) => {
        // Trailing edge lags: moving up the page (scrolling down) pins the top, scrolling up pins the baseline.
        el.style.transformOrigin = s >= 0 ? '50% 0%' : '50% 100%'
        el.style.transform = t
        // Its own layer while moving, so the compositor scales the raster instead of repainting the paths.
        el.style.willChange = t ? 'transform' : ''
      })
    }

    const tick = () => {
      raf = 0
      const now = performance.now()
      const dt = Math.max(1, Math.min(48, now - lastT))
      lastT = now
      const y = window.scrollY
      const inst = dt > 0 ? (y - lastY) / dt : 0
      lastY = y
      vel += (inst - vel) * Math.min(1, dt / 60)
      const target = Math.max(-MAX, Math.min(MAX, vel * GAIN))
      const h = dt / 1000
      const c = 2 * ZETA * Math.sqrt(K)
      sv += (K * (target - s) - c * sv) * h
      s += sv * h
      // Never let the stretch cross zero by overshoot into the other origin: clamp at rest instead.
      if (Math.sign(s) !== Math.sign(target) && Math.abs(target) < 1e-4 && Math.abs(s) < 0.002) {
        s = 0
        sv = 0
      }
      write()
      const busy = Math.abs(s) > 0.0002 || Math.abs(sv) > 0.0005 || Math.abs(vel) > 0.01
      if (busy && visible.size) raf = requestAnimationFrame(tick)
    }

    const onScroll = () => {
      if (raf || !visible.size || html.classList.contains('lite-2')) return
      lastT = performance.now()
      lastY = window.scrollY
      raf = requestAnimationFrame(tick)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    const onRoute = () => {
      lastY = window.scrollY
      vel = s = sv = 0
      visible.clear()
      io.disconnect()
      watch()
    }
    window.addEventListener('zk:route', onRoute)

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('zk:route', onRoute)
      document.querySelectorAll<HTMLElement>('.wordmark').forEach((el) => (el.style.transform = ''))
    }
  }, [])

  return null
}
