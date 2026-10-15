'use client'

import { useEffect, useRef, useState } from 'react'
import { getLenis } from '@/lib/lenis'
import {
  citeBlockOf,
  parseDirective,
  rangeForDirective,
  sentenceAround,
  slugOf,
  squash,
  supportsTextFragments,
  textDirective,
  CITE_BLOCKS,
  CITE_EXCLUDE,
} from '@/lib/textFragment'

const FADE_STEPS = ['zk-cite', 'zk-cite-1', 'zk-cite-2', 'zk-cite-3', 'zk-cite-4', 'zk-cite-5']

/** Build the link for a passage inside a block: #s-<slug> for any browser, then the text directive. */
function linkFor(block: HTMLElement, passage?: string): string {
  const blockText = squash(block.textContent ?? '')
  const pageText = squash(document.body.innerText || '')
  const directive = textDirective(passage || blockText, blockText, pageText)
  const base = location.origin + location.pathname
  return `${base}#s-${slugOf(blockText)}${directive ? ':~:' + directive : ''}`
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    ta.remove()
    return ok
  }
}

/** The selection, if it sits inside one linkable block. */
function selectionInBlock(): { block: HTMLElement; passage: string } | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null
  const block = citeBlockOf(sel.anchorNode)
  if (!block || citeBlockOf(sel.focusNode) !== block) return null
  const blockText = squash(block.textContent ?? '')
  const picked = squash(sel.toString())
  if (!picked) return null
  if (picked.split(' ').length >= 6) return { block, passage: picked }
  const at = blockText.indexOf(picked)
  return { block, passage: at === -1 ? blockText : sentenceAround(blockText, at, at + picked.length) }
}

function flash(range: Range, block: HTMLElement | null) {
  const reg = (globalThis as { CSS?: { highlights?: Map<string, unknown> } }).CSS?.highlights
  const H = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight
  if (reg && H) {
    const h = new H(range)
    let i = 0
    reg.set(FADE_STEPS[0], h)
    const step = () => {
      reg.delete(FADE_STEPS[i])
      i++
      if (i >= FADE_STEPS.length) return
      reg.set(FADE_STEPS[i], h)
      window.setTimeout(step, 220)
    }
    window.setTimeout(step, 2800)
    return
  }
  if (!block) return
  block.classList.remove('cite-flash')
  void block.offsetWidth
  block.classList.add('cite-flash')
  window.setTimeout(() => block.classList.remove('cite-flash'), 4000)
}

function scrollToRange(range: Range) {
  const r = range.getBoundingClientRect()
  const y = Math.max(0, r.top + window.scrollY - window.innerHeight * 0.36)
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const lenis = getLenis()
  if (lenis) lenis.scrollTo(y, { duration: reduced ? 0 : 1.4, immediate: reduced, force: true })
  else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' })
}

/** Resolve an incoming #s-slug or #:~:text= link that the browser did not handle itself. */
function openFromUrl(raw: string, nativeHandled: boolean) {
  if (nativeHandled) return
  const hash = decodeURIComponent(raw.split('#')[1] ?? '')
  const d = parseDirective(raw)
  let range: Range | null = null
  let block: HTMLElement | null = null
  const main = document.getElementById('main') ?? document.body
  if (d) {
    range = rangeForDirective(d, main) ?? rangeForDirective(d)
    block = range ? citeBlockOf(range.startContainer) : null
  }
  if (!range) {
    const slug = /^s-([\w-]+)/.exec(hash)?.[1]
    if (!slug) return
    block =
      Array.from(document.querySelectorAll<HTMLElement>(CITE_BLOCKS)).find(
        (b) => !b.closest(CITE_EXCLUDE) && slugOf(b.textContent ?? '').startsWith(slug),
      ) ?? null
    if (!block) return
    range = document.createRange()
    range.selectNodeContents(block)
  }
  scrollToRange(range)
  flash(range, block)
}

/**
 * Link to any sentence. Fine pointers get a small link mark in the margin beside the hovered paragraph or
 * heading; touch gets a quiet "Copy link" under a long-press selection. Links carry a text fragment plus a
 * plain anchor, and incoming ones are scrolled to and briefly lit.
 */
export function SentenceLinks() {
  const btn = useRef<HTMLButtonElement>(null)
  const pill = useRef<HTMLButtonElement>(null)
  const current = useRef<HTMLElement | null>(null)
  const [toast, setToast] = useState(0)

  // Incoming links.
  useEffect(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const navUrl = nav?.name ?? ''
    // Chromium strips the directive from location.hash and scrolls and highlights natively (::target-text).
    const native = supportsTextFragments() && navUrl.includes(':~:text=')
    const raw = native ? navUrl : location.href
    if (!/#s-|:~:text=/.test(raw)) return
    let done = false
    const run = () => {
      if (done) return
      done = true
      openFromUrl(raw, native)
    }
    // After fonts and the heading line-splits settle, so the target does not move under the scroll.
    const t = window.setTimeout(run, 2000)
    document.fonts?.ready.then(() => window.setTimeout(run, 450))
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const onHash = () => openFromUrl(location.href, false)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Margin link mark for fine pointers.
  useEffect(() => {
    const b = btn.current
    if (!b) return
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    let hideT = 0
    let raf = 0
    let lastEvent: PointerEvent | null = null

    const hide = () => {
      clearTimeout(hideT)
      current.current = null
      b.classList.remove('on')
    }
    const place = (block: HTMLElement) => {
      const range = document.createRange()
      range.selectNodeContents(block)
      const first = Array.from(range.getClientRects()).find((r) => r.width > 0 && r.height > 0)
      const box = block.getBoundingClientRect()
      if (!first) return hide()
      const size = 24
      const left = box.left - size - 8
      if (left < 0) return hide()
      const lh = parseFloat(getComputedStyle(block).lineHeight) || first.height
      const top = first.top + Math.min(first.height, lh) / 2 - size / 2
      b.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`
      b.style.color = getComputedStyle(block).color
      current.current = block
      b.classList.add('on')
    }
    const evaluate = () => {
      raf = 0
      const e = lastEvent
      if (!e || !fine.matches) return
      if (e.buttons) return hide()
      const target = e.target as Node
      if (b.contains(target)) {
        clearTimeout(hideT)
        return
      }
      const block = citeBlockOf(target)
      if (block) {
        clearTimeout(hideT)
        if (block !== current.current) place(block)
        return
      }
      if (current.current && !hideT) {
        hideT = window.setTimeout(() => {
          hideT = 0
          hide()
        }, 320)
      }
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
      lastEvent = e
      if (!raf) raf = requestAnimationFrame(evaluate)
    }
    const onScroll = () => {
      if (current.current) hide()
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('zk:route', hide)
    document.addEventListener('pointerleave', hide)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(hideT)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('zk:route', hide)
      document.removeEventListener('pointerleave', hide)
    }
  }, [])

  // Touch: a long-press selection offers "Copy link" just below it.
  useEffect(() => {
    const p = pill.current
    if (!p) return
    let touch = false
    let down = false
    let t = 0
    const hide = () => p.classList.remove('on')
    const check = () => {
      clearTimeout(t)
      if (!touch) return hide()
      t = window.setTimeout(() => {
        if (down) return
        const s = selectionInBlock()
        const sel = window.getSelection()
        if (!s || !sel?.rangeCount) return hide()
        const rects = Array.from(sel.getRangeAt(0).getClientRects()).filter((r) => r.width > 0)
        const last = rects[rects.length - 1]
        if (!last) return hide()
        const w = p.offsetWidth || 120
        const x = Math.min(window.innerWidth - w - 12, Math.max(12, last.left + last.width / 2 - w / 2))
        const y = Math.min(window.innerHeight - 64, last.bottom + 36)
        p.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`
        p.classList.add('on')
      }, 380)
    }
    const onDown = (e: PointerEvent) => {
      if (p.contains(e.target as Node)) return
      touch = e.pointerType === 'touch'
      down = true
    }
    const onUp = () => {
      down = false
      check()
    }
    document.addEventListener('selectionchange', check)
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    window.addEventListener('pointercancel', onUp, { passive: true })
    window.addEventListener('scroll', hide, { passive: true })
    window.addEventListener('zk:route', hide)
    return () => {
      clearTimeout(t)
      document.removeEventListener('selectionchange', check)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('scroll', hide)
      window.removeEventListener('zk:route', hide)
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(0), 1800)
    return () => clearTimeout(id)
  }, [toast])

  const done = (ok: boolean) => {
    if (ok) setToast(Date.now())
  }

  const onMark = () => {
    const block = current.current
    if (!block) return
    const s = selectionInBlock()
    copy(linkFor(block, s && s.block === block ? s.passage : undefined)).then(done)
  }

  // Grab the selection on press: a tap can clear it before click fires.
  const pending = useRef<{ block: HTMLElement; passage: string } | null>(null)
  const onPillDown = () => {
    pending.current = selectionInBlock()
  }
  const onPill = () => {
    const s = pending.current ?? selectionInBlock()
    pending.current = null
    pill.current?.classList.remove('on')
    if (!s) return
    copy(linkFor(s.block, s.passage)).then(done)
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        className="cite-mark"
        tabIndex={-1}
        aria-label="Copy link to this passage"
        onClick={onMark}
        onMouseDown={(e) => e.preventDefault()}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
          <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2" />
          <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
        </svg>
      </button>
      <button ref={pill} type="button" className="cite-pill" tabIndex={-1} onPointerDown={onPillDown} onClick={onPill}>
        Copy link
      </button>
      <div className={`cite-toast ${toast ? 'on' : ''}`} aria-hidden="true">
        Link copied
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {toast ? 'Link copied' : ''}
      </span>
    </>
  )
}
