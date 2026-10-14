'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { type Project } from '@/lib/projects-data'
import { EASE, Fade, Rule } from './Motion'

/** Each tile gets a quiet backdrop from the same family. */
const BACKDROPS: Record<string, string> = {
  helio: 'linear-gradient(160deg, #2b0c13 0%, #160609 100%)',
  surf: 'linear-gradient(160deg, #1b1b1d 0%, #0d0d0e 100%)',
  'surf-messenger': 'linear-gradient(160deg, #3d111b 0%, #1c070c 100%)',
  'spice-plus-plus': 'linear-gradient(160deg, #1d1c1b 0%, #0e0d0d 100%)',
  airofind: 'linear-gradient(160deg, #331019 0%, #170609 100%)',
}

/**
 * NDS project tile: name and year above, a backdrop with the product's real
 * screen set into it like a window, one line below.
 */
export function Shot({
  p,
  ratio = 'aspect-[4/5]',
  className = '',
  delay = 0,
}: {
  p: Project
  ratio?: string
  className?: string
  delay?: number
}) {
  return (
    <Fade delay={delay} className={className}>
      <Link href={`/portfolio/${p.id}`} className="group block">
        <div className="mb-3 flex items-baseline justify-between text-[15px]">
          <span>{p.title}</span>
          <span className="text-foreground-subtle">{p.year}</span>
        </div>
        <Backdrop p={p} ratio={ratio} />
        <p className="mt-4 max-w-[28rem] text-[15px] leading-snug text-foreground-muted">{p.line}</p>
      </Link>
    </Fade>
  )
}

/** The backdrop and window on their own, for project pages. */
export function Backdrop({ p, ratio, priority = false }: { p: Project; ratio: string; priority?: boolean }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[6px] ${ratio}`}
      style={{ background: BACKDROPS[p.id] ?? BACKDROPS.surf }}
    >
      {p.image && (
        <motion.div
          className="absolute left-[9%] top-[14%] w-[118%] overflow-hidden rounded-[10px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.75)] ring-1 ring-white/10 transition-transform duration-[1.1s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-2"
          initial={{ y: 40, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: '0px 0px -10% 0px' }}
          transition={{ duration: 1.3, ease: EASE }}
        >
          <Image
            src={p.image}
            alt={`${p.title} screenshot`}
            width={1600}
            height={1000}
            priority={priority}
            sizes="(min-width: 1024px) 60vw, 110vw"
            className="block h-auto w-full"
          />
        </motion.div>
      )}
    </div>
  )
}

/** NDS news rail: columns split by vertical hairlines, date up top, name at the floor. */
export function Rail({ items }: { items: Project[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:col-span-12 lg:grid-cols-4">
      {items.map((p, i) => (
        <Fade
          key={p.id}
          delay={i * 0.06}
          className="border-white/[0.12] max-sm:border-b sm:max-lg:[&:nth-child(odd)]:border-r lg:border-r lg:last:border-r-0"
        >
          <Link
            href={`/portfolio/${p.id}`}
            className="group flex min-h-[11rem] flex-col justify-between gap-10 py-6 sm:min-h-[19rem] sm:px-5 lg:first:pl-0"
          >
            <span className="text-sm text-foreground-subtle">{p.year}</span>
            <span>
              <span className="block text-[15px] text-foreground-muted">{p.org}</span>
              <span className="mt-1 block text-[1.5rem] leading-[1.12] tracking-[-0.025em] transition-colors duration-300 group-hover:text-foreground-muted">
                {p.role}
              </span>
            </span>
          </Link>
        </Fade>
      ))}
    </div>
  )
}

/** List rows on the grid: title at column 1, line at column 7, year at the edge. */
export function Rows({ items }: { items: Project[] }) {
  return (
    <ul className="lg:col-span-12">
      {items.map((p, i) => (
        <li key={p.id}>
          <Fade delay={i * 0.03}>
            <Link
              href={`/portfolio/${p.id}`}
              className="group grid grid-cols-[1fr_auto] gap-x-5 gap-y-1 py-5 lg:grid-cols-12"
            >
              <span className="text-[1.15rem] tracking-[-0.02em] transition-colors duration-300 group-hover:text-foreground-muted lg:col-span-6">
                {p.title}
              </span>
              <span className="col-span-2 row-start-2 text-foreground-muted lg:col-span-5 lg:row-start-auto">
                {p.line}
              </span>
              <span className="col-start-2 row-start-1 text-right text-sm text-foreground-subtle lg:col-span-1 lg:col-start-auto lg:row-start-auto">
                {p.year}
              </span>
            </Link>
          </Fade>
          <Rule />
        </li>
      ))}
    </ul>
  )
}
