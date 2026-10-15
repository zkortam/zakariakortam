'use client'

import { useEffect, useRef } from 'react'

/**
 * A small picture that floats beside the cursor over list rows that have one ([data-preview] on the row).
 * Mouse and trackpad only, motion allowed only. It sits above or below the hovered row, never on it,
 * follows the pointer sideways with a soft lag, stays inside the viewport and never takes a click.
 * Rows without a picture show nothing.
 */
const W = 280
const H = 175
const GAP = 14

export function RowPreview() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const box = ref.current
    const scope = box?.parentElement
    if (!box || !scope) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return
    const img = box.querySelector('img')
    if (!img) return

    let row: HTMLElement | null = null
    let tx = 0
    let ty = 0
    let cx = 0
    let cy = 0
    let px = 0
    let raf = 0
    let shown = false

    const place = () => {
      if (!row) return
      const r = row.getBoundingClientRect()
      const vw = document.documentElement.clientWidth
      tx = Math.max(16, Math.min(vw - W - 16, px - W / 2))
      // Above the row when there is room under the bar, otherwise below it.
      ty = r.top - H - GAP > 84 ? r.top - H - GAP : r.bottom + GAP
    }
    const loop = () => {
      cx += (tx - cx) * 0.16
      cy += (ty - cy) * 0.2
      box.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`
      if (shown || Math.abs(tx - cx) > 0.5 || Math.abs(ty - cy) > 0.5) raf = requestAnimationFrame(loop)
      else raf = 0
    }
    const run = () => {
      if (!raf) raf = requestAnimationFrame(loop)
    }
    const hide = () => {
      shown = false
      row = null
      box.classList.remove('on')
    }
    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const li = (e.target as Element).closest<HTMLElement>('[data-preview]')
      if (!li || !scope.contains(li)) {
        if (!(e.target as Element).closest('.rows > li')) hide()
        else if (row) hide()
        return
      }
      if (li === row) return
      const src = li.dataset.preview!
      const first = !shown
      row = li
      px = e.clientX
      place()
      if (first) {
        // Appear where it is going, not fly in from the last row.
        cx = tx
        cy = ty
      }
      if (img.getAttribute('src') !== src) img.setAttribute('src', src)
      shown = true
      const show = () => row === li && box.classList.add('on')
      if (img.complete && img.naturalWidth) show()
      else img.decode().then(show, hide)
      run()
    }
    const onMove = (e: PointerEvent) => {
      if (!row || e.pointerType !== 'mouse') return
      px = e.clientX
      place()
      run()
    }
    scope.addEventListener('pointerover', onOver)
    scope.addEventListener('pointermove', onMove, { passive: true })
    scope.addEventListener('pointerleave', hide)
    window.addEventListener('scroll', hide, { passive: true })
    window.addEventListener('zk:route', hide)
    return () => {
      cancelAnimationFrame(raf)
      scope.removeEventListener('pointerover', onOver)
      scope.removeEventListener('pointermove', onMove)
      scope.removeEventListener('pointerleave', hide)
      window.removeEventListener('scroll', hide)
      window.removeEventListener('zk:route', hide)
    }
  }, [])

  return (
    <div ref={ref} className="row-preview" aria-hidden="true">
      <img alt="" decoding="async" />
    </div>
  )
}
