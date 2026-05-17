'use client'

import { useState } from 'react'
import { Section } from '@/components/Section'
import { ProjectCard } from '@/components/ProjectCard'
import { Reveal } from '@/components/Reveal'
import { projects, categories } from '@/lib/projects-data'

export default function PortfolioPage() {
  const [active, setActive] = useState<string>('All')

  const filtered =
    active === 'All' ? projects : projects.filter((p) => p.category === active)

  return (
    <main>
      {/* Hero */}
      <Section className="relative overflow-hidden pt-40 pb-20 sm:pt-48 sm:pb-24">
        <div className="pointer-events-none absolute -right-32 top-10 h-[440px] w-[440px] rounded-full bg-accent/15 blur-[140px]" />
        <Reveal className="relative">
          <span className="badge">
            <span className="badge-dot" />
            Portfolio
          </span>
          <h1 className="mt-8 text-display text-balance">
            <span className="text-gradient">Selected </span>
            <span className="text-accent">work.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg text-foreground-muted sm:text-xl">
            Shipped products, research, and the systems behind them.
          </p>
        </Reveal>
      </Section>

      {/* Filters + grid */}
      <Section divider band className="py-16 sm:py-20">
        <Reveal>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActive(c)}
                className={`focus-ring rounded-full border px-5 py-2.5 text-sm font-medium transition-all duration-300 ${
                  active === c
                    ? 'border-accent/40 bg-accent/15 text-accent'
                    : 'border-white/10 text-foreground-muted hover:border-white/20 hover:text-foreground'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </Reveal>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <Reveal key={p.id} delay={(i % 3) * 0.06}>
              <ProjectCard project={p} />
            </Reveal>
          ))}
        </div>
      </Section>
    </main>
  )
}
