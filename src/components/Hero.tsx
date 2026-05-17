'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

const EASE = [0.22, 1, 0.36, 1] as const
const item = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: EASE },
})

export function Hero() {
  return (
    <section className="glass relative overflow-hidden rounded-5xl px-8 py-20 sm:px-14 sm:py-28">
      <motion.div
        {...item(0)}
        className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3.5 py-1.5 text-sm text-foreground-muted"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-foreground-muted" />
        AI Engineer · San Jose, California
      </motion.div>

      <motion.h1
        {...item(0.08)}
        className="mt-7 max-w-3xl text-balance text-5xl font-semibold tracking-tight text-gradient sm:text-7xl"
      >
        Zakaria Kortam
      </motion.h1>

      <motion.p
        {...item(0.16)}
        className="mt-6 max-w-xl text-lg leading-relaxed text-foreground-muted text-pretty"
      >
        I build agentic AI tools at Facilis and study Electrical Engineering at
        UC San Diego. Previously a product engineer at Incorta and founder of
        Surf.
      </motion.p>

      <motion.div {...item(0.24)} className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/portfolio"
          className="focus-ring rounded-full bg-foreground px-7 py-3.5 text-sm font-medium text-background transition-transform duration-300 hover:scale-[1.03]"
        >
          View Work
        </Link>
        <Link
          href="/contact"
          className="glass glass-hover focus-ring rounded-full px-7 py-3.5 text-sm font-medium"
        >
          Get in Touch
        </Link>
      </motion.div>
    </section>
  )
}
