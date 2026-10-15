'use client'

import { useEffect, useRef } from 'react'

const TARGETS = '.tile, .plate-link, .early-card, .reel-card'

/**
 * Over a project's picture, a small "View" disc trails the pointer: the whole picture is the link, and this says so.
 * Mouse and trackpad only, motion allowed only; the system cursor stays, and the disc never takes a click.
 */
export function CursorView() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return
    let x = 0
    let y = 0
    let cx = 0
    let cy = 0
    let on = false
    let raf = 0
    const loop = () => {
      cx += (x - cx) * 0.2
      cy += (y - cy) * 0.2
      el.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`
      raf = on || Math.abs(x - cx) > 0.3 || Math.abs(y - cy) > 0.3 ? requestAnimationFrame(loop) : 0
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      x = e.clientX + 18
      y = e.clientY + 18
      const hit = !!(e.target as Element).closest?.(TARGETS)
      if (hit && !on) {
        if (!el.classList.contains('on')) {
          cx = x
          cy = y
        }
        el.classList.add('on')
      } else if (!hit && on) el.classList.remove('on')
      on = hit
      if (!raf) raf = requestAnimationFrame(loop)
    }
    const off = () => {
      on = false
      el.classList.remove('on')
    }
    document.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', off)
    window.addEventListener('zk:route', off)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', off)
      window.removeEventListener('zk:route', off)
    }
  }, [])

  return (
    <div ref={ref} className="cursor-view" aria-hidden="true">
      <span>View</span>
    </div>
  )
}
