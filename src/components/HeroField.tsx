'use client'

import { useEffect, useRef, useState } from 'react'
import { FieldRenderer } from '@/lib/field'
import { hasGpu } from '@/lib/gpu'
import { getQuality, onQuality } from '@/lib/quality'

/**
 * The sea of light behind the portrait. Optional by construction: without WebGL2, on software rendering or at low
 * quality it never mounts, and the bloom under it is the hero. It draws only while the hero is on screen and the tab is
 * visible; under reduced motion it holds one still frame. The cursor parts it on desktop.
 */
export function HeroField() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [live, setLive] = useState(false)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const ok = () => hasGpu() && getQuality() !== 'low'
    setAllowed(ok())
    return onQuality(() => setAllowed(ok()))
  }, [])

  useEffect(() => {
    const canvas = ref.current
    const hero = canvas?.closest<HTMLElement>('.hero')
    if (!allowed || !canvas || !hero) return
    const small = window.matchMedia('(max-width: 767px)').matches
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const medium = getQuality() === 'medium'
    let r: FieldRenderer
    try {
      r = small ? new FieldRenderer(canvas, 300, 180) : medium ? new FieldRenderer(canvas, 380, 210) : new FieldRenderer(canvas, 560, 280)
    } catch {
      return
    }
    const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2)
    let width = 0
    const size = (force = false) => {
      const b = hero.getBoundingClientRect()
      // On phones the toolbar resizes the window as you scroll; only a new width is a new canvas.
      if (!force && small && Math.abs(b.width - width) < 1) return
      width = b.width
      r.resize(b.width, b.height, dpr)
    }
    size(true)
    const onResize = () => size()
    window.addEventListener('resize', onResize)

    const target = { x: 0, y: -2, on: 0 }
    const pointer = { x: 0, y: -2, on: 0 }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const b = hero.getBoundingClientRect()
      target.x = ((e.clientX - b.left) / b.width) * 2 - 1
      target.y = 1 - ((e.clientY - b.top) / b.height) * 2
      target.on = 1
    }
    const onLeave = () => {
      target.on = 0
    }
    hero.addEventListener('pointermove', onMove, { passive: true })
    hero.addEventListener('pointerleave', onLeave)

    // The sea rises once the opening gate has parted.
    const html = document.documentElement
    let riseAt = html.dataset.intro === 'play' && !html.classList.contains('go') ? Infinity : performance.now() + 150
    const gate = new MutationObserver(() => {
      if (riseAt === Infinity && html.classList.contains('go')) riseAt = performance.now() + 500
    })
    gate.observe(html, { attributes: true, attributeFilter: ['class'] })
    const fallback = window.setTimeout(() => {
      if (riseAt === Infinity) riseAt = performance.now()
    }, 1500)

    let raf = 0
    let first = true
    let visible = true
    const t0 = performance.now()
    const frame = (now: number) => {
      pointer.x += (target.x - pointer.x) * 0.12
      pointer.y += (target.y - pointer.y) * 0.12
      pointer.on += (target.on - pointer.on) * 0.06
      const k = reduce ? 1 : Math.min(1, Math.max(0, (now - riseAt) / 2600))
      const rise = 1 - Math.pow(1 - k, 3)
      const scrolled = Math.min(1, window.scrollY / Math.max(1, hero.offsetHeight))
      r.draw(
        { time: reduce ? 6 : (now - t0) / 1000, pointer: [pointer.x, pointer.y], pointerOn: pointer.on, shift: (small ? 0.2 : 0) - scrolled * 0.35, rise, gain: small ? 1.25 : 0.82 },
        (small ? 1.7 : 1.8) * dpr,
      )
      if (first) {
        first = false
        setLive(true)
      }
      raf = reduce && k >= 1 ? 0 : requestAnimationFrame(frame)
    }
    const start = () => {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      cancelAnimationFrame(raf)
      raf = 0
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible) start()
      else stop()
    })
    io.observe(hero)
    const onVis = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVis)
    start()

    return () => {
      stop()
      io.disconnect()
      gate.disconnect()
      clearTimeout(fallback)
      window.removeEventListener('resize', onResize)
      hero.removeEventListener('pointermove', onMove)
      hero.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVis)
      r.dispose()
    }
  }, [allowed])

  if (!allowed) return null
  return <canvas ref={ref} aria-hidden="true" className="hero-field" style={{ opacity: live ? 1 : 0 }} />
}
