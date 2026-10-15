'use client'

import { createContext, useContext, useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { LazyMotion, domAnimation, m, useMotionValue, useScroll, useSpring, useTransform, type MotionValue } from 'framer-motion'
import { useScrollFallback } from '@/lib/scroll-timeline'

type Values = {
  js: boolean
  portraitY: MotionValue<string>
  wordmarkY: MotionValue<string>
  statementO: MotionValue<number>
  wx: MotionValue<number>
  wy: MotionValue<number>
  px: MotionValue<number>
  py: MotionValue<number>
  bx: MotionValue<number>
  by: MotionValue<number>
}

const Ctx = createContext<Values | null>(null)

function lite(level: 1 | 2) {
  if (typeof document === 'undefined') return false
  return document.documentElement.classList.contains(level === 1 ? 'lite' : 'lite-2')
}

/**
 * The opening plate: scroll-out separation of layers and a quiet pointer depth (desktop only).
 * The scroll-out runs as a CSS scroll-driven animation on the hero's view timeline ("hd-" in globals.css);
 * the framer driver only mounts in browsers without animation-timeline, with the same curves.
 */
export function HeroDepth({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  const reduced = useRef(false)
  const js = useScrollFallback()

  const portraitY = useMotionValue('0%')
  const wordmarkY = useMotionValue('0%')
  const statementO = useMotionValue(1)
  const cardScale = useMotionValue(1)
  const cardClip = useMotionValue('inset(0px round 0px)')

  const nx = useMotionValue(0)
  const ny = useMotionValue(0)
  const firm = { stiffness: 60, damping: 20, mass: 1 }
  const soft = { stiffness: 22, damping: 18, mass: 1.4 }
  const sx = useSpring(nx, firm)
  const sy = useSpring(ny, firm)
  const wx = useTransform(sx, (v) => -36 * v)
  const wy = useTransform(sy, (v) => -18 * v)
  const px = useTransform(sx, (v) => -24 * v)
  const py = useTransform(sy, (v) => -12 * v)
  const bsx = useSpring(nx, soft)
  const bsy = useSpring(ny, soft)
  const bx = useTransform(bsx, (v) => 120 * v)
  const by = useTransform(bsy, (v) => 80 * v)

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const el = ref.current
    if (!el) return
    const capable =
      window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
      !reduced.current
    if (!capable) return
    const html = document.documentElement
    const ready = () => html.dataset.intro !== 'play'
    const reset = () => {
      nx.set(0)
      ny.set(0)
    }
    const onMove = (e: PointerEvent) => {
      if (!ready() || lite(1) || e.pointerType !== 'mouse') return
      const r = el.getBoundingClientRect()
      if (window.scrollY > 0.3 * r.height) return reset()
      nx.set(Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1)))
      ny.set(Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1)))
    }
    const onScroll = () => {
      if (window.scrollY > 0.3 * el.offsetHeight) reset()
    }
    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerleave', reset)
    window.addEventListener('blur', reset)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', reset)
      window.removeEventListener('blur', reset)
      window.removeEventListener('scroll', onScroll)
    }
  }, [nx, ny])

  return (
    <LazyMotion features={domAnimation} strict>
      {js && <ScrollDriver target={ref} reduced={reduced} portraitY={portraitY} wordmarkY={wordmarkY} statementO={statementO} cardScale={cardScale} cardClip={cardClip} />}
      <Ctx.Provider value={{ js, portraitY, wordmarkY, statementO, wx, wy, px, py, bx, by }}>
        <m.section ref={ref} className="hero" data-tone="dark" style={js ? { scale: cardScale, clipPath: cardClip, transformOrigin: '50% 100%' } : undefined}>
          {children}
        </m.section>
      </Ctx.Provider>
    </LazyMotion>
  )
}

function ScrollDriver({
  target,
  reduced,
  portraitY,
  wordmarkY,
  statementO,
  cardScale,
  cardClip,
}: {
  target: RefObject<HTMLElement | null>
  reduced: RefObject<boolean>
  portraitY: MotionValue<string>
  wordmarkY: MotionValue<string>
  statementO: MotionValue<number>
  cardScale: MotionValue<number>
  cardClip: MotionValue<string>
}) {
  const { scrollYProgress: p } = useScroll({ target, offset: ['start start', 'end start'] })
  useEffect(() => {
    const apply = (v: number) => {
      // Only reduced motion turns this off: dropping it mid-scroll on a slow frame made the hero snap.
      const off = reduced.current
      portraitY.set(off ? '0%' : `${v * 64}%`)
      wordmarkY.set(off ? '0%' : `${v * -64}%`)
      statementO.set(off ? 1 : Math.max(0, 1 - v / 0.45))
      // The same shrink into a rounded card as the CSS path (exit 0% to 90%).
      const k = off ? 0 : Math.min(1, v / 0.9)
      cardScale.set(1 - 0.14 * k)
      cardClip.set(`inset(0px round ${(56 * k).toFixed(1)}px)`)
    }
    apply(p.get())
    return p.on('change', apply)
  }, [p, reduced, portraitY, wordmarkY, statementO, cardScale, cardClip])
  return null
}

/** outer (scroll-out) > middle (pointer depth) > children (M1 keyframes) */
export function HeroLayer({
  kind,
  className = '',
  children,
}: {
  kind: 'bloom' | 'portrait' | 'statement' | 'wordmark'
  className?: string
  children: ReactNode
}) {
  const v = useContext(Ctx)
  if (!v) return <div className={className}>{children}</div>
  if (kind === 'bloom') {
    return (
      <m.div className={className} style={{ x: v.bx, y: v.by }}>
        {children}
      </m.div>
    )
  }
  if (kind === 'statement') {
    return (
      <m.div className={`hd-statement ${className}`} style={v.js ? { opacity: v.statementO } : undefined}>
        {children}
      </m.div>
    )
  }
  const outerY = kind === 'portrait' ? v.portraitY : v.wordmarkY
  const x = kind === 'portrait' ? v.px : v.wx
  const y = kind === 'portrait' ? v.py : v.wy
  return (
    <m.div className={`${kind === 'portrait' ? 'hd-portrait' : 'hd-wordmark'} ${className}`} style={v.js ? { y: outerY } : undefined}>
      <m.div className="fillw" style={{ x, y }}>
        {children}
      </m.div>
    </m.div>
  )
}
