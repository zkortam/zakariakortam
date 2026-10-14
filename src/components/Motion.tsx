'use client'

import { motion } from 'framer-motion'
import { type ReactNode } from 'react'

export const EASE = [0.22, 1, 0.36, 1] as const

/** The one entrance on the site: a short, soft fade up. */
export function Fade({
  children,
  delay = 0,
  className,
  now = false,
}: {
  children: ReactNode
  delay?: number
  className?: string
  /** Play on load instead of on scroll. */
  now?: boolean
}) {
  const trigger = now
    ? { animate: { opacity: 1, y: 0 } }
    : { whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '0px 0px -10% 0px' } }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      {...trigger}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

/** Section label: plain text over a hairline. */
export function Label({ children }: { children: ReactNode }) {
  return (
    <div className="border-t pt-4 text-sm text-foreground-muted">{children}</div>
  )
}
