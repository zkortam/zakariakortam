'use client'

import { useEffect, useRef, useState } from 'react'
import { LazyMotion, domAnimation, m, useScroll, useTransform } from 'framer-motion'

/** End-credits warmth: amber light gathers as the footer arrives. */
export function FooterLight() {
  const el = useRef<HTMLDivElement>(null)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  const { scrollYProgress } = useScroll({ target: el, offset: ['start end', 'end end'] })
  const amber = useTransform(scrollYProgress, (p) => (reduced ? 0.6 : Math.max(0, Math.min(1, (p - 0.2) / 0.7))))
  const roseY = useTransform(scrollYProgress, (p) => (reduced ? '0%' : `${10 - 10 * Math.min(1, p)}%`))

  return (
    <LazyMotion features={domAnimation} strict>
      <div ref={el} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <m.div className="absolute inset-0" style={{ y: roseY }}>
          <div className="light light-rose" style={{ width: '110vmax', height: '110vmax', left: '30%', top: '80%' }} />
        </m.div>
        <m.div className="absolute inset-0" style={{ opacity: amber }}>
          <div className="light light-amber" style={{ width: '100vmax', height: '100vmax', left: '75%', top: '70%' }} />
        </m.div>
      </div>
    </LazyMotion>
  )
}
