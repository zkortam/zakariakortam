'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'

const EASE = [0.16, 1, 0.3, 1] as const
const item = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 1, delay, ease: EASE },
})

export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col overflow-hidden">
      {/* Subtle blue hue, low and behind the portrait */}
      <div className="pointer-events-none absolute -bottom-24 right-[4%] -z-10 h-[46vh] w-[40vw] max-w-[520px] rounded-full bg-accent/12 blur-[160px]" />

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

      {/* Content */}
      <div className="relative z-10 flex flex-1 items-center">
        <div className="mx-auto w-full max-w-content px-6 pt-28 sm:px-8">
          <div className="max-w-2xl">
            <motion.p
              {...item(0)}
              className="text-sm font-medium text-foreground-muted"
            >
              AI Engineer · San Jose, CA
            </motion.p>

            <motion.h1
              {...item(0.12)}
              className="mt-6 text-balance text-display"
            >
              Zakaria
              <br />
              Kortam
            </motion.h1>

            <motion.p
              {...item(0.24)}
              className="mt-8 max-w-md text-lg leading-relaxed text-foreground-muted text-pretty sm:text-xl"
            >
              Founding AI Engineer at <span className="text-accent">FacilisAI</span>,
              building agentic systems for industrial enterprise. Previously
              product engineering at Incorta and Adobe. EE at UC San Diego.
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

      {/* Bottom fade to blend the portrait into the page */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/70 to-transparent" />
    </section>
  )
}
