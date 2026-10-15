'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTransitionNav } from './Transitions'
import { Icon } from './Icon'

/** Gestures that start here belong to the element, never to page navigation. */
const IGNORE =
  'a,button,input,select,textarea,label,summary,video,audio,iframe,canvas,svg,pre,code,[contenteditable=""],[contenteditable="true"],[role=slider],[role=button],[role=tab],[draggable=true],[data-no-swipe],.demo,.cmdk,.menu'

/** Edge zones the OS keeps for back and forward (iOS Safari, Android gesture nav). */
const EDGE = 24

function scrollsSideways(el: Element | null) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 1) {
      const o = getComputedStyle(n).overflowX
      if (o === 'auto' || o === 'scroll') return true
    }
  }
  return false
}

/**
 * Touch only: a deliberate horizontal swipe turns to the previous or next project through the same
 * transition as a click. The page follows the finger with resistance and the destination's name fades in
 * at the edge it is coming from. Vertical scroll, pinch zoom, sideways scrollers, demo controls and text
 * selection all keep their gestures: the swipe has to start on plain content and read as horizontal.
 */
export function ProjectSwipe({ prev, next, prevTitle, nextTitle }: { prev: string; next: string; prevTitle: string; nextTitle: string }) {
  const { go } = useTransitionNav()
  const prevHint = useRef<HTMLDivElement>(null)
  const nextHint = useRef<HTMLDivElement>(null)
  const tick = useRef<HTMLLabelElement>(null)
  // The hints and the haptic switch live on <body>: #page is what moves, and a moved ancestor would carry them.
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => setHost(document.body), [])

  useEffect(() => {
    if (!host) return
    if (!window.matchMedia('(hover: none) and (pointer: coarse)').matches) return
    const html = document.documentElement
    const page = document.getElementById('page')
    if (!page) return
    html.classList.add('swipe-nav')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    type S = { x: number; y: number; t: number; axis: 'x' | 'y' | null; dx: number; lx: number; lt: number; v: number }
    let s: S | null = null
    let committed = false

    const hints = () => [prevHint.current, nextHint.current]
    const paint = (dx: number) => {
      const w = window.innerWidth
      const dir = dx < 0 ? 'next' : 'prev'
      const amt = Math.min(1, Math.abs(dx) / Math.min(120, w * 0.28))
      if (!reduced) {
        // Resistance: the page gives at most 56px however far the finger goes.
        const off = Math.sign(dx) * 56 * (1 - Math.exp(-Math.abs(dx) / 160))
        page.style.translate = `${off.toFixed(1)}px 0`
      }
      const [p, n] = hints()
      const on = dir === 'next' ? n : p
      const off = dir === 'next' ? p : n
      if (on) {
        on.style.opacity = String(amt)
        if (!reduced) on.style.translate = `${(dir === 'next' ? 1 : -1) * 12 * (1 - amt)}px -50%`
      }
      if (off) off.style.opacity = '0'
    }
    const settle = (animate: boolean) => {
      const ease = 'var(--e-quint)'
      page.style.transition = animate && !reduced ? `translate 420ms ${ease}, opacity 320ms ${ease}` : ''
      page.style.translate = ''
      hints().forEach((h) => {
        if (!h) return
        h.style.transition = animate ? `opacity 240ms ${ease}, translate 420ms ${ease}` : 'none'
        h.style.opacity = '0'
      })
      window.setTimeout(() => {
        page.style.transition = ''
        hints().forEach((h) => h && (h.style.transition = ''))
      }, 440)
    }
    const haptic = () => {
      try {
        navigator.vibrate?.(8)
      } catch {
        /* not allowed */
      }
      // iOS 18+: a native switch toggled by a real tap plays the system haptic; a label click inside this
      // touchend counts as one. Elsewhere it just flips a hidden checkbox.
      tick.current?.click()
    }

    const onStart = (e: TouchEvent) => {
      s = null
      if (committed || e.touches.length !== 1 || html.dataset.route) return
      const t = e.touches[0]
      if (t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return
      const target = e.target instanceof Element ? e.target : null
      if (!target || target.closest(IGNORE) || scrollsSideways(target)) return
      if (document.querySelector('.cmdk.open, .menu.open')) return
      const sel = window.getSelection()
      if (sel && !sel.isCollapsed) return
      const now = e.timeStamp
      s = { x: t.clientX, y: t.clientY, t: now, axis: null, dx: 0, lx: t.clientX, lt: now, v: 0 }
    }
    const onMove = (e: TouchEvent) => {
      if (!s) return
      if (e.touches.length !== 1) {
        if (s.axis === 'x') settle(true)
        s = null
        return
      }
      const t = e.touches[0]
      const dx = t.clientX - s.x
      const dy = t.clientY - s.y
      if (!s.axis) {
        if (Math.hypot(dx, dy) < 12) return
        // A press held before moving is a selection or a long-press, not a swipe.
        if (e.timeStamp - s.t > 450) {
          s = null
          return
        }
        // Within about 27 degrees of horizontal, or it is a scroll.
        s.axis = Math.abs(dx) > Math.abs(dy) * 2 ? 'x' : 'y'
        if (s.axis === 'y') {
          s = null
          return
        }
        page.style.transition = ''
        hints().forEach((h) => h && (h.style.transition = 'none'))
      }
      const dt = e.timeStamp - s.lt
      if (dt > 0) s.v = 0.7 * ((t.clientX - s.lx) / dt) + 0.3 * s.v
      s.lx = t.clientX
      s.lt = e.timeStamp
      s.dx = dx
      paint(dx)
    }
    const onEnd = () => {
      const g = s
      s = null
      if (!g || g.axis !== 'x') return
      const dist = Math.abs(g.dx)
      const far = dist > Math.min(120, window.innerWidth * 0.28)
      const flick = dist > 48 && Math.abs(g.v) > 0.45 && Math.sign(g.v) === Math.sign(g.dx)
      if (!far && !flick) {
        settle(true)
        return
      }
      committed = true
      haptic()
      go(`/portfolio/${g.dx < 0 ? next : prev}`)
    }
    const onCancel = () => {
      if (s?.axis === 'x') settle(true)
      s = null
    }

    const opts = { passive: true } as const
    document.addEventListener('touchstart', onStart, opts)
    document.addEventListener('touchmove', onMove, opts)
    document.addEventListener('touchend', onEnd, opts)
    document.addEventListener('touchcancel', onCancel, opts)
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onCancel)
      html.classList.remove('swipe-nav')
      settle(false)
    }
  }, [go, prev, next, host])

  if (!host) return null
  return createPortal(
    <>
      <div ref={prevHint} className="swipe-hint swipe-prev" aria-hidden="true">
        <span><Icon name="arrow-left" size="1em" strokeWidth={2.25} className="ar" /></span> {prevTitle}
      </div>
      <div ref={nextHint} className="swipe-hint swipe-next" aria-hidden="true">
        {nextTitle} <span><Icon name="arrow-right" size="1em" strokeWidth={2.25} className="ar" /></span>
      </div>
      <label ref={tick} className="haptic" aria-hidden="true">
        <input type="checkbox" tabIndex={-1} {...{ switch: '' }} />
      </label>
    </>,
    host,
  )
}
