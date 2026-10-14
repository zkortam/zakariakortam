'use client'

import { useRef, type ReactNode } from 'react'

/**
 * Glass that catches the light: a soft specular spot follows the pointer
 * across the surface, and the edge brightens nearest the cursor.
 */
export function Sheen({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const move = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el || e.pointerType !== 'mouse') return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }
  return (
    <div ref={ref} onPointerMove={move} className={`sheen ${className}`}>
      {children}
    </div>
  )
}
