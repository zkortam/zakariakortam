'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from 'framer-motion'
import { WorkIndex } from './WorkIndex'
import { Section } from './Section'
import { Reveal } from './Reveal'
import { MaskText } from './MaskText'
import { ShaderGradient } from './ShaderGradient'
import { type Project } from '@/lib/projects-data'

// The reading-column gutter — keeps the fixed header aligned to the site grid.
// (calc requires spaces around + and -.)
const GUTTER = 'max(2rem, calc((100vw - 80rem) / 2 + 2rem))'

const maskFade = {
  maskImage: 'linear-gradient(to right, transparent, #000 42%)',
  WebkitMaskImage: 'linear-gradient(to right, transparent, #000 42%)',
}

export function WorkShowcase({ items }: { items: Project[] }) {
  const reduce = useReducedMotion()
  const [enhanced, setEnhanced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const apply = () => setEnhanced(mq.matches && !reduce)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [reduce])

  // Pinned scene mounts only once enhanced — so useScroll measures the real,
  // final DOM (the short static version lagged the scroll progress).
  return enhanced ? (
    <WorkShowcasePinned items={items} />
  ) : (
    <WorkShowcaseStatic items={items} />
  )
}

function WorkShowcaseStatic({ items }: { items: Project[] }) {
  return (
    <Section divider band className="py-24 sm:py-32">
      <Reveal className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Work</p>
          <MaskText as="h2" className="mt-4 text-headline" lines={['Roles']} />
        </div>
        <Link
          href="/portfolio"
          className="focus-ring group inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-5 py-2.5 text-sm text-foreground-muted transition-all duration-300 hover:border-accent/30 hover:text-accent"
        >
          Work and projects
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </Link>
      </Reveal>
      <WorkIndex items={items} />
    </Section>
  )
}

function WorkShowcasePinned({ items }: { items: Project[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [maxScroll, setMaxScroll] = useState(0)

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })

  // Measure the real horizontal overflow so the travel is pixel-accurate.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const measure = () => {
      const parent = track.parentElement
      if (!parent) return
      setMaxScroll(Math.max(0, track.offsetWidth - parent.clientWidth))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(track)
    return () => ro.disconnect()
  }, [items.length])

  const x = useTransform(scrollYProgress, [0, 1], [0, -maxScroll])
  const railScale = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <section
      ref={ref}
      className="hairline band relative"
      style={{ height: `${(items.length + 1) * 72}vh` }}
    >
      <div className="sticky top-0 flex h-screen flex-col overflow-hidden">
        {/* Fixed header — aligned to the grid, never scrolls into the bezel */}
        <div
          className="flex items-end justify-between gap-8 pb-8 pt-28 sm:pt-32"
          style={{ paddingLeft: GUTTER, paddingRight: GUTTER }}
        >
          <div>
            <p className="eyebrow">Work</p>
            <h2 className="mt-3 text-headline">Roles</h2>
          </div>
          <p className="hidden max-w-xs pb-2 text-base text-foreground-muted md:block">
            Founding AI engineer to product intern — four roles, end to end.
          </p>
        </div>

        {/* Horizontal track — only the cards travel */}
        <div className="relative min-h-0 flex-1">
          <motion.div
            ref={trackRef}
            style={{ x, paddingLeft: GUTTER }}
            className="absolute left-0 top-0 flex h-full w-max items-center gap-[2vw] pr-[6vw] will-change-transform"
          >
            {items.map((p, i) => (
              <Link
                key={p.id}
                href={`/portfolio/${p.id}`}
                className="focus-ring group block h-[62vh] w-[clamp(22rem,52vw,44rem)] shrink-0"
              >
                <div className="glass relative flex h-full w-full overflow-hidden rounded-[2rem] p-10 transition-colors duration-500 group-hover:border-accent/25 sm:p-12">
                  {/* Shader graphic — right side, fading into the type */}
                  <div
                    className="pointer-events-none absolute inset-y-0 right-0 w-[56%]"
                    style={maskFade}
                  >
                    <ShaderGradient
                      seed={(i + 1) * 0.41}
                      className="block h-full w-full"
                    />
                  </div>

                  <div className="relative z-10 flex w-full flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="font-display text-3xl tabular-nums text-accent">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <ArrowUpRight className="h-7 w-7 text-foreground-subtle transition-all duration-500 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-accent" />
                    </div>

                    <div className="max-w-[64%]">
                      <h3 className="text-[clamp(2rem,4vw,3.5rem)] font-semibold leading-[0.98] tracking-tight">
                        {p.role ?? p.title}
                      </h3>
                      <p className="mt-4 text-lg text-foreground-muted">
                        {p.title}
                        {p.year ? ` · ${p.year}` : ''}
                      </p>
                      {p.tags && p.tags.length > 0 && (
                        <div className="mt-6 flex flex-wrap gap-2">
                          {p.tags.slice(0, 4).map((t) => (
                            <span
                              key={t}
                              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-foreground-muted"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}

            {/* Outro */}
            <div className="flex h-[62vh] w-[clamp(18rem,30vw,28rem)] shrink-0 items-center">
              <Link href="/portfolio" className="focus-ring group">
                <p className="eyebrow">Keep going</p>
                <h3 className="mt-4 text-[clamp(1.75rem,3vw,2.75rem)] font-semibold leading-tight">
                  Work &amp; projects
                </h3>
                <span className="mt-6 inline-flex items-center gap-2 text-base text-accent">
                  Explore everything
                  <ArrowRight className="h-5 w-5 transition-transform duration-500 group-hover:translate-x-1.5" />
                </span>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Progress rail */}
        <div
          className="mb-10 mt-6 h-px bg-white/10"
          style={{ marginLeft: GUTTER, marginRight: GUTTER }}
        >
          <motion.div
            style={{ scaleX: railScale }}
            className="h-full w-full origin-left bg-accent"
          />
        </div>
      </div>
    </section>
  )
}
