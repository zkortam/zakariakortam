'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { type Project } from '@/lib/projects-data'
import { ProjectArt } from './ProjectArt'
import { BlurIn, ClipReveal, EASE, Rule } from './Motion'
import { Sheen } from './Sheen'

/** NDS grid tile: small label on top, tall glass panel with the drawing, one line under. */
export function ProjectTile({ p, i, className = '' }: { p: Project; i: number; className?: string }) {
  return (
    <Link href={`/portfolio/${p.id}`} className={`focus-ring group block rounded-[28px] ${className}`}>
      <BlurIn delay={(i % 3) * 0.08} className="mb-3 flex items-baseline justify-between text-sm">
        <span>{p.title}</span>
        <span className="text-foreground-subtle">{p.year}</span>
      </BlurIn>
      <ClipReveal delay={(i % 3) * 0.08}>
        <Sheen className="glass relative aspect-[5/4] overflow-hidden rounded-[28px] transition-[border-color] duration-700 group-hover:border-white/20">
          <ProjectArt
            id={p.id}
            seed={i * 0.37}
            className="absolute inset-0 transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
          />
          <span className="absolute bottom-5 right-5 flex h-10 w-10 translate-y-2 items-center justify-center rounded-full bg-white text-black opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
            →
          </span>
        </Sheen>
      </ClipReveal>
      <BlurIn delay={0.15 + (i % 3) * 0.08} as="p" className="mt-4 max-w-[26rem] text-[0.95rem] leading-snug text-foreground-muted">
        {p.line}
      </BlurIn>
    </Link>
  )
}

/**
 * NDS news row: tall cells split by vertical hairlines, date up top, title
 * at the bottom. On hover a maroon glass fill rises from the floor.
 */
export function RoleColumns({ items }: { items: Project[] }) {
  return (
    <div className="grid border-white/[0.1] sm:grid-cols-2 lg:grid-cols-4">
      {items.map((p, i) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '0px 0px -10% 0px' }}
          transition={{ duration: 1, delay: i * 0.08, ease: EASE }}
          className="border-white/[0.1] max-lg:border-t sm:[&:nth-child(odd)]:border-r lg:border-r lg:last:border-r-0"
        >
          <Link
            href={`/portfolio/${p.id}`}
            className="focus-ring group relative flex min-h-[13rem] flex-col justify-between gap-10 overflow-hidden px-1 py-6 sm:h-[22rem] sm:p-5 lg:p-6"
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 translate-y-full bg-gradient-to-t from-accent-strong/60 via-accent-strong/20 to-transparent transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0"
            />
            <span className="relative text-sm text-foreground-subtle">{p.year}</span>
            <span className="relative">
              <span className="block text-sm text-foreground-muted">{p.org}</span>
              <span className="mt-1 block text-[1.6rem] leading-[1.1] tracking-[-0.025em]">
                {p.role}
              </span>
              <span className="mt-4 block max-w-[18rem] text-[0.95rem] leading-snug text-foreground-muted opacity-80 transition-opacity duration-500 group-hover:opacity-100">
                {p.line}
              </span>
            </span>
          </Link>
        </motion.div>
      ))}
    </div>
  )
}

/** Plain list rows for smaller and older projects. */
export function PlainList({ items }: { items: Project[] }) {
  return (
    <div>
      {items.map((p, i) => (
        <div key={p.id}>
          <Link
            href={`/portfolio/${p.id}`}
            className="focus-ring group grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-1 py-5 sm:grid-cols-[14rem_1fr_auto] sm:py-6"
          >
            <BlurIn delay={i * 0.04} as="span" className="text-[1.15rem] tracking-[-0.02em] transition-transform duration-500 group-hover:translate-x-1">
              {p.title}
            </BlurIn>
            <BlurIn delay={i * 0.04 + 0.05} as="span" className="col-span-2 row-start-2 text-foreground-muted sm:col-span-1 sm:row-start-auto">
              {p.line}
            </BlurIn>
            <BlurIn delay={i * 0.04 + 0.1} as="span" className="text-sm tabular-nums text-foreground-subtle">
              {p.year}
            </BlurIn>
          </Link>
          <Rule delay={i * 0.04} />
        </div>
      ))}
    </div>
  )
}

/** america.gov feature row: rounded media tile, short headline, small copy, a link. */
export function FeatureRow({ p, i }: { p: Project; i: number }) {
  const flip = i % 2 === 1
  return (
    <div className="grid items-center gap-8 py-10 sm:py-16 lg:grid-cols-12 lg:gap-10">
      <ClipReveal className={`lg:col-span-6 ${flip ? 'lg:order-2 lg:col-start-7' : ''}`}>
        <Link href={`/portfolio/${p.id}`} className="focus-ring group block rounded-[32px]">
          <Sheen className="glass relative aspect-[5/4] overflow-hidden rounded-[32px] transition-[border-color] duration-700 group-hover:border-white/20">
            <ProjectArt
              id={p.id}
              seed={i * 0.41}
              className="absolute inset-0 transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
            />
          </Sheen>
        </Link>
      </ClipReveal>
      <div className={`lg:col-span-4 ${flip ? 'lg:col-start-2' : 'lg:col-start-8'}`}>
        <BlurIn className="text-sm text-foreground-subtle">
          {p.org ?? p.role} · {p.year}
        </BlurIn>
        <BlurIn as="h3" delay={0.06} className="mt-3 text-[clamp(1.8rem,2.8vw,2.5rem)] leading-[1.05] tracking-[-0.03em]">
          {p.kind === 'work' ? p.role : p.title}
        </BlurIn>
        <BlurIn as="p" delay={0.12} className="mt-5 max-w-[28rem] text-[1.05rem] leading-relaxed text-foreground-muted">
          {p.overview}
        </BlurIn>
        <BlurIn delay={0.18} className="mt-6">
          <Link href={`/portfolio/${p.id}`} className="focus-ring group inline-flex items-center gap-2 rounded text-[0.95rem] font-medium">
            Read more
            <span className="transition-transform duration-500 group-hover:translate-x-1">→</span>
          </Link>
        </BlurIn>
      </div>
    </div>
  )
}
