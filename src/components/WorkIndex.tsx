'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { Stagger, StaggerItem } from './Reveal'
import { type Project } from '@/lib/projects-data'

/**
 * Editorial index of roles — a hover-reactive list rather than a card grid.
 * Maroon wash sweeps in, the title shifts, and the arrow arrives on hover.
 */
export function WorkIndex({ items }: { items: Project[] }) {
  return (
    <Stagger className="mt-12 border-t border-white/[0.1]">
      {items.map((p, i) => (
        <StaggerItem key={p.id}>
          <Link
            href={`/portfolio/${p.id}`}
            className="focus-ring group relative block overflow-hidden border-b border-white/[0.1]"
          >
            {/* Maroon wash sweeps from the left on hover */}
            <span className="pointer-events-none absolute inset-0 origin-left scale-x-0 bg-gradient-to-r from-accent/[0.16] via-accent/[0.05] to-transparent transition-transform duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100" />

            <div className="relative grid grid-cols-[auto_1fr_auto] items-center gap-4 py-7 sm:gap-8 sm:py-9">
              <span className="font-display text-sm tabular-nums text-foreground-subtle transition-colors duration-500 group-hover:text-accent">
                {String(i + 1).padStart(2, '0')}
              </span>

              <div className="min-w-0 transition-transform duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-2 sm:group-hover:translate-x-3">
                <h3 className="truncate text-2xl font-semibold leading-tight sm:text-3xl md:text-[2.5rem]">
                  {p.role ?? p.title}
                </h3>
                <p className="mt-1.5 text-sm text-foreground-muted sm:text-base">
                  {p.title}
                  {p.year ? ` · ${p.year}` : ''}
                </p>
              </div>

              <ArrowUpRight className="h-6 w-6 shrink-0 -translate-x-2 text-foreground-subtle opacity-0 transition-all duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0 group-hover:text-accent group-hover:opacity-100 sm:h-8 sm:w-8" />
            </div>
          </Link>
        </StaggerItem>
      ))}
    </Stagger>
  )
}
