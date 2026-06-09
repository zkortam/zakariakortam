'use client'

import { motion, type Variants } from 'framer-motion'
import { type ElementType, type ReactNode } from 'react'

const EASE = [0.16, 1, 0.3, 1] as const

const container: Variants = {
  hidden: {},
  show: (stagger: number) => ({
    transition: { staggerChildren: stagger, delayChildren: 0.05 },
  }),
}

const line: Variants = {
  hidden: { y: '110%' },
  show: { y: '0%', transition: { duration: 0.95, ease: EASE } },
}

/**
 * Headline reveal — each line rises out from behind a clipping mask. The
 * Awwwards / Apple keynote move. Pass each visual line as an array entry.
 */
export function MaskText({
  lines,
  as: Tag = 'h1',
  className = '',
  stagger = 0.08,
  inView = true,
}: {
  lines: ReactNode[]
  as?: ElementType
  className?: string
  stagger?: number
  /** false = play once on mount (e.g. hero); true = play on scroll-in */
  inView?: boolean
}) {
  const reveal = inView
    ? ({ whileInView: 'show', viewport: { once: true, amount: 0.6 } } as const)
    : ({ animate: 'show' } as const)

  return (
    <Tag className={className}>
      <motion.span
        className="block"
        variants={container}
        initial="hidden"
        custom={stagger}
        {...reveal}
      >
        {lines.map((l, i) => (
          <span
            key={i}
            className="block overflow-hidden"
            style={{ paddingBottom: '0.1em' }}
          >
            <motion.span variants={line} className="block will-change-transform">
              {l}
            </motion.span>
          </span>
        ))}
      </motion.span>
    </Tag>
  )
}
