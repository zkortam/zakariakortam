'use client'

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'

/**
 * Page light. Two wide maroon pools drift on long loops behind everything; as
 * you read down the page the upper one cools away and the lower one comes up,
 * so the colour follows you to the end. Transform and opacity only.
 */
export function Ambient() {
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const top = useTransform(scrollYProgress, [0, 0.6], [1, 0.35])
  const low = useTransform(scrollYProgress, [0.3, 1], [0.25, 1])
  const lowY = useTransform(scrollYProgress, [0, 1], ['10%', '-6%'])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute left-[82%] top-[6%] h-[80vmax] w-[80vmax] -translate-x-1/2 -translate-y-1/2">
        <motion.div
          className="h-full w-full rounded-full"
          style={{
            opacity: top,
            background: 'radial-gradient(closest-side, rgba(150,34,52,0.22), rgba(122,26,40,0.07) 55%, transparent)',
          }}
          animate={reduce ? undefined : { x: ['-4%', '5%', '-4%'], y: ['-3%', '4%', '-3%'] }}
          transition={{ duration: 46, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <motion.div
        style={{ y: reduce ? undefined : lowY }}
        className="absolute left-[16%] top-[96%] h-[100vmax] w-[100vmax] -translate-x-1/2 -translate-y-1/2"
      >
        <motion.div
          className="h-full w-full rounded-full"
          style={{
            opacity: low,
            background: 'radial-gradient(closest-side, rgba(178,62,76,0.16), rgba(122,26,40,0.05) 55%, transparent)',
          }}
          animate={reduce ? undefined : { x: ['3%', '-4%', '3%'], y: ['2%', '-3%', '2%'] }}
          transition={{ duration: 58, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </div>
  )
}
