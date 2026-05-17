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
    <main className="pt-28">
      <Container className="space-y-6 pb-24">
        <Reveal>
          <section className="glass rounded-5xl px-8 py-16 sm:px-14">
            <h1 className="text-4xl font-semibold tracking-tight text-gradient sm:text-5xl">
              Work
            </h1>
            <p className="mt-5 max-w-xl text-lg text-foreground-muted">
              Shipped products, research, and the systems behind them.
            </p>
          </section>
        </Reveal>

        <Reveal>
          <div className="glass flex flex-wrap gap-1.5 rounded-full p-1.5">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActive(c)}
                className={`focus-ring rounded-full px-4 py-2 text-sm transition-colors duration-300 ${
                  active === c
                    ? 'bg-white/10 text-foreground'
                    : 'text-foreground-muted hover:text-foreground'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </Reveal>

        <div className="grid gap-5 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <Reveal key={p.id} delay={(i % 3) * 0.05}>
              <ProjectCard project={p} />
            </Reveal>
          ))}
        </div>
      </Container>
    </main>
  )
}
