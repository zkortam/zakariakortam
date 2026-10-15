'use client'

import { useEffect } from 'react'
import { useTransitionNav } from './Transitions'

/** ← and → step through projects; nothing on screen, just faster for anyone who tries it. */
export function ProjectKeys({ prev, next }: { prev: string; next: string }) {
  const { go } = useTransitionNav()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      const t = e.target
      if (t instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return
      if (document.querySelector('.cmdk.open, .menu.open')) return
      if (e.key === 'ArrowRight') go(`/portfolio/${next}`)
      else if (e.key === 'ArrowLeft') go(`/portfolio/${prev}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, prev, next])
  return null
}
