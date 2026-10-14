'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LazyMotion, domAnimation, m, useScroll, useTransform } from 'framer-motion'

/** Linear scroll parallax for phones (desktop and tablet). */
export function Parallax({ children }: { children: ReactNode }) {
  const el = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)

  useEffect(() => {
    const ok =
      window.matchMedia('(min-width: 768px)').matches &&
      window.matchMedia('(prefers-reduced-motion: no-preference)').matches
    setOn(ok)
  }, [])

  const { scrollYProgress } = useScroll({ target: el, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, (p) => {
    if (!on || document.documentElement.classList.contains('lite')) return '0%'
    return `${4 - 8 * p}%`
  })

  return (
    <LazyMotion features={domAnimation} strict>
      <m.div ref={el} style={{ y }}>
        {children}
      </m.div>
    </LazyMotion>
  )
}
