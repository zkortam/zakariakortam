'use client'

import { ReactLenis } from 'lenis/react'
import { useEffect, useState, type ReactNode } from 'react'

/**
 * Momentum smooth-scroll (Lenis) in root mode — keeps native window scroll so
 * position: sticky / fixed and Framer's useScroll all keep working, just with
 * weighted inertia. Disabled entirely for reduced-motion.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduce(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  if (reduce) return <>{children}</>

  return (
    <ReactLenis
      root
      options={{ lerp: 0.09, smoothWheel: true, wheelMultiplier: 1 }}
    >
      {children}
    </ReactLenis>
  )
}
