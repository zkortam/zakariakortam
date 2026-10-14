'use client'

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getLenis, scrollTop } from '@/lib/lenis'

export type FlipKind = 'plate' | 'tile'
type FlipRequest = { kind: FlipKind; el: HTMLElement; id: string }

type FlipState = {
  kind: FlipKind
  id: string
  host: HTMLDivElement
  source: HTMLElement
  src: DOMRect
  wide: boolean
  fit: 'width' | 'cover'
  hovered: boolean
}

type Pending = { href: string; instant?: boolean; flip?: FlipState; safety?: number }

const Ctx = createContext<{ go: (href: string, flip?: FlipRequest) => void }>({ go: () => {} })

export function useTransitionNav() {
  return useContext(Ctx)
}

const EASE_QUINT = 'cubic-bezier(.22,1,.36,1)'

function motionOff() {
  const html = document.documentElement
  const save = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!save || html.classList.contains('lite-2')
  )
}

function focusMain() {
  const main = document.getElementById('main')
  main?.focus({ preventScroll: true })
}

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

function decodeAll(root: Element, cap: number) {
  const imgs = Array.from(root.querySelectorAll('img'))
  return Promise.race([Promise.all(imgs.map((i) => i.decode().catch(() => undefined))), wait(cap)])
}

/** Build the fixed host carrying a clone of the clicked picture. */
function makeFlip(req: FlipRequest): FlipState | undefined {
  const wide = window.innerWidth >= 1024
  let source: HTMLElement | null = null
  let fit: 'width' | 'cover' = 'width'
  if (req.kind === 'plate') {
    source = wide ? req.el.querySelector<HTMLElement>('[data-plate-media]') : req.el
  } else {
    source = req.el
    fit = (req.el.dataset.flipFit as 'width' | 'cover') || 'width'
  }
  if (!source) return
  const r = source.getBoundingClientRect()
  const clone = source.cloneNode(true) as HTMLElement
  // Plate variables live on the section; carry them so the clone keeps its ground and stage rows.
  const plateEl = req.el.closest<HTMLElement>('.plate') ?? source
  const cs = getComputedStyle(plateEl)
  for (const v of ['--ground', '--title-lines', '--stage-top', '--stage-bottom']) {
    const val = cs.getPropertyValue(v)
    if (val) clone.style.setProperty(v, val)
  }
  clone.removeAttribute('data-flip-source')
  clone.removeAttribute('data-flip-target')
  clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'))
  if (req.kind === 'plate' && !wide) {
    clone.querySelectorAll<HTMLElement>('[data-flip-strip], .plate-link').forEach((n) => (n.style.visibility = 'hidden'))
  }
  clone.querySelectorAll('img').forEach((img) => {
    img.decoding = 'sync'
    img.loading = 'eager'
    const heroSizes = img.getAttribute('data-hero-sizes')
    if (heroSizes) img.sizes = heroSizes
  })
  Object.assign(clone.style, {
    position: 'absolute',
    inset: '0',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    minHeight: '0',
    maxHeight: 'none',
    margin: '0',
    transform: 'none',
    visibility: 'visible',
  })
  const hovered = req.el.matches(':hover') || !!req.el.closest('.plate')?.matches(':hover')
  if (req.kind === 'plate' && hovered) {
    clone.querySelectorAll<HTMLElement>('.obj-hover').forEach((n) => {
      n.style.transform = 'translateY(-6px)'
      n.style.transition = 'none'
    })
  }
  const host = document.createElement('div')
  host.id = 'flip'
  host.setAttribute('aria-hidden', 'true')
  const base = 'position:fixed;z-index:45;overflow:hidden;contain:paint;will-change:transform;pointer-events:none;'
  if (req.kind === 'plate') {
    host.style.cssText = `${base}left:${r.left}px;top:0;width:${r.width}px;height:${r.height}px;transform:translate3d(0,${r.top}px,0)`
  } else {
    host.style.cssText = `${base}left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`
    // The tile shows only part of the picture (phones bleed off the box): start from what was visible.
    const box = req.el.closest('.tile-media')?.getBoundingClientRect()
    if (box && fit === 'width') {
      const top = Math.max(0, box.top - r.top)
      const bottom = Math.max(0, r.bottom - box.bottom)
      const left = Math.max(0, box.left - r.left)
      const right = Math.max(0, r.right - box.right)
      host.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px)`
    }
  }
  host.appendChild(clone)
  document.body.appendChild(host)
  source.style.visibility = 'hidden'
  return { kind: req.kind, id: req.id, host, source, src: r, wide, fit, hovered }
}

function teardown(f: FlipState) {
  f.host.remove()
  f.source.style.visibility = ''
}

async function commitFlip(f: FlipState) {
  const target = document.querySelector<HTMLElement>(`[data-flip-target="${f.id}"]`)
  if (!target) {
    teardown(f)
    return
  }
  // Destination entrances are already "played" in the clone: land them instantly.
  target.querySelectorAll<HTMLElement>('[data-open],[data-enter]').forEach((n) => n.classList.add('in', 'now'))
  const hide: HTMLElement[] = []
  let anim: Animation

  if (f.kind === 'plate') {
    const media = target.querySelector<HTMLElement>('[data-plate-media]')
    const dstEl = f.wide ? media : target
    if (!media || !dstEl) {
      teardown(f)
      return
    }
    hide.push(media)
    if (!f.wide) {
      const stage = target.querySelector<HTMLElement>('.plate-stage')
      if (stage) hide.push(stage)
    }
    hide.forEach((n) => (n.style.visibility = 'hidden'))
    const d = dstEl.getBoundingClientRect()
    let start = `translate3d(0,${f.src.top}px,0)`
    if (Math.abs(f.src.width - d.width) > 1 || Math.abs(f.src.height - d.height) > 1) {
      f.host.style.width = `${d.width}px`
      f.host.style.height = `${d.height}px`
      f.host.style.transformOrigin = '0 0'
      start = `translate3d(${f.src.left - d.left}px,${f.src.top}px,0) scale(${f.src.width / d.width},${f.src.height / d.height})`
    }
    f.host.style.left = `${d.left}px`
    const hoverEls = Array.from(f.host.querySelectorAll<HTMLElement>('.obj-hover'))
    hoverEls.forEach((n) =>
      n.animate([{ transform: n.style.transform || 'none' }, { transform: 'none' }], {
        duration: 700,
        easing: EASE_QUINT,
        fill: 'forwards',
      }),
    )
    anim = f.host.animate([{ transform: start }, { transform: `translate3d(0,${d.top}px,0)` }], {
      duration: 700,
      easing: EASE_QUINT,
      fill: 'forwards',
    })
  } else {
    const candidates = Array.from(target.querySelectorAll<HTMLElement>('[data-flip-img]'))
    const dst = candidates.find((n) => n.getBoundingClientRect().width > 0)
    if (!dst) {
      teardown(f)
      return
    }
    hide.push(dst)
    dst.style.visibility = 'hidden'
    const d = dst.getBoundingClientRect()
    const s0 = f.src
    // Visible part of the destination (phones bleed off their plate).
    const plateBox = target.getBoundingClientRect()
    const endTop = Math.max(0, plateBox.top - d.top)
    const endBottom = Math.max(0, d.bottom - plateBox.bottom)
    const endInset = `inset(${endTop}px 0px ${endBottom}px 0px)`
    let from: Keyframe
    if (f.fit === 'cover') {
      const s = Math.max(s0.width / d.width, s0.height / d.height)
      const ix = (d.width - s0.width / s) / 2
      const iy = (d.height - s0.height / s) / 2
      const tx = s0.left + s0.width / 2 - (d.left + d.width / 2)
      const ty = s0.top + s0.height / 2 - (d.top + d.height / 2)
      f.host.style.transformOrigin = '50% 50%'
      from = { transform: `translate(${tx}px,${ty}px) scale(${s})`, clipPath: `inset(${iy}px ${ix}px ${iy}px ${ix}px)` }
    } else {
      const s = s0.width / d.width
      const tile = f.source.closest('.tile-media')?.getBoundingClientRect()
      let vTop = 0
      let vBottom = s0.height
      if (tile) {
        vTop = Math.max(0, tile.top - s0.top)
        vBottom = Math.min(s0.height, tile.bottom - s0.top)
      }
      f.host.style.transformOrigin = '0 0'
      from = {
        transform: `translate(${s0.left - d.left}px,${s0.top - d.top}px) scale(${s})`,
        clipPath: `inset(${vTop / s}px 0px ${Math.max(0, d.height - vBottom / s)}px 0px)`,
      }
    }
    Object.assign(f.host.style, {
      left: `${d.left}px`,
      top: `${d.top}px`,
      width: `${d.width}px`,
      height: `${d.height}px`,
      clipPath: '',
    })
    anim = f.host.animate([from, { transform: 'none', clipPath: endInset }], {
      duration: 800,
      easing: EASE_QUINT,
      fill: 'forwards',
    })
  }

  try {
    await anim.finished
  } catch {
    /* cancelled */
  }
  await decodeAll(target, 400)
  hide.forEach((n) => (n.style.visibility = ''))
  requestAnimationFrame(() => {
    f.host.remove()
    target.querySelectorAll('.now').forEach((n) => n.classList.remove('now'))
  })
}

export function Transitions({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const pending = useRef<Pending | null>(null)
  const popped = useRef(false)
  const first = useRef(true)

  useEffect(() => {
    history.scrollRestoration = 'auto'
    const onPop = () => {
      popped.current = true
      const p = pending.current
      if (p?.flip) teardown(p.flip)
      pending.current = null
      delete document.documentElement.dataset.route
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const go = useCallback(
    (href: string, flipReq?: FlipRequest) => {
      if (pending.current) return
      const html = document.documentElement
      if (motionOff()) {
        pending.current = { href, instant: true }
        router.push(href, { scroll: false })
        return
      }
      const flip = flipReq ? makeFlip(flipReq) : undefined
      const state: Pending = { href, flip }
      pending.current = state
      html.dataset.route = flip ? 'leaving-fast' : 'leaving'
      window.setTimeout(
        () => {
          router.push(href, { scroll: false })
          state.safety = window.setTimeout(() => {
            if (pending.current === state) {
              pending.current = null
              if (state.flip) teardown(state.flip)
              delete html.dataset.route
            }
          }, 1500)
        },
        flip ? 120 : 200,
      )
    },
    [router],
  )

  useLayoutEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const html = document.documentElement
    if (popped.current) {
      popped.current = false
      requestAnimationFrame(() => getLenis()?.resize())
      return
    }
    const p = pending.current
    if (!p) return
    pending.current = null
    if (p.safety) clearTimeout(p.safety)
    scrollTop()
    if (p.instant) {
      focusMain()
      return
    }
    html.dataset.route = 'entering'
    if (p.flip) void commitFlip(p.flip)
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        delete html.dataset.route
      }),
    )
    focusMain()
    getLenis()?.resize()
  }, [pathname])

  const value = useMemo(() => ({ go }), [go])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
