'use client'

import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useVelocity,
  useReducedMotion,
} from 'framer-motion'

/**
 * The canvas itself moves through the journey: two maroon fields drift and
 * deepen as you descend, and breathe with scroll velocity. Fixed behind all
 * content. Static, faint gradient for reduced-motion.
 */
export function AmbientBackground() {
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const p = useSpring(scrollYProgress, {
    stiffness: 60,
    damping: 30,
    mass: 0.4,
  })

  const y1 = useTransform(p, [0, 1], ['-8%', '34%'])
  const x1 = useTransform(p, [0, 1], ['0%', '-12%'])
  const o1 = useTransform(p, [0, 0.5, 1], [0.08, 0.14, 0.2])

  const y2 = useTransform(p, [0, 1], ['18%', '-26%'])
  const o2 = useTransform(p, [0, 0.6, 1], [0.04, 0.09, 0.14])

  // Breathe with scroll velocity — barely perceptible, but it feels physical.
  const velocity = useVelocity(p)
  const vScale = useSpring(useTransform(velocity, [-1.5, 0, 1.5], [1.1, 1, 1.1]), {
    stiffness: 120,
    damping: 20,
  })

  if (reduce) {
    return (
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(70rem 55rem at 82% -15%, rgb(168 58 70 / 0.08), transparent 62%)',
        }}
      />
    )
  }

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        style={{ y: y1, x: x1, opacity: o1, scale: vScale }}
        className="absolute -right-[10%] -top-[12%] h-[72vh] w-[56vw] rounded-full bg-accent blur-[170px]"
      />
      <motion.div
        style={{ y: y2, opacity: o2 }}
        className="absolute -left-[16%] top-[52%] h-[62vh] w-[52vw] rounded-full bg-accent blur-[185px]"
      />
    </div>
  )
}
