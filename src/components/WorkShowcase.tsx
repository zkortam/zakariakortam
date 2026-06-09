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
import { Constellation } from './Constellation'
import { type Project } from '@/lib/projects-data'

const GUTTER = 'max(2rem,calc((100vw-80rem)/2+2rem))'
const PANEL = 80 // vw per panel slot

export function WorkShowcase({ items }: { items: Project[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const [enhanced, setEnhanced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const apply = () => setEnhanced(mq.matches && !reduce)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [reduce])

  const panelCount = items.length + 2 // intro + roles + outro
  const endX = -((panelCount - 1) * PANEL)

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })
  const x = useTransform(scrollYProgress, [0, 1], ['0vw', `${endX}vw`])
  const railScale = useTransform(scrollYProgress, [0, 1], [0, 1])

  // Mobile / reduced-motion: the clean vertical index.
  if (!enhanced) {
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

  const maskFade = {
    maskImage: 'linear-gradient(to right, transparent, #000 42%)',
    WebkitMaskImage: 'linear-gradient(to right, transparent, #000 42%)',
  }

  return (
    <section
      id="work"
      ref={ref}
      className="hairline band relative"
      style={{ height: `${panelCount * 60}vh` }}
    >
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <motion.div style={{ x }} className="flex items-center will-change-transform">
          {/* Intro panel */}
          <div
            className="relative flex h-[66vh] shrink-0 flex-col justify-center pr-[6vw]"
            style={{ width: `${PANEL}vw`, paddingLeft: GUTTER }}
          >
            <div
              className="pointer-events-none absolute inset-y-8 right-[4vw] w-[36%] opacity-80"
              style={maskFade}
            >
              <Constellation seed={1} nodes={16} className="h-full w-full" />
            </div>
            <div className="relative z-10">
              <p className="eyebrow">Work</p>
              <h2 className="mt-4 text-display leading-[0.9]">Roles</h2>
              <p className="mt-6 max-w-sm text-lg text-foreground-muted">
                Four roles, founding AI engineer to product intern.
              </p>
              <div className="mt-9 flex items-center gap-3 text-foreground-subtle">
                <span className="text-xs uppercase tracking-[0.16em]">
                  Scroll
                </span>
                <span className="h-px w-12 bg-foreground-subtle/50" />
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* Role panels */}
          {items.map((p, i) => (
            <div
              key={p.id}
              className="flex h-[66vh] shrink-0 items-stretch px-[2.5vw]"
              style={{ width: `${PANEL}vw` }}
            >
              <Link
                href={`/portfolio/${p.id}`}
                className="focus-ring group block w-full"
              >
                <div className="glass relative flex h-full w-full overflow-hidden rounded-[2rem] p-10 transition-colors duration-500 group-hover:border-accent/25 sm:p-14">
                  {/* Generative graphic — right side, fading into the type */}
                  <div
                    className="pointer-events-none absolute inset-y-0 right-0 w-[58%]"
                    style={maskFade}
                  >
                    <Constellation seed={i + 2} className="h-full w-full" />
                  </div>

                  <div className="relative z-10 flex w-full flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="font-display text-3xl tabular-nums text-accent">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <ArrowUpRight className="h-7 w-7 text-foreground-subtle transition-all duration-500 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-accent" />
                    </div>

                    <div className="max-w-[62%]">
                      <h3 className="text-[clamp(2.25rem,5vw,4.5rem)] font-semibold leading-[0.95] tracking-tight">
                        {p.role ?? p.title}
                      </h3>
                      <p className="mt-4 text-lg text-foreground-muted">
                        {p.title}
                        {p.year ? ` · ${p.year}` : ''}
                      </p>
                      {p.tags && p.tags.length > 0 && (
                        <div className="mt-7 flex flex-wrap gap-2">
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
            </div>
          ))}

          {/* Outro panel */}
          <div
            className="flex h-[66vh] shrink-0 items-center justify-center px-[3vw]"
            style={{ width: `${PANEL}vw` }}
          >
            <Link href="/portfolio" className="focus-ring group text-center">
              <p className="eyebrow">Keep going</p>
              <h3 className="mt-5 text-[clamp(2.5rem,5vw,4.5rem)] font-semibold leading-tight">
                Work &amp; projects
              </h3>
              <span className="mt-7 inline-flex items-center gap-2 text-base text-accent">
                Explore everything
                <ArrowRight className="h-5 w-5 transition-transform duration-500 group-hover:translate-x-1.5" />
              </span>
            </Link>
          </div>
        </motion.div>

        {/* Horizontal progress rail */}
        <div
          className="absolute bottom-10 h-px bg-white/10"
          style={{ left: GUTTER, right: GUTTER }}
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
