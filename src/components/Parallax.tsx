'use client'

import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { LazyMotion, domAnimation, m, useMotionValue, useScroll, type MotionValue } from 'framer-motion'
import { useScrollFallback } from '@/lib/scroll-timeline'

/**
 * Linear scroll parallax for phones (desktop and tablet).
 * Runs as a CSS scroll-driven animation ("px-sd" in globals.css) where supported; the framer driver only
 * mounts in browsers without animation-timeline. The element itself never changes, so entrance classes the
 * Observer puts on children survive either way.
 */
export function Parallax({ children }: { children: ReactNode }) {
  const el = useRef<HTMLDivElement>(null)
  const js = useScrollFallback()
  const y = useMotionValue('0%')

  return (
    <LazyMotion features={domAnimation} strict>
      {js && <Driver target={el} y={y} />}
      <m.div ref={el} className="px-sd" style={js ? { y } : undefined}>
        {children}
      </m.div>
    </LazyMotion>
  )
}

function Driver({ target, y }: { target: RefObject<HTMLDivElement | null>; y: MotionValue<string> }) {
  const { scrollYProgress } = useScroll({ target, offset: ['start end', 'end start'] })
  useEffect(() => {
    const ok =
      window.matchMedia('(min-width: 768px)').matches && window.matchMedia('(prefers-reduced-motion: no-preference)').matches
    const apply = (p: number) => {
      y.set(!ok || document.documentElement.classList.contains('lite') ? '0%' : `${4 - 8 * p}%`)
    }
    apply(scrollYProgress.get())
    return scrollYProgress.on('change', apply)
  }, [scrollYProgress, y])
  return null
}
