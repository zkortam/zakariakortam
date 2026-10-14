'use client'

import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { Grid } from './Container'
import { EASE } from './Motion'

/**
 * NDS hero: a plain statement in the right half, the name across the full
 * width of the first screen. It stays pinned while the portrait band slides
 * up over it, dimming and settling back as it is covered.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const opacity = useTransform(scrollYProgress, [0, 0.9], [1, 0.15])
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.96])

  return (
    <section ref={ref} className="sticky top-0 h-[100svh] min-h-[560px] overflow-hidden">
      <motion.div
        style={reduce ? undefined : { opacity, scale }}
        className="flex h-full origin-bottom flex-col justify-between pb-10 pt-32 sm:pb-14 lg:pt-[22vh]"
      >
        <Grid>
          <motion.p
            initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 1.1, delay: 0.5, ease: EASE }}
            className="text-statement text-balance lg:col-span-5 lg:col-start-7"
          >
            Associate Product Manager on the Innovation team at DigiCert. On my own time I build
            Helio, Surf, and SPICE++.
          </motion.p>
        </Grid>

        <Grid>
          {/* Sized so the name runs the full width of the column */}
          <h1 className="font-display text-[calc((100vw-2.5rem)/3.2)] leading-[0.88] tracking-[-0.045em] sm:text-[min(calc((100vw-5rem)/5.55),calc((96rem-5rem)/5.55))] lg:col-span-12">
            <span className="block overflow-hidden pb-[0.06em]">
              <motion.span
                className="block"
                initial={{ y: '102%' }}
                animate={{ y: '0%' }}
                transition={{ duration: 1.3, delay: 0.1, ease: EASE }}
              >
                Zakaria <br className="sm:hidden" />
                Kortam
              </motion.span>
            </span>
          </h1>
        </Grid>
      </motion.div>
    </section>
  )
}
