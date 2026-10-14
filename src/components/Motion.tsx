'use client'

import { motion } from 'framer-motion'
import { type ReactNode } from 'react'

export const EASE = [0.22, 1, 0.36, 1] as const

/** NDS fade-blur: a short lift out of a soft blur. */
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
  const shown = { opacity: 1, y: 0, filter: 'blur(0px)' }
  const trigger = now
    ? { animate: shown }
    : { whileInView: shown, viewport: { once: true, margin: '0px 0px -8% 0px' } }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
      {...trigger}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

/** Hairline that draws in from the left. */
export function Rule({ className = '', delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.div
      aria-hidden="true"
      className={`h-px origin-left bg-white/[0.14] ${className}`}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1.2, delay, ease: EASE }}
    />
  )
}

/** Section head: numeral at column 1, name at column 7, over a rule. */
export function SectionHead({ n, children }: { n: string; children: ReactNode }) {
  return (
    <div className="lg:col-span-12">
      <Rule />
      <Fade className="grid grid-cols-[3rem_1fr] pt-4 text-[15px] lg:grid-cols-12 lg:gap-x-5">
        <span className="text-foreground-subtle lg:col-span-6">{n}</span>
        <span className="lg:col-span-6">{children}</span>
      </Fade>
    </div>
  )
}
