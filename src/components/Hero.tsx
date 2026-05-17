'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, ArrowDown } from 'lucide-react'

const EASE = [0.16, 1, 0.3, 1] as const
const item = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 1, delay, ease: EASE },
})

export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col overflow-hidden">
      {/* Ambient blue glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-[8%] h-[42vw] max-h-[520px] w-[42vw] max-w-[520px] rounded-full bg-accent/20 blur-[130px] animate-glow-pulse" />
        <div className="absolute -right-24 bottom-[6%] h-[38vw] max-h-[460px] w-[38vw] max-w-[460px] rounded-full bg-accent-strong/15 blur-[120px]" />
      </div>

      {/* Portrait bleeding off the right edge */}
      <div className="absolute bottom-0 right-0 hidden h-[88%] w-[52%] lg:block xl:w-[48%]">
        <Image
          src="/zakaria.png"
          alt="Zakaria Kortam"
          fill
          priority
          className="object-contain object-bottom mix-blend-lighten"
          style={{
            maskImage:
              'linear-gradient(to left, black 38%, transparent 90%)',
            WebkitMaskImage:
              'linear-gradient(to left, black 38%, transparent 90%)',
          }}
        />
      </div>

      {/* Content — left aligned, generous space */}
      <div className="relative z-10 flex flex-1 items-center">
        <div className="mx-auto w-full max-w-content px-6 pt-28 sm:px-8">
          <div className="max-w-2xl">
            <motion.div {...item(0)}>
              <span className="badge">
                <span className="badge-dot" />
                AI Engineer · San Jose, CA
              </span>
            </motion.div>

            <motion.h1
              {...item(0.12)}
              className="mt-8 text-balance text-display"
            >
              <span className="text-gradient">Zakaria</span>
              <br />
              <span className="text-gradient">Kortam</span>
            </motion.h1>

            <motion.p
              {...item(0.24)}
              className="mt-8 max-w-md text-lg leading-relaxed text-foreground-muted text-pretty sm:text-xl"
            >
              I build <span className="text-accent">agentic AI</span> tools at
              Facilis and study Electrical Engineering at UC San Diego.
              Previously product engineer at Incorta, founder of Surf.
            </motion.p>

            <motion.div
              {...item(0.36)}
              className="mt-11 flex flex-wrap gap-3"
            >
              <Link href="/portfolio" className="btn-primary focus-ring group">
                View Work
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link href="/contact" className="btn-secondary focus-ring">
                Get in Touch
              </Link>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Bottom fade + scroll cue */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/70 to-transparent" />
      <motion.div
        {...item(0.6)}
        className="absolute inset-x-0 bottom-7 z-10 flex justify-center"
      >
        <span className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-foreground-subtle">
          <ArrowDown className="h-3.5 w-3.5 animate-bounce" />
          Scroll
        </span>
      </motion.div>
    </section>
  )
}
