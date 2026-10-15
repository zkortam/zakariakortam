'use client'

import { useSyncExternalStore } from 'react'

/**
 * One global render quality for the whole site, written to <html data-quality="high|medium|low">.
 *
 * Set by <QualityLevel /> from the Compute Pressure API (Chromium), the frame-time watchdog in SmoothScroll
 * (html.lite / html.lite-2, every browser), Save-Data, prefers-reduced-data, and low device memory.
 * Steps down quickly, steps up slowly, so it never flaps. The attribute is absent until measured: treat
 * that as "high".
 *
 * How to use it:
 *  - CSS:   html[data-quality="low"] .thing { filter: none; animation: none; }
 *  - React: const q = useQuality(); if (q === 'low') return <StillFallback />
 *  - Other: getQuality() once, or onQuality(cb) to follow changes (returns an unsubscribe).
 *
 * What each level means:
 *  - high:   everything on.
 *  - medium: keep motion, lower the intensity (smaller blurs, fewer particles, half-resolution canvases).
 *  - low:    no Lenis smooth scroll, no backdrop-filter or heavy filter(), no canvas or WebGL effects
 *            (render a still image instead), no infinite ambient animation.
 */
export type Quality = 'high' | 'medium' | 'low'

export const QUALITY_RANK: Record<Quality, number> = { low: 0, medium: 1, high: 2 }

const listeners = new Set<(q: Quality) => void>()

export function getQuality(): Quality {
  if (typeof document === 'undefined') return 'high'
  const q = document.documentElement.dataset.quality
  return q === 'low' || q === 'medium' ? q : 'high'
}

/** Only the controller should call this. */
export function setQuality(q: Quality) {
  const html = document.documentElement
  if (html.dataset.quality === q) return
  html.dataset.quality = q
  listeners.forEach((l) => l(q))
}

export function onQuality(cb: (q: Quality) => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Current quality level; "high" during SSR and before the first measurement. */
export function useQuality(): Quality {
  return useSyncExternalStore(onQuality, getQuality, () => 'high')
}
