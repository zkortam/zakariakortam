'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const SPLIT_SRC = new WeakMap<HTMLElement, { html: string; width: number }>()

/** Wrap each rendered line of a heading in a mask, keeping inline markup (color spans) intact. */
function split(el: HTMLElement) {
  const saved = SPLIT_SRC.get(el)
  if (saved) el.innerHTML = saved.html
  else SPLIT_SRC.set(el, { html: el.innerHTML, width: 0 })
  const record = SPLIT_SRC.get(el)!
  record.width = el.getBoundingClientRect().width

  // 1. Tokenize text nodes into word spans.
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const texts: Text[] = []
  while (walker.nextNode()) texts.push(walker.currentNode as Text)
  const words: HTMLElement[] = []
  for (const t of texts) {
    const parts = (t.textContent ?? '').split(/(?<=[ \n\t])/)
    const frag = document.createDocumentFragment()
    for (const part of parts) {
      if (!part) continue
      const w = document.createElement('span')
      w.className = 'w'
      w.textContent = part
      frag.appendChild(w)
      words.push(w)
    }
    t.replaceWith(frag)
  }
  if (!words.length) return

  // 2. Group by line using rendered position.
  const lines: HTMLElement[][] = []
  let lastTop = -Infinity
  for (const w of words) {
    const r = w.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    if (r.top > lastTop + r.height * 0.5) {
      lines.push([])
      lastTop = r.top
    }
    lines[lines.length - 1].push(w)
  }

  // 3. Rebuild: each line is .ln > .lni, with the inline ancestors of each word cloned per line.
  const out = document.createDocumentFragment()
  lines.forEach((line, i) => {
    const ln = document.createElement('span')
    ln.className = 'ln'
    const lni = document.createElement('span')
    lni.className = 'lni'
    lni.style.setProperty('--i', String(i))
    ln.appendChild(lni)
    let chain: { orig: Element; copy: Element }[] = []
    for (const w of line) {
      const ancestors: Element[] = []
      let p = w.parentElement
      while (p && p !== el) {
        ancestors.unshift(p)
        p = p.parentElement
      }
      let k = 0
      while (k < chain.length && k < ancestors.length && chain[k].orig === ancestors[k]) k++
      chain = chain.slice(0, k)
      for (let j = k; j < ancestors.length; j++) {
        const copy = ancestors[j].cloneNode(false) as Element
        const parent = chain.length ? chain[chain.length - 1].copy : lni
        parent.appendChild(copy)
        chain.push({ orig: ancestors[j], copy })
      }
      const parent = chain.length ? chain[chain.length - 1].copy : lni
      parent.appendChild(document.createTextNode(w.textContent ?? ''))
    }
    out.appendChild(ln)
  })
  el.innerHTML = ''
  el.appendChild(out)
  el.classList.add('split')
}

function idle(fn: () => void) {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 500 })
  else setTimeout(fn, 1)
}

function decodeAll(root: Element, cap: number) {
  const imgs = Array.from(root.querySelectorAll('img'))
  return Promise.race([
    Promise.all(imgs.map((i) => i.decode().catch(() => undefined))),
    new Promise<void>((r) => setTimeout(r, cap)),
  ])
}

export function Observer() {
  const pathname = usePathname()

  // Intro handoff: the opening titles are CSS; JS only retires them once everything has settled.
  useEffect(() => {
    const html = document.documentElement
    if (html.dataset.intro !== 'play') return
    // Retire once the light has settled (the bloom is the last thing to land), with a ceiling for safety.
    const finish = () => {
      if (html.dataset.intro === 'play') html.dataset.intro = 'done'
    }
    const onEnd = (e: AnimationEvent) => {
      if (e.animationName === 'bloomIn') finish()
    }
    document.addEventListener('animationend', onEnd)
    const t = setTimeout(finish, 4200)
    return () => {
      clearTimeout(t)
      document.removeEventListener('animationend', onEnd)
    }
  }, [])

  useEffect(() => {
    const html = document.documentElement
    const page = document.getElementById('page')
    if (!page) return
    if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return

    const observers: IntersectionObserver[] = []
    const timers: number[] = []
    const scanAt = performance.now()
    const entering = !!html.dataset.route
    const cut = !!document.getElementById('flip')
    // After a route change the above-fold titles lead and the reading text follows. Under the cut the title
    // waits for the picture to be mostly home.
    const early = () => entering && performance.now() - scanAt < 700
    const base = () => (early() ? 260 : 0)
    const riseBase = () => (early() ? (cut ? 300 : 120) : 0)
    const io = (cb: IntersectionObserverCallback, rootMargin: string) => {
      const o = new IntersectionObserver(cb, { rootMargin, threshold: 0 })
      observers.push(o)
      return o
    }

    // Text, hairlines.
    const revealIO = io((entries, obs) => {
      const hits = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement)
      hits.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      const hasRule = hits.some((h) => h.hasAttribute('data-rule'))
      let n = 0
      for (const el of hits) {
        obs.unobserve(el)
        const isRule = el.hasAttribute('data-rule')
        const d = Math.min(n * 40, 200) + (hasRule && !isRule ? 80 : 0) + base()
        if (!el.style.getPropertyValue('--d')) el.style.setProperty('--d', `${d}ms`)
        n++
        el.classList.add('in')
      }
    }, '0px 0px -6% 0px')
    page.querySelectorAll('[data-reveal],[data-rule]').forEach((el) => revealIO.observe(el))

    // Media: wait for decode.
    const mediaIO = io((entries, obs) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        const el = e.target as HTMLElement
        obs.unobserve(el)
        void decodeAll(el, 1200).then(() => el.classList.add('in'))
      }
    }, '0px 0px -6% 0px')
    page.querySelectorAll('[data-media]').forEach((el) => mediaIO.observe(el))

    // Title rises.
    const riseIO = io((entries, obs) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        const el = e.target as HTMLElement
        obs.unobserve(el)
        const b = riseBase()
        if (b) el.style.setProperty('--d', `${b}ms`)
        el.classList.add('in')
      }
    }, '0px 0px -12% 0px')
    const footIO = io((entries, obs) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        obs.unobserve(e.target)
        e.target.classList.add('in')
      }
    }, '0px 0px -8% 0px')
    page.querySelectorAll('.wm-foot').forEach((el) => footIO.observe(el))

    const rises = Array.from(page.querySelectorAll<HTMLElement>('[data-rise]'))
    const vh = window.innerHeight
    const doSplit = (el: HTMLElement) => {
      if (!el.isConnected) return
      split(el)
      riseIO.observe(el)
    }
    void document.fonts.ready.then(() => {
      for (const el of rises) {
        if (el.getBoundingClientRect().top < vh * 1.2) doSplit(el)
        else idle(() => doSplit(el))
      }
    })
    timers.push(
      window.setTimeout(() => {
        rises.forEach((el) => {
          if (!el.classList.contains('split')) el.classList.add('split', 'in')
        })
      }, 1200),
    )

    // M3 and object entrances: triggered when the plate is well into view, after decode.
    // Plates: start decoding a full screen ahead, then enter as soon as the plate is on screen,
    // so the object is ready and never arrives late.
    const preIO = io((entries, obs) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        obs.unobserve(e.target)
        void decodeAll(e.target as HTMLElement, 2000)
      }
    }, '100% 0px 100% 0px')
    const plateIO = io((entries, obs) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        const plate = e.target as HTMLElement
        obs.unobserve(plate)
        const items = Array.from(plate.querySelectorAll<HTMLElement>('[data-open],[data-enter]'))
        void decodeAll(plate, 250).then(() => items.forEach((n) => n.classList.add('in')))
      }
    }, '0px 0px -10% 0px')
    page.querySelectorAll('.plate').forEach((p) => {
      if (p.querySelector('[data-open],[data-enter]')) {
        preIO.observe(p)
        plateIO.observe(p)
      }
    })

    // Ambient drift only while on screen.
    const ambIO = io((entries) => {
      for (const e of entries) e.target.classList.toggle('live', e.isIntersecting)
    }, '0px')
    page.querySelectorAll('[data-ambient]').forEach((el) => ambIO.observe(el))

    // Re-split on width change.
    let rt = 0
    const onResize = () => {
      clearTimeout(rt)
      rt = window.setTimeout(() => {
        for (const el of rises) {
          const rec = SPLIT_SRC.get(el)
          if (!rec || !el.isConnected) continue
          const w = el.getBoundingClientRect().width
          if (Math.abs(w - rec.width) > 1) split(el)
        }
      }, 150)
    }
    window.addEventListener('resize', onResize)

    return () => {
      observers.forEach((o) => o.disconnect())
      timers.forEach((t) => clearTimeout(t))
      clearTimeout(rt)
      window.removeEventListener('resize', onResize)
    }
  }, [pathname])

  return null
}
