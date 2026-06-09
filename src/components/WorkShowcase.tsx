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
import { type Project } from '@/lib/projects-data'

const EASE = [0.16, 1, 0.3, 1] as const

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

  // intro panel + role panels + outro panel
  const panelCount = items.length + 2
  const step = 80 // vw per panel
  const endX = -((panelCount - 1) * step) + 22 // leave a small trailing gutter

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

  return (
    <section
      id="work"
      ref={ref}
      className="hairline band relative"
      style={{ height: `${panelCount * 58}vh` }}
    >
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <motion.div style={{ x }} className="flex items-center will-change-transform">
          {/* Intro panel */}
          <div className="flex h-[64vh] w-[80vw] shrink-0 flex-col justify-center pl-[max(2rem,calc((100vw-80rem)/2+2rem))] pr-[8vw]">
            <p className="eyebrow">Work</p>
            <h2 className="mt-4 text-display leading-[0.9]">Roles</h2>
            <p className="mt-6 max-w-sm text-lg text-foreground-muted">
              Four roles — founding AI engineer to product intern. Scroll
              across.
            </p>
            <div className="mt-8 flex items-center gap-3 text-foreground-subtle">
              <span className="text-sm uppercase tracking-[0.14em]">Scroll</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>

          {/* Role panels */}
          {items.map((p, i) => (
            <Link
              key={p.id}
              href={`/portfolio/${p.id}`}
              className="focus-ring group flex h-[64vh] w-[80vw] shrink-0 items-stretch px-[3vw]"
            >
              <div className="glass relative flex w-full flex-col justify-between overflow-hidden rounded-[2rem] p-12 transition-colors duration-500 group-hover:border-accent/25">
                {/* Oversized index number, watermark style */}
                <span className="pointer-events-none absolute -right-2 -top-10 font-display text-[16rem] leading-none text-white/[0.04]">
                  {String(i + 1).padStart(2, '0')}
                </span>

                <div className="relative flex items-center justify-between">
                  <span className="font-display text-2xl tabular-nums text-accent">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <ArrowUpRight className="h-7 w-7 text-foreground-subtle transition-all duration-500 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-accent" />
                </div>

                <div className="relative">
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
            </Link>
          ))}

          {/* Outro panel */}
          <div className="flex h-[64vh] w-[80vw] shrink-0 flex-col justify-center px-[3vw]">
            <Link href="/portfolio" className="focus-ring group inline-flex flex-col">
              <span className="eyebrow">Keep going</span>
              <span className="mt-4 inline-flex items-center gap-4 text-[clamp(2rem,4.5vw,4rem)] font-semibold leading-tight">
                Work &amp; projects
                <ArrowRight className="h-10 w-10 text-accent transition-transform duration-500 group-hover:translate-x-2" />
              </span>
            </Link>
          </div>
        </motion.div>

        {/* Horizontal progress rail */}
        <div className="absolute inset-x-[max(2rem,calc((100vw-80rem)/2+2rem))] bottom-10 h-px bg-white/10">
          <motion.div
            style={{ scaleX: railScale }}
            className="h-full w-full origin-left bg-accent"
          />
        </div>
      </div>
    </section>
  )
}
