'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { Container } from './Container'
import { EASE } from './Motion'

export function Hero() {
  return (
    <section className="relative h-[100svh] min-h-[600px] overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.6, delay: 0.2, ease: EASE }}
        className="absolute bottom-0 right-[-20%] h-[62%] w-[120%] sm:right-0 sm:h-[86%] sm:w-[52%]"
      >
        <Image
          src="/zakaria.png"
          alt="Zakaria Kortam"
          fill
          priority
          sizes="(min-width: 640px) 52vw, 120vw"
          className="object-contain object-bottom grayscale"
          style={{
            maskImage: 'linear-gradient(to top, transparent 0%, #000 30%)',
            WebkitMaskImage: 'linear-gradient(to top, transparent 0%, #000 30%)',
          }}
        />
      </motion.div>

      <Container className="relative flex h-full flex-col justify-end pb-12 sm:pb-16">
        <h1 className="font-display text-giant">
          {['Zakaria', 'Kortam'].map((w, i) => (
            <span key={w} className="block overflow-hidden pb-[0.04em]">
              <motion.span
                className="block"
                initial={{ y: '100%' }}
                animate={{ y: '0%' }}
                transition={{ duration: 1.2, delay: 0.1 + i * 0.1, ease: EASE }}
              >
                {w}
              </motion.span>
            </span>
          ))}
        </h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.7 }}
          className="mt-6 max-w-[30rem] text-lg text-foreground-muted sm:mt-8"
        >
          Associate Product Manager, Innovation at DigiCert.
        </motion.p>
      </Container>
    </section>
  )
}
