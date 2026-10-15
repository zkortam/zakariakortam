'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { warm } from '@/lib/warm'

/**
 * Intent prefetch. The moment a pointer rests on, a finger lands on, or focus reaches an internal link, the
 * route payload is requested and the pictures the next page opens on start downloading, so by the time the
 * 200ms leave fade is done the new page paints complete. Also retires the pre-hydration speculation rules.
 */
export function Warm() {
  const router = useRouter()
  useEffect(() => {
    document.getElementById('zk-spec')?.remove()

    const seen = new Set<string>()
    const intent = (e: Event) => {
      const t = e.target
      if (!(t instanceof Element)) return
      const a = t.closest<HTMLAnchorElement>('a[href]')
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
      let url: URL
      try {
        url = new URL(a.href, location.href)
      } catch {
        return
      }
      if (url.origin !== location.origin || url.pathname === location.pathname) return
      const path = url.pathname
      if (seen.has(path)) return
      seen.add(path)
      router.prefetch(path)
      warm(path)
    }
    // Printing: pictures the screen never needed (the other breakpoint's hero, tiles below the fold) are
    // lazy and would print as blanks. Ask for them all the moment a print starts.
    const beforePrint = () => {
      document.querySelectorAll<HTMLImageElement>('.plate[data-flip-target] img[loading="lazy"]').forEach((img) => (img.loading = 'eager'))
    }
    window.addEventListener('beforeprint', beforePrint)

    const opts = { passive: true, capture: true } as const
    document.addEventListener('pointerover', intent, opts)
    document.addEventListener('touchstart', intent, opts)
    document.addEventListener('focusin', intent, opts)
    return () => {
      document.removeEventListener('pointerover', intent, opts)
      document.removeEventListener('touchstart', intent, opts)
      document.removeEventListener('focusin', intent, opts)
      window.removeEventListener('beforeprint', beforePrint)
    }
  }, [router])
  return null
}
