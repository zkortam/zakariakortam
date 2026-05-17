'use client'

import { motion, type HTMLMotionProps } from 'framer-motion'
import { type ReactNode } from 'react'

const EASE = [0.4, 0, 0.2, 1] as const

/** One quiet fade-up. No blur, no bounce, no stagger soup. */
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
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
