'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { LazyMotion, domAnimation, m, useMotionValue, useScroll, type MotionValue } from 'framer-motion'
import { useScrollFallback } from '@/lib/scroll-timeline'

/**
 * End-credits warmth: amber light gathers as the footer arrives.
 * Scroll progress runs as a CSS scroll-driven animation on the compositor (globals.css, "fl-"); the
 * framer path below only mounts in browsers without animation-timeline, with the same curve.
 */
export function FooterLight() {
  const el = useRef<HTMLDivElement>(null)
  const js = useScrollFallback()
  const amber = useMotionValue(0)
  const roseY = useMotionValue('10%')

  return (
    <LazyMotion features={domAnimation} strict>
      {js && <Driver target={el} amber={amber} roseY={roseY} />}
      <div ref={el} aria-hidden="true" className="fl pointer-events-none absolute inset-0 overflow-hidden">
        <m.div className="fl-rose absolute inset-0" style={js ? { y: roseY } : undefined}>
          <div className="light light-rose" style={{ width: '110vmax', height: '110vmax', left: '30%', top: '80%' }} />
        </m.div>
        <m.div className="fl-amber absolute inset-0" style={js ? { opacity: amber } : undefined}>
          <div className="light light-amber" style={{ width: '100vmax', height: '100vmax', left: '75%', top: '70%' }} />
        </m.div>
      </div>
    </LazyMotion>
  )
}

function Driver({ target, amber, roseY }: { target: RefObject<HTMLDivElement | null>; amber: MotionValue<number>; roseY: MotionValue<string> }) {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])
  const { scrollYProgress } = useScroll({ target, offset: ['start end', 'end end'] })
  useEffect(() => {
    const apply = (p: number) => {
      amber.set(reduced ? 0.6 : Math.max(0, Math.min(1, (p - 0.2) / 0.7)))
      roseY.set(reduced ? '0%' : `${10 - 10 * Math.min(1, p)}%`)
    }
    apply(scrollYProgress.get())
    return scrollYProgress.on('change', apply)
  }, [scrollYProgress, amber, roseY, reduced])
  return null
}
