'use client'

import { useRef, type ReactNode, type ElementType } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion'

/** Ease-out-quint, the curve both reference sites settle on. */
export const EASE = [0.22, 1, 0.36, 1] as const

/** Blur, lift, settle. Short travel, long ease. */
export function BlurIn({
  children,
  delay = 0,
  className,
  as = 'div',
  once = true,
}: {
  children: ReactNode
  delay?: number
  className?: string
  as?: 'div' | 'p' | 'span' | 'li' | 'h2' | 'h3'
  once?: boolean
}) {
  const M = motion[as]
  return (
    <M
      className={className}
      initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once, margin: '0px 0px -8% 0px' }}
      transition={{ duration: 1, delay, ease: EASE }}
    >
      {children}
    </M>
  )
}

/** Headline that arrives word by word, each one un-blurring. */
export function Words({
  text,
  as: Tag = 'h2',
  className = '',
  delay = 0,
  stagger = 0.05,
  onMount = false,
}: {
  text: string
  as?: ElementType
  className?: string
  delay?: number
  stagger?: number
  /** Play on mount instead of on scroll. */
  onMount?: boolean
}) {
  const words = text.split(' ')
  const trigger = onMount
    ? { animate: 'show' }
    : { whileInView: 'show', viewport: { once: true, margin: '0px 0px -10% 0px' } }
  return (
    <Tag className={className} aria-label={text}>
      <motion.span
        aria-hidden="true"
        initial="hide"
        {...trigger}
        transition={{ staggerChildren: stagger, delayChildren: delay }}
      >
        {words.map((w, i) => (
          <motion.span
            key={i}
            className="inline-block whitespace-pre"
            variants={{
              hide: { opacity: 0, y: '0.25em', filter: 'blur(10px)' },
              show: {
                opacity: 1,
                y: 0,
                filter: 'blur(0px)',
                transition: { duration: 1.1, ease: EASE },
              },
            }}
          >
            {w + (i < words.length - 1 ? ' ' : '')}
          </motion.span>
        ))}
      </motion.span>
    </Tag>
  )
}

/** A hairline that draws from left to right. */
export function Rule({ className = '', delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.div
      className={`h-px origin-left bg-white/[0.12] ${className}`}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1.4, delay, ease: EASE }}
    />
  )
}

/** NDS-style section head: roman numeral, label, and a rule that draws in. */
export function SectionHead({
  n,
  label,
  right,
}: {
  n: string
  label: string
  right?: ReactNode
}) {
  return (
    <div className="mb-10 sm:mb-14">
      <Rule />
      <BlurIn className="flex items-baseline justify-between pt-4 text-[0.95rem]">
        <span className="flex gap-8">
          <span className="w-6 tabular-nums text-foreground-subtle">{n}</span>
          <span>{label}</span>
        </span>
        {right}
      </BlurIn>
    </div>
  )
}

/**
 * The america.gov move: a large statement whose words fill in as you scroll.
 * Inline nodes (chips, icons) can sit between words.
 */
export type FillPart = string | { node: ReactNode }

export function ScrollFill({
  parts,
  className = '',
}: {
  parts: FillPart[]
  className?: string
}) {
  const ref = useRef<HTMLParagraphElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.85', 'end 0.45'],
  })

  // Flatten to tokens so every word and inline node gets its own slice.
  const tokens: ({ word: string } | { node: ReactNode })[] = []
  for (const p of parts) {
    if (typeof p === 'string') {
      for (const w of p.split(' ').filter(Boolean)) tokens.push({ word: w })
    } else tokens.push(p)
  }
  const n = tokens.length

  return (
    <p ref={ref} className={className}>
      {tokens.map((t, i) => (
        <Token key={i} progress={scrollYProgress} start={i / n} end={(i + 1) / n}>
          {'word' in t ? t.word : t.node}
        </Token>
      ))}
    </p>
  )
}

function Token({
  children,
  progress,
  start,
  end,
}: {
  children: ReactNode
  progress: MotionValue<number>
  start: number
  end: number
}) {
  const opacity = useTransform(progress, [start, end], [0.16, 1])
  const blur = useTransform(progress, [start, end], [4, 0])
  const filter = useTransform(blur, (b) => `blur(${b}px)`)
  return (
    <>
      <motion.span className="inline-block align-middle" style={{ opacity, filter }}>
        {children}
      </motion.span>{' '}
    </>
  )
}

/** Image/art tile that un-clips from an inset as it enters. */
export function ClipReveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  return (
    <motion.div
      className={className}
      initial={{ clipPath: 'inset(14% 10% 14% 10% round 32px)', opacity: 0.4 }}
      whileInView={{ clipPath: 'inset(0% 0% 0% 0% round 28px)', opacity: 1 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 1.3, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}
