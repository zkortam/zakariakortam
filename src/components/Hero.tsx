'use client'

import { useRef } from 'react'
import Image from 'next/image'
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from 'framer-motion'
import { ShaderGradient } from './ShaderGradient'
import { EASE, Words } from './Motion'

/**
 * Inset rounded panel (america.gov) holding the maroon shader, the portrait,
 * and the name set huge. A plain statement sits in the right column (NDS).
 * On scroll the panel recedes: it scales down, rounds off, and dims.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })

  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.9])
  const radius = useTransform(scrollYProgress, [0, 1], [36, 64])
  const dim = useTransform(scrollYProgress, [0, 0.9], [0, 0.65])
  const portraitY = useTransform(scrollYProgress, [0, 1], ['0%', '12%'])
  const nameY = useTransform(scrollYProgress, [0, 1], ['0%', '-30%'])
  const statementY = useTransform(scrollYProgress, [0, 1], ['0%', '-60%'])

  const name = ['Zakaria', 'Kortam']

  return (
    <section ref={ref} className="relative h-[100svh] min-h-[640px] p-2 sm:p-3">
      <motion.div
        style={reduce ? { borderRadius: 36 } : { scale, borderRadius: radius }}
        className="relative h-full w-full origin-top overflow-hidden border border-white/[0.08] bg-[#0b0708] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      >
        {/* Liquid maroon light, weighted to the right */}
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 2.4, ease: EASE }}
          style={{
            maskImage: 'radial-gradient(110% 100% at 80% 30%, #000 25%, transparent 78%)',
            WebkitMaskImage: 'radial-gradient(110% 100% at 80% 30%, #000 25%, transparent 78%)',
          }}
        >
          <ShaderGradient seed={0.22} className="block h-full w-full" />
        </motion.div>

        {/* Warm key light behind the portrait */}
        <motion.div
          aria-hidden="true"
          className="absolute bottom-[-20%] right-[-6%] h-[110%] w-[70%] rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(150,34,52,0.55), rgba(122,26,40,0.18) 55%, transparent)' }}
          animate={reduce ? undefined : { scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Portrait */}
        <motion.div
          initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1.8, delay: 0.3, ease: EASE }}
          className="absolute bottom-0 right-[-14%] h-[66%] w-[110%] sm:right-0 sm:h-[88%] sm:w-[58%] lg:w-[46%]"
        >
          <motion.div style={reduce ? undefined : { y: portraitY }} className="relative h-full w-full">
            <Image
              src="/zakaria.png"
              alt="Zakaria Kortam"
              fill
              priority
              sizes="(min-width: 1024px) 46vw, 80vw"
              className="object-contain object-bottom mix-blend-lighten"
              style={{
                maskImage: 'linear-gradient(to top, transparent 2%, #000 28%)',
                WebkitMaskImage: 'linear-gradient(to top, transparent 2%, #000 28%)',
              }}
            />
          </motion.div>
        </motion.div>

        {/* Statement, right column */}
        <motion.div
          style={reduce ? undefined : { y: statementY }}
          className="absolute inset-x-5 top-[92px] sm:inset-x-10 sm:top-[17%]"
        >
          <Words
            as="p"
            onMount
            delay={0.5}
            stagger={0.035}
            className="max-w-[30rem] text-lede text-foreground"
            text="Associate Product Manager, Innovation at DigiCert. I also build things: a tutor, a social network, a circuit simulator."
          />
        </motion.div>

        {/* Floor shade so the name reads over the portrait on small screens */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-[#0b0708] via-[#0b0708]/70 to-transparent sm:hidden" />

        {/* The name, set huge, rising out of the floor of the panel */}
        <motion.h1
          style={reduce ? undefined : { y: nameY }}
          className="absolute bottom-[7%] left-5 font-display text-giant sm:left-10"
          aria-label="Zakaria Kortam"
        >
          {name.map((line, li) => (
            <span key={line} className="block overflow-hidden pb-[0.06em]">
              <motion.span
                className="block"
                initial={{ y: '105%' }}
                animate={{ y: '0%' }}
                transition={{ duration: 1.4, delay: 0.15 + li * 0.12, ease: EASE }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </motion.h1>

        {/* Floor line */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.4 }}
          className="absolute inset-x-5 bottom-4 hidden items-center justify-between text-sm text-foreground-muted sm:inset-x-10 sm:flex"
        >
          <span>San Jose, California</span>
          <span className="flex items-center gap-3">
            Scroll
            <span className="relative h-px w-12 overflow-hidden bg-white/15">
              <motion.span
                className="absolute inset-y-0 left-0 w-1/2 bg-foreground"
                animate={reduce ? undefined : { x: ['-100%', '200%'] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              />
            </span>
          </span>
        </motion.div>

        {/* Dims as the page takes over */}
        <motion.div
          aria-hidden="true"
          style={{ opacity: reduce ? 0 : dim }}
          className="pointer-events-none absolute inset-0 bg-background"
        />
      </motion.div>
    </section>
  )
}
