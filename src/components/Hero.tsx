'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

const EASE = [0.22, 1, 0.36, 1] as const
const line1 = ['Engineering', 'intelligence']
const line2 = ['that', 'feels', 'invisible.']

export function Hero() {
  let i = 0
  const word = (w: string) => {
    const delay = 0.15 + i++ * 0.06
    return (
      <span key={w} className="inline-block overflow-hidden align-bottom">
        <motion.span
          className="inline-block"
          initial={{ y: '110%' }}
          animate={{ y: 0 }}
          transition={{ duration: 0.95, delay, ease: EASE }}
        >
          {w}&nbsp;
        </motion.span>
      </span>
    )
  }

  return (
    <section className="relative flex min-h-[100svh] items-center justify-center px-6">
      <div className="mx-auto w-full max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="mb-8 inline-flex items-center gap-2.5 rounded-full glass px-4 py-2 text-sm text-foreground-muted"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          AI Engineer at Facilis
        </motion.div>

        <h1 className="text-display text-gradient">
          <span className="block">{line1.map(word)}</span>
          <span className="block">{line2.map(word)}</span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, delay: 0.6, ease: EASE }}
          className="mx-auto mt-7 max-w-xl text-balance text-lg text-foreground-muted"
        >
          I build agentic AI products and the systems behind them, from model
          to interface, with restraint and intent.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.78, ease: EASE }}
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link
            href="/portfolio"
            className="focus-ring rounded-full bg-foreground px-7 py-3.5 text-sm font-semibold text-background transition-transform duration-base hover:scale-[1.03]"
          >
            View Work
          </Link>
          <Link
            href="/contact"
            className="glass focus-ring rounded-full px-7 py-3.5 text-sm font-semibold transition-all duration-base hover:scale-[1.03] hover:text-foreground"
          >
            Get in Touch
          </Link>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.4 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <div className="h-9 w-5 rounded-full border border-white/15">
          <motion.div
            animate={{ y: [4, 14, 4], opacity: [1, 0.2, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="mx-auto mt-1.5 h-1.5 w-1 rounded-full bg-foreground-muted"
          />
        </div>
      </motion.div>
    </section>
  )
}
