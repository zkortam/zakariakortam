'use client'

import { motion } from 'framer-motion'
import { Container } from './Container'
import { EASE, Rule, Words } from './Motion'

/** Inner-page header: the title set large in serif, a plain statement in the right column. */
export function PageHead({ title, statement }: { title: string; statement: string }) {
  return (
    <Container className="pt-36 sm:pt-44">
      <h1 className="font-display text-display" aria-label={title}>
        <span className="block overflow-hidden pb-[0.08em]">
          <motion.span
            className="block"
            initial={{ y: '105%' }}
            animate={{ y: '0%' }}
            transition={{ duration: 1.3, ease: EASE, delay: 0.1 }}
          >
            {title}
          </motion.span>
        </span>
      </h1>
      <div className="mt-14 grid gap-6 sm:mt-20 lg:grid-cols-2">
        <div className="hidden lg:block" />
        <Words
          as="p"
          onMount
          delay={0.4}
          stagger={0.03}
          className="max-w-[34rem] text-lede"
          text={statement}
        />
      </div>
      <Rule className="mt-20 sm:mt-28" delay={0.6} />
    </Container>
  )
}
