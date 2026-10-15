'use client'

import { useEffect } from 'react'

/**
 * A soft light that follows the pointer across any card marked [data-light]. Mouse and trackpad only; one listener
 * for the whole site, and a card only takes a style write while the pointer is over it.
 */
export function CardLight() {
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    let raf = 0
    let el: HTMLElement | null = null
    let x = 0
    let y = 0
    const paint = () => {
      raf = 0
      if (!el) return
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${x - r.left}px`)
      el.style.setProperty('--my', `${y - r.top}px`)
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      el = (e.target as Element).closest<HTMLElement>('[data-light]')
      if (!el) return
      x = e.clientX
      y = e.clientY
      if (!raf) raf = requestAnimationFrame(paint)
    }
    document.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('pointermove', onMove)
    }
  }, [])
  return null
}
