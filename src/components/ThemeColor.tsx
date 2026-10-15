'use client'

import { useEffect } from 'react'

const OX = '#14060A'
const PAPER = '#EEEAE4'

function hex(c: string): string | null {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c)
  if (!m || (m[4] !== undefined && +m[4] < 0.99)) return null
  return '#' + [m[1], m[2], m[3]].map((v) => (+v).toString(16).padStart(2, '0')).join('').toUpperCase()
}

/** The ground of the section under the top edge: its solid color, else the first stop of its plate ground. */
function groundAtTop(): string {
  if (document.querySelector('.menu.open')) return OX
  const edge = 2
  let pick: HTMLElement | null = null
  document.querySelectorAll<HTMLElement>('#page [data-tone]').forEach((el) => {
    const r = el.getBoundingClientRect()
    if (r.top <= edge && r.bottom > edge) pick = el
  })
  const el = pick as HTMLElement | null
  if (!el) return OX
  const cs = getComputedStyle(el)
  const solid = hex(cs.backgroundColor)
  if (solid) return solid
  const stop = /#[0-9a-f]{6}/i.exec(cs.getPropertyValue('--ground'))
  if (stop) return stop[0].toUpperCase()
  return el.dataset.tone === 'light' ? PAPER : OX
}

/**
 * Browser chrome (Android Chrome, iOS Safari before 26) takes the color of the section under it, so the
 * status bar and toolbar read as part of the page. Follows the bar's tone changes, which the Nav already
 * computes, plus route changes and the menu.
 */
export function ThemeColor() {
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.appendChild(meta)
    }
    const m = meta
    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const c = groundAtTop()
        if (m.content !== c) m.content = c
      })
    }
    const nav = document.querySelector('.nav')
    const mo = new MutationObserver(update)
    if (nav) mo.observe(nav, { attributes: true, attributeFilter: ['data-tone', 'class'] })
    // A thin line under the top edge: fires only when a section crosses it, never per scroll frame.
    const io = new IntersectionObserver(update, { rootMargin: '0px 0px -99% 0px', threshold: 0 })
    const watch = () => {
      io.disconnect()
      document.querySelectorAll('#page [data-tone]').forEach((el) => io.observe(el))
      update()
    }
    watch()
    window.addEventListener('zk:route', watch)
    return () => {
      cancelAnimationFrame(raf)
      mo.disconnect()
      io.disconnect()
      window.removeEventListener('zk:route', watch)
    }
  }, [])
  return null
}
