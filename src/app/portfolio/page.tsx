'use client'

import { useState } from 'react'
import { Container } from '@/components/Container'
import { ProjectCard } from '@/components/ProjectCard'
import { Reveal } from '@/components/Reveal'
import { projects, categories } from '@/lib/projects-data'

export default function PortfolioPage() {
  const [active, setActive] = useState<string>('All')

  const filtered =
    active === 'All' ? projects : projects.filter((p) => p.category === active)

  return (
    <main className="pt-16">
      <Container>
        <section className="border-b border-white/8 py-20">
          <Reveal>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Work
            </h1>
            <p className="mt-4 max-w-xl text-foreground-muted">
              Shipped products, research, and the systems behind them.
            </p>
          </Reveal>
        </section>

        <section className="py-12">
          <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-white/8 pb-6">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActive(c)}
                className={`focus-ring rounded text-sm transition-colors duration-200 ${
                  active === c
                    ? 'text-foreground'
                    : 'text-foreground-subtle hover:text-foreground-muted'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p, i) => (
              <Reveal key={p.id} delay={(i % 3) * 0.05}>
                <ProjectCard project={p} />
              </Reveal>
            ))}
          </div>
        </section>
      </Container>
    </main>
  )
}
