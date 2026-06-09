'use client'

import { useRef, useState } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  useReducedMotion,
} from 'framer-motion'

const EASE = [0.16, 1, 0.3, 1] as const

export type Experience = {
  role: string
  org: string
  when: string
  points: string[]
}

/**
 * Scroll-drawn timeline: a maroon line fills as you scroll through, the dots
 * light up in sequence, and each role rises in. Same scrubbed energy as the
 * "What I work on" section, applied to a vertical list.
 */
export function ExperienceTimeline({ items }: { items: Experience[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 65%', 'end 60%'],
  })
  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1])

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    setActive(
      Math.min(items.length - 1, Math.max(0, Math.ceil(v * items.length) - 1)),
    )
  })

  return (
    <div ref={ref} className="relative pl-9 sm:pl-14">
      {/* Track + maroon fill */}
      <div className="absolute bottom-2 left-[10px] top-2 w-px bg-white/10 sm:left-[15px]" />
      <motion.div
        style={reduce ? { transform: 'scaleY(1)' } : { scaleY: lineScale }}
        className="absolute bottom-2 left-[10px] top-2 w-px origin-top bg-accent sm:left-[15px]"
      />

      <div className="space-y-12 sm:space-y-16">
        {items.map((e, i) => {
          const on = reduce || i <= active
          return (
            <motion.div
              key={e.org}
              initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }}
              whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              viewport={{ once: true, margin: '-15% 0px -15% 0px' }}
              transition={{ duration: 0.75, ease: EASE }}
              className="relative"
            >
              {/* Dot marker on the line */}
              <span className="absolute -left-[33px] top-1.5 flex h-6 w-6 items-center justify-center sm:-left-[46px]">
                <motion.span
                  animate={{
                    scale: on ? 1 : 0.55,
                    backgroundColor: on
                      ? 'rgb(168 58 70)'
                      : 'rgb(42 42 45)',
                    boxShadow: on
                      ? '0 0 0 4px rgb(168 58 70 / 0.15)'
                      : '0 0 0 0 rgb(168 58 70 / 0)',
                  }}
                  transition={{ duration: 0.45, ease: EASE }}
                  className="h-2.5 w-2.5 rounded-full"
                />
              </span>

              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-xl font-semibold sm:text-2xl">
                  {e.role}{' '}
                  <span className="text-foreground-muted">· {e.org}</span>
                </h3>
                <span className="text-sm text-foreground-subtle">{e.when}</span>
              </div>
              <ul className="mt-4 space-y-2.5">
                {e.points.map((p) => (
                  <li
                    key={p}
                    className="flex gap-3 text-sm leading-relaxed text-foreground-muted"
                  >
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground-subtle" />
                    {p}
                  </li>
                ))}
              </ul>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
