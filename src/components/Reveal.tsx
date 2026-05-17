'use client'

import { motion, type HTMLMotionProps } from 'framer-motion'
import { type ReactNode } from 'react'

// Axis / KFK signature easing
const EASE = [0.16, 1, 0.3, 1] as const

/** Quiet fade-up on the Axis/KFK easing curve. */
export function Reveal({
  children,
  delay = 0,
  ...rest
}: Omit<HTMLMotionProps<'div'>, 'children'> & {
  children: ReactNode
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.9, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
