'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

const EASE = [0.4, 0, 0.2, 1] as const

const item = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: EASE },
})

export function Hero() {
  return (
    <section className="border-b border-white/8 py-28 sm:py-36">
      <motion.p
        {...item(0)}
        className="text-sm font-medium text-foreground-subtle"
      >
        AI Engineer · San Jose, California
      </motion.p>

      <motion.h1
        {...item(0.08)}
        className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl"
      >
        Zakaria Kortam
      </motion.h1>

      <motion.p
        {...item(0.16)}
        className="mt-5 max-w-xl text-lg leading-relaxed text-foreground-muted text-pretty"
      >
        I build agentic AI tools at Facilis and study Electrical Engineering at
        UC San Diego. Previously a product engineer at Incorta and founder of
        Surf.
      </motion.p>

      <motion.div {...item(0.24)} className="mt-9 flex flex-wrap gap-3">
        <Link
          href="/portfolio"
          className="focus-ring rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          View Work
        </Link>
        <Link
          href="/contact"
          className="card card-hover focus-ring rounded-full px-6 py-3 text-sm font-medium"
        >
          Get in Touch
        </Link>
      </motion.div>
    </section>
  )
}
