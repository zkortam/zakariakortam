'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { Grid } from './Container'

/**
 * Full-bleed band that slides up over the pinned hero. A lit studio backdrop
 * in deep maroon, the portrait set in the right third, a small caption at the
 * left. The photo settles from a slight zoom as the band arrives.
 */
export function PortraitBand() {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start start'] })
  const scale = useTransform(scrollYProgress, [0, 1], [1.08, 1])

  return (
    <div
      ref={ref}
      className="relative z-10 h-[100svh] min-h-[560px] overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse 70% 90% at 68% 35%, #5c1828 0%, #33101a 45%, #160609 100%)',
      }}
    >
      <motion.div
        style={reduce ? undefined : { scale }}
        className="absolute inset-x-[-18%] bottom-0 h-[72%] origin-bottom sm:inset-x-auto sm:right-[6%] sm:h-[92%] sm:w-[62%] lg:w-[52%]"
      >
        <Image
          src="/zakaria.png"
          alt="Zakaria Kortam"
          fill
          priority
          sizes="(min-width: 640px) 60vw, 100vw"
          className="object-contain object-bottom grayscale"
        />
      </motion.div>
      <Grid className="absolute inset-x-0 bottom-0 pb-10 text-[15px] text-white/70 sm:pb-14">
        <p className="lg:col-span-6">San Jose, California</p>
      </Grid>
    </div>
  )
}
