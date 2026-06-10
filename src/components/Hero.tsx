'use client'

import { useRef } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { MaskText } from './MaskText'

const EASE = [0.16, 1, 0.3, 1] as const
const fade = (delay: number) => ({
  initial: { opacity: 0, y: 20, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { duration: 1, delay, ease: EASE },
})

export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })

  // Layered parallax: portrait drifts slow, content lifts faster, glow trails.
  const portraitY = useTransform(scrollYProgress, [0, 1], ['0%', '-14%'])
  const portraitScale = useTransform(scrollYProgress, [0, 1], [1, 1.08])
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '-40%'])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0])
  const glowY = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])

  const s = reduce ? {} : undefined

  return (
    <section
      ref={ref}
      className="relative flex min-h-[100svh] flex-col overflow-hidden"
    >
      {/* Deep maroon hue, low and behind the portrait, slowly breathing */}
      <motion.div
        style={reduce ? undefined : { y: glowY }}
        animate={
          reduce ? undefined : { scale: [1, 1.12, 1], x: ['0%', '-6%', '0%'] }
        }
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute -bottom-24 right-[4%] -z-10 h-[48vh] w-[42vw] max-w-[540px] rounded-full bg-accent/[0.16] blur-[170px]"
      />

      {/* Portrait bleeding off the right edge */}
      <motion.div
        style={reduce ? s : { y: portraitY, scale: portraitScale }}
        className="absolute bottom-0 right-0 hidden h-[88%] w-[52%] origin-bottom lg:block xl:w-[48%]"
      >
        <Image
          src="/zakaria.png"
          alt="Zakaria Kortam"
          fill
          priority
          className="object-contain object-bottom mix-blend-lighten"
          style={{
            maskImage: 'linear-gradient(to left, black 38%, transparent 90%)',
            WebkitMaskImage:
              'linear-gradient(to left, black 38%, transparent 90%)',
          }}
        />
      </motion.div>

      {/* Content */}
      <motion.div
        style={reduce ? undefined : { y: contentY, opacity: contentOpacity }}
        className="relative z-10 flex flex-1 items-center"
      >
        <div className="mx-auto w-full max-w-content px-6 pt-28 sm:px-8">
          <div className="max-w-2xl">
            <motion.p
              {...fade(0)}
              className="text-sm font-medium tracking-wide text-foreground-muted"
            >
              AI Engineer · San Jose, CA
            </motion.p>

            <MaskText
              as="h1"
              inView={false}
              stagger={0.1}
              className="mt-6 text-display text-balance"
              lines={['Zakaria', 'Kortam']}
            />

            <motion.p
              {...fade(0.5)}
              className="mt-8 max-w-md text-lg leading-relaxed text-foreground-muted text-pretty sm:text-xl"
            >
              Founding AI Engineer at{' '}
              <span className="text-accent">FacilisAI</span>, building agentic
              systems for industrial enterprise. Previously product engineering
              at Incorta. EE at UC San Diego.
            </motion.p>

            <motion.div {...fade(0.62)} className="mt-11 flex flex-wrap gap-3">
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
      </motion.div>

      {/* Bottom fade to blend the portrait into the page */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/70 to-transparent" />
    </section>
  )
}
