'use client'

import { useEffect, useRef, useState } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  useReducedMotion,
} from 'framer-motion'
import { Section } from './Section'
import { Reveal, Stagger, StaggerItem } from './Reveal'

export type Focus = { area: string; desc: string }

const EASE = [0.16, 1, 0.3, 1] as const

export function FocusScroll({ items }: { items: Focus[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)
  // Pin/scrub only on large screens with motion allowed. Static-first so SSR
  // and mobile never reserve the tall scroll track or mismatch on hydrate.
  const [enhanced, setEnhanced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const apply = () => setEnhanced(mq.matches && !reduce)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [reduce])

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const idx = Math.min(items.length - 1, Math.floor(v * items.length * 0.999))
    setActive(idx < 0 ? 0 : idx)
  })

  const railScale = useTransform(scrollYProgress, [0, 1], [0, 1])

  // Static grid — mobile and reduced-motion.
  if (!enhanced) {
    return (
      <Section divider className="py-24 sm:py-32">
        <Reveal>
          <p className="eyebrow">What I work on</p>
          <h2 className="mt-4 text-headline">Systems that think and ship.</h2>
        </Reveal>
        <Stagger className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-white/[0.07] sm:grid-cols-2">
          {items.map((f, i) => (
            <StaggerItem key={f.area} className="bg-black p-8">
              <div className="font-display text-sm text-foreground-subtle">
                {String(i + 1).padStart(2, '0')}
              </div>
              <h3 className="mt-5 text-lg font-semibold">{f.area}</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                {f.desc}
              </p>
            </StaggerItem>
          ))}
        </Stagger>
      </Section>
    )
  }

  return (
    <section ref={ref} className="hairline relative" style={{ height: '300vh' }}>
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-content gap-x-16 gap-y-12 px-6 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          {/* Left: heading + big changing index */}
          <div>
            <p className="eyebrow">What I work on</p>
            <h2 className="mt-4 text-headline">
              Systems that
              <br />
              think and ship.
            </h2>

            <div className="mt-10 flex items-center gap-5">
              <div className="relative h-9 w-12 overflow-hidden font-display text-4xl leading-none text-accent">
                {items.map((f, i) => (
                  <motion.span
                    key={f.area}
                    className="absolute inset-0"
                    animate={{
                      y: active === i ? '0%' : active > i ? '-120%' : '120%',
                      opacity: active === i ? 1 : 0,
                    }}
                    transition={{ duration: 0.6, ease: EASE }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </motion.span>
                ))}
              </div>
              {/* Progress rail */}
              <div className="relative h-px flex-1 bg-white/10">
                <motion.div
                  className="absolute inset-y-0 left-0 w-full origin-left bg-accent"
                  style={{ scaleX: railScale }}
                />
              </div>
              <span className="font-display text-sm text-foreground-subtle">
                {String(items.length).padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Right: the focus items, activating in sequence on scrub */}
          <ul className="space-y-1">
            {items.map((f, i) => {
              const isActive = active === i
              return (
                <motion.li
                  key={f.area}
                  animate={{
                    opacity: isActive ? 1 : 0.3,
                    filter: isActive ? 'blur(0px)' : 'blur(1px)',
                  }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="relative border-t border-white/[0.07] py-6 first:border-t-0 sm:py-7"
                >
                  <div className="flex items-baseline gap-5">
                    <span className="font-display text-sm text-foreground-subtle">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold sm:text-2xl">
                        {f.area}
                      </h3>
                      <motion.p
                        animate={{
                          height: isActive ? 'auto' : 0,
                          opacity: isActive ? 1 : 0,
                          marginTop: isActive ? 10 : 0,
                        }}
                        transition={{ duration: 0.5, ease: EASE }}
                        className="overflow-hidden text-sm leading-relaxed text-foreground-muted sm:text-base"
                      >
                        {f.desc}
                      </motion.p>
                    </div>
                  </div>
                </motion.li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
