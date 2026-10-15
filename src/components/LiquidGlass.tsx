'use client'

import { useEffect } from 'react'
import { displacementMap, dropsShading, scatterDrops, type Drop, type Edges } from '@/lib/liquidGlass'
import { rainNow } from '@/lib/rain'
import { hasGpu } from '@/lib/gpu'

/*
 * Refraction for the glass surfaces (nav bar, pills, command panel), Chromium only.
 *
 * Chromium accepts an SVG filter reference in backdrop-filter, after the existing blur and saturate,
 * so the frosted glass stays exactly as legible as before and only its rim bends what is behind it.
 * Safari and Firefox ignore url() in backdrop-filter, so they keep the plain blur glass (unchanged).
 * When it is raining in San Jose, a few drops sit on the nav glass and refract like small lenses.
 */

/** The nav glass extends this far below the bar (clipped away) so its rim has real backdrop to bend. */
const SPILL = 24
const ALL: Edges = { t: true, r: true, b: true, l: true }
const NS = 'http://www.w3.org/2000/svg'

type Target = { el: HTMLElement; kind: 'nav' | 'pill' | 'panel' }

function chromium() {
  const ua = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData
  return !!ua?.brands?.some((b) => /Chromium/.test(b.brand))
}

export function LiquidGlass() {
  useEffect(() => {
    const html = document.documentElement
    const noGlass = window.matchMedia('(prefers-reduced-transparency: reduce)')
    // Software rendering would pay for the filter on the CPU every scrolled frame: plain glass there.
    if (!chromium() || noGlass.matches || !hasGpu()) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const svg = document.createElementNS(NS, 'svg')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('width', '0')
    svg.setAttribute('height', '0')
    svg.style.position = 'absolute'
    svg.style.pointerEvents = 'none'
    const defs = document.createElementNS(NS, 'defs')
    svg.appendChild(defs)
    document.body.appendChild(svg)
    html.classList.add('lg')

    const made = new Map<string, string>()
    const images = new Map<string, ReturnType<typeof displacementMap>>()
    const shades = new Map<string, string>()
    let serial = 0
    let rain = 0
    let drops: Drop[] = []
    let dropsKey = ''

    const filterFor = (key: string, w: number, h: number, radius: number, bezel: number, edges: Edges, withDrops: Drop[], blur: number, sat: number, visH = h) => {
      const hit = made.get(key)
      if (hit) return hit
      const id = `lg-${++serial}`
      const gkey = key.replace(/^(.)(\d+x\d+)[dl]/, '$1$2')
      let maps = images.get(gkey)
      if (!maps) {
        maps = displacementMap({ w, h, radius, bezel, edges, drops: withDrops, visH })
        images.set(gkey, maps)
        if (images.size > 8) images.delete(images.keys().next().value as string)
      }
      const { url, mask, scale } = maps
      const f = document.createElementNS(NS, 'filter')
      const set = (el: Element, a: Record<string, string | number>) => {
        for (const k in a) el.setAttribute(k, String(a[k]))
        return el
      }
      set(f, { id, x: 0, y: 0, width: w, height: h, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' })
      const img = (href: string, result: string) =>
        set(document.createElementNS(NS, 'feImage'), { href, x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'none', result })
      // Frosted body: the same blur and saturation the CSS glass had.
      const soft = set(document.createElementNS(NS, 'feGaussianBlur'), { in: 'SourceGraphic', stdDeviation: blur, edgeMode: 'duplicate', result: 'soft' })
      const satS = set(document.createElementNS(NS, 'feColorMatrix'), { in: 'soft', type: 'saturate', values: sat, result: 'frost' })
      // Clear rim (and drops): the backdrop bent through the bevel, unblurred.
      const dm = set(document.createElementNS(NS, 'feDisplacementMap'), { in: 'SourceGraphic', in2: 'map', scale, xChannelSelector: 'R', yChannelSelector: 'G', result: 'bent' })
      const satB = set(document.createElementNS(NS, 'feColorMatrix'), { in: 'bent', type: 'saturate', values: sat, result: 'bent2' })
      const clip = set(document.createElementNS(NS, 'feComposite'), { in: 'bent2', in2: 'clear', operator: 'in', result: 'rim' })
      const over = set(document.createElementNS(NS, 'feComposite'), { in: 'rim', in2: 'frost', operator: 'over' })
      f.append(img(url, 'map'), img(mask, 'clear'), soft, satS, dm, satB, clip, over)
      defs.appendChild(f)
      made.set(key, id)
      return id
    }

    const targets = (): Target[] => {
      const out: Target[] = []
      document.querySelectorAll<HTMLElement>('.nav .gl').forEach((el) => out.push({ el, kind: 'nav' }))
      return out
    }

    const apply = (t: Target) => {
      const w = Math.round(t.el.offsetWidth)
      const h = Math.round(t.el.offsetHeight)
      if (w < 8 || h < 8 || w > 4096) return
      let id: string
      if (t.kind === 'nav') {
        const d = rain > 0 ? drops : []
        id = filterFor(`n${w}x${h}${t.el.classList.contains('glass-dark') ? 'd' : 'l'}${d.length ? dropsKey : ''}`, w, h, 0, 14, { t: false, r: false, b: true, l: false }, d, 20, t.el.classList.contains('glass-dark') ? 1.2 : 1.1, h - SPILL)
        if (d.length) {
          if (t.el.dataset.lgDropsKey !== dropsKey) {
            const light = t.el.classList.contains('glass-light')
            const sk = `${dropsKey}${light ? 'l' : 'd'}${w}`
            let shade = shades.get(sk)
            if (!shade) {
              shade = dropsShading(w, h - SPILL, d, light)
              shades.set(sk, shade)
              if (shades.size > 4) shades.delete(shades.keys().next().value as string)
            }
            t.el.style.setProperty('--lg-drops', `url(${shade})`)
            t.el.dataset.lgDropsKey = dropsKey
          }
          t.el.dataset.lgRain = ''
        } else {
          delete t.el.dataset.lgRain
        }
      } else if (t.kind === 'pill') {
        id = filterFor(`p${w}x${h}${t.el.classList.contains('glass-dark') ? 'd' : 'l'}`, w, h, h / 2, Math.min(14, h / 2), ALL, [], 20, t.el.classList.contains('glass-dark') ? 1.2 : 1.1)
      } else {
        id = filterFor(`c${w}x${h}`, w, h, 20, 20, ALL, [], 20, 1.2)
      }
      t.el.style.setProperty('--lg-f', `url(#${id})`)
      t.el.dataset.lg = ''
    }

    let queued = 0
    const refresh = () => {
      if (queued) return
      queued = requestAnimationFrame(() => {
        queued = 0
        const ts = targets()
        ts.forEach(apply)
        // Drop filters nothing points at any more (old sizes, drops that have dried).
        const live = new Set(ts.map((t) => t.el.style.getPropertyValue('--lg-f')))
        for (const [k, id] of made) {
          if (!live.has(`url(#${id})`)) {
            made.delete(k)
            document.getElementById(id)?.remove()
          }
        }
      })
    }

    const ro = new ResizeObserver(refresh)
    const watch = () => targets().forEach((t) => ro.observe(t.el))
    watch()
    refresh()
    const mo = new MutationObserver(() => {
      watch()
      refresh()
    })
    const page = document.getElementById('page')
    if (page) mo.observe(page, { childList: true, subtree: true })
    window.addEventListener('zk:route', refresh)

    // Rain: sparse drops, more with heavier rain; one lands or dries now and then (none with reduced motion).
    let rainTimer = 0
    const words = (nav: HTMLElement) => {
      const o = nav.getBoundingClientRect()
      return Array.from(document.querySelectorAll<HTMLElement>('.nav-inner a, .nav-inner button')).map((el) => {
        const r = el.getBoundingClientRect()
        return new DOMRectReadOnly(r.left - o.left, r.top - o.top, r.width, r.height)
      })
    }
    const layDrops = () => {
      const nav = document.querySelector<HTMLElement>('.nav .gl')
      if (!nav) return
      const w = nav.offsetWidth
      const h = nav.offsetHeight - SPILL
      const count = Math.round(Math.min(22, (6 + rain * 4) * (w / 1440)) + 2)
      const seed = Math.floor(Date.now() / 1000)
      drops = scatterDrops(w, h, count, seed, words(nav))
      dropsKey = `d${seed}`
      refresh()
    }
    const cycle = () => {
      if (document.hidden || !rain) return
      // Only while the glass is actually showing.
      if (!document.querySelector('.nav.glassy:not(.hide)')) return
      const nav = document.querySelector<HTMLElement>('.nav .gl')
      if (!nav || drops.length === 0) return
      // Replace one drop: an old one dries, a new one lands somewhere else.
      const w = nav.offsetWidth
      const h = nav.offsetHeight - SPILL
      const fresh = scatterDrops(w, h, 1, Math.floor(Math.random() * 1e9), words(nav))[0]
      if (!fresh || drops.some((o) => Math.hypot(o.x - fresh.x, o.y - fresh.y) < (o.r + fresh.r) * 3)) return
      drops = [...drops.slice(1), fresh]
      dropsKey = `d${Date.now()}`
      refresh()
    }
    rainNow().then((mm) => {
      rain = mm
      if (!rain) return
      layDrops()
      if (!reduced) rainTimer = window.setInterval(cycle, 9000 / Math.min(3, 0.6 + rain * 0.5))
    })

    const onGlassPref = () => {
      if (noGlass.matches) html.classList.remove('lg')
      else html.classList.add('lg')
    }
    noGlass.addEventListener('change', onGlassPref)

    return () => {
      cancelAnimationFrame(queued)
      window.clearInterval(rainTimer)
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('zk:route', refresh)
      noGlass.removeEventListener('change', onGlassPref)
      html.classList.remove('lg')
      svg.remove()
    }
  }, [])

  return null
}
