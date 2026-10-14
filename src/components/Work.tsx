'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { type Project } from '@/lib/projects-data'
import { EASE, Fade, Rule } from './Motion'


/**
 * NDS project tile: name and year above, a backdrop with the product's real
 * screen set into it like a window, one line below.
 */
export function Shot({
  p,
  ratio = 'aspect-[4/3]',
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
      className={`relative flex items-center justify-center overflow-hidden rounded-[6px] bg-[#0f0f0f] ${ratio}`}
      style={{ backgroundImage: 'linear-gradient(180deg, #161616 0%, #0b0b0b 100%)' }}
    >
      {p.image && (
        <motion.div
          className="relative w-[84%] overflow-hidden rounded-[8px] shadow-[0_30px_60px_-24px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.08] transition-transform duration-[1.1s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-1.5"
          initial={{ y: 24, opacity: 0 }}
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
            className="group flex min-h-[10rem] flex-col justify-between gap-10 py-6 sm:min-h-[15rem] sm:px-5 lg:first:pl-0"
          >
            <span className="text-sm text-foreground-subtle">{p.year}</span>
            <span>
              <span className="block text-[15px] text-foreground-muted">{p.org}</span>
              <span className="mt-1 block text-[1.65rem] leading-[1.1] tracking-[-0.025em] transition-colors duration-300 group-hover:text-foreground-muted">
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
