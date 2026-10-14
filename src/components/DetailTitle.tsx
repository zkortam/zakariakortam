'use client'

import { motion } from 'framer-motion'
import { EASE } from './Motion'

/** Project title: letters rise out of a mask, one after another. */
export function DetailTitle({ title }: { title: string }) {
  return (
    <h1 className="mt-10 font-display text-giant" aria-label={title}>
      <span className="block overflow-hidden pb-[0.08em]" aria-hidden="true">
        {Array.from(title).map((ch, i) => (
          <motion.span
            key={i}
            className="inline-block whitespace-pre"
            initial={{ y: '105%' }}
            animate={{ y: '0%' }}
            transition={{ duration: 1.2, delay: 0.1 + i * 0.03, ease: EASE }}
          >
            {ch}
          </motion.span>
        ))}
      </span>
    </h1>
  )
}
