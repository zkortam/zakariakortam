'use client'

import { type ReactNode, type MouseEvent, useCallback } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
}

/** Glass surface whose accent sheen tracks the cursor. */
export function GlassCard({ children, className = '' }: GlassCardProps) {
  const onMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
    el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`)
  }, [])

  return (
    <div onMouseMove={onMove} className={`glass glass-card ${className}`}>
      {children}
    </div>
  )
}
