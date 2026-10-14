'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

/**
 * Inline glass chip that sits inside a sentence, the way america.gov drops
 * seals and icons into its headlines. Each glyph is a tiny animated drawing.
 */

const G = {
  helio: (
    <>
      <path d="M5 6 C 8 19, 16 19, 19 6" />
      <path d="M3 18 H21" opacity={0.4} />
    </>
  ),
  surf: <path d="M2 14 c3 -5 6 -5 8 0 s5 5 8 0 c1 -2 3 -2 4 0" />,
  messenger: <path d="M5 6 h14 a2 2 0 0 1 2 2 v7 a2 2 0 0 1 -2 2 h-8 l-4 3 v-3 h-2 a2 2 0 0 1 -2 -2 v-7 a2 2 0 0 1 2 -2 Z" />,
  spice: <path d="M2 12 H6 l1.5 -4 l3 8 l3 -8 l3 8 l1.5 -4 H22" />,
  plane: <path d="M3 13 L21 6 L15 20 L12 14 Z M12 14 L21 6" />,
  lock: (
    <>
      <path d="M8 11 V8 a4 4 0 0 1 8 0 V11" />
      <rect x="6" y="11" width="12" height="9" rx="2" />
    </>
  ),
}

export type Glyph = keyof typeof G

export function Chip({
  glyph,
  label,
  href,
}: {
  glyph: Glyph
  label: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="glass group mx-[0.08em] inline-flex -translate-y-[0.06em] items-center gap-[0.3em] rounded-full py-[0.1em] pl-[0.22em] pr-[0.42em] align-middle transition-colors duration-500 hover:border-accent/50"
    >
      <span className="inline-flex h-[1.05em] w-[1.05em] items-center justify-center rounded-full bg-accent-strong shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
        <motion.svg
          viewBox="0 0 24 24"
          className="h-[0.62em] w-[0.62em] transition-transform duration-700 group-hover:scale-110"
          fill="none"
          stroke="#fff"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ opacity: 0, rotate: -20 }}
          whileInView={{ opacity: 1, rotate: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          {G[glyph]}
        </motion.svg>
      </span>
      <span>{label}</span>
    </Link>
  )
}
