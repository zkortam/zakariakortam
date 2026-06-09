'use client'

import {
  motion,
  type HTMLMotionProps,
  type Variants,
} from 'framer-motion'
import { type ReactNode } from 'react'

// Signature easing — long, settled exit
export const EASE = [0.16, 1, 0.3, 1] as const

/** Quiet fade-up for a single block. */
export function Reveal({
  children,
  delay = 0,
  y = 26,
  ...rest
}: Omit<HTMLMotionProps<'div'>, 'children'> & {
  children: ReactNode
  delay?: number
  y?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-12% 0px -12% 0px' }}
      transition={{ duration: 0.85, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

/**
 * Stagger container — children using <StaggerItem> animate in sequence as the
 * group scrolls into view. The choreography (not a uniform fade) is the point.
 */
const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.04 },
  },
}

export function Stagger({
  children,
  className,
  amount = 0.25,
}: {
  children: ReactNode
  className?: string
  amount?: number
}) {
  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
    >
      {children}
    </motion.div>
  )
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 26, filter: 'blur(6px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.8, ease: EASE },
  },
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  )
}
