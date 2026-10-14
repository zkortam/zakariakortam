'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'

/**
 * Full-bleed band after the hero (NDS puts a film here). A deep maroon field
 * with the portrait standing in it. It opens up to the edges as it scrolls in.
 */
export function PortraitBand() {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start 0.15'] })
  const inset = useTransform(scrollYProgress, [0, 1], [5, 0])
  const radius = useTransform(scrollYProgress, [0, 1], [20, 0])
  const clip = useTransform([inset, radius], ([i, r]) => `inset(0 ${i}% round ${r}px)`)
  const imgY = useTransform(scrollYProgress, [0, 1], ['8%', '0%'])

  return (
    <div ref={ref} className="relative">
      <motion.div
        style={reduce ? undefined : { clipPath: clip }}
        className="relative aspect-[4/5] w-full overflow-hidden bg-[#3a0f18] sm:aspect-[16/9] lg:aspect-[21/9]"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, #4a1320 0%, #2a0a12 100%)' }}
        />
        <motion.div style={reduce ? undefined : { y: imgY }} className="absolute inset-x-0 bottom-0 top-[8%]">
          <Image
            src="/zakaria.png"
            alt="Zakaria Kortam"
            fill
            sizes="100vw"
            className="object-contain object-bottom grayscale"
          />
        </motion.div>
      </motion.div>
    </div>
  )
}
