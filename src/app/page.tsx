'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { Hero } from '@/components/Hero'
import { ProjectPreview } from '@/components/ProjectPreview'
import { GlassCard } from '@/components/GlassCard'
import { Reveal, Stagger, StaggerItem } from '@/components/Reveal'
import { projects } from '@/lib/projects-data'

const focus = [
  { area: 'Agentic AI', desc: 'Model Context Protocol, tool-using agents' },
  { area: 'Product Engineering', desc: 'React, TypeScript, Node.js' },
  { area: 'Applied ML', desc: 'LLMs, vector search, computer vision' },
  { area: 'Cross-Platform', desc: 'Flutter and Dart across iOS, Android, web' },
]

const featured = ['facilis-ai', 'surf', 'documap-ai', 'incorta-dashboards']

export default function HomePage() {
  return (
    <main>
      <Hero />

      {/* Intro */}
      <section className="mx-auto max-w-5xl px-6 py-28">
        <div className="grid gap-14 md:grid-cols-[1.1fr_1fr] md:gap-20">
          <Reveal>
            <h2 className="text-headline text-gradient">
              I design and ship AI products where the intelligence stays out of
              the way.
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="space-y-5 text-foreground-muted text-pretty">
            <p>
              AI Engineer at <span className="text-foreground">Facilis</span>,
              building agentic tools for industrial enterprise. Senior at{' '}
              <span className="text-foreground">UC San Diego</span> in
              Electrical Engineering, focused on machine learning and controls.
            </p>
            <p>
              Previously a product engineer at{' '}
              <span className="text-foreground">Incorta</span> and founder of{' '}
              <span className="text-foreground">Surf</span>. Graduated Magna Cum
              Laude with a triple major in CS, Math, and Physics.
            </p>
          </Reveal>
        </div>

        <Stagger className="mt-20 grid gap-px overflow-hidden rounded-4xl glass sm:grid-cols-2">
          {focus.map((f) => (
            <StaggerItem
              key={f.area}
              className="bg-white/[0.015] p-7 transition-colors duration-base hover:bg-white/[0.04]"
            >
              <div className="text-base font-semibold">{f.area}</div>
              <div className="mt-1 text-sm text-foreground-subtle">{f.desc}</div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Featured work */}
      <section className="mx-auto max-w-6xl px-6 pb-28">
        <Reveal className="mb-12 flex items-end justify-between gap-6">
          <h2 className="text-headline text-gradient">Selected Work</h2>
          <Link
            href="/portfolio"
            className="group inline-flex shrink-0 items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground"
          >
            All projects
            <ArrowUpRight className="h-4 w-4 transition-transform duration-base group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </Reveal>

        <div className="grid gap-6 md:grid-cols-2">
          {featured.map((id, idx) => {
            const p = projects.find((x) => x.id === id)!
            return (
              <Reveal key={id} delay={(idx % 2) * 0.08}>
                <Link href={`/portfolio/${p.id}`} className="block">
                  <GlassCard className="overflow-hidden rounded-4xl">
                    <div className="aspect-[16/10]">
                      <ProjectPreview project={p} size="lg" />
                    </div>
                    <div className="space-y-3 p-7">
                      <h3 className="text-title">{p.title}</h3>
                      <p className="line-clamp-2 text-sm text-foreground-muted">
                        {p.description}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {p.tags.slice(0, 4).map((t) => (
                          <span
                            key={t}
                            className="rounded-full border border-white/8 px-3 py-1 text-xs text-foreground-subtle"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </GlassCard>
                </Link>
              </Reveal>
            )
          })}
        </div>
      </section>

      {/* Connect */}
      <section className="mx-auto max-w-3xl px-6 pb-32">
        <Reveal>
          <GlassCard className="rounded-5xl px-8 py-16 text-center sm:px-16">
            <h2 className="text-headline text-gradient">Let's build something.</h2>
            <p className="mx-auto mt-4 max-w-md text-foreground-muted">
              Open to AI engineering work and product collaborations. Usually
              replies within a day.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/contact"
                className="focus-ring rounded-full bg-foreground px-7 py-3.5 text-sm font-semibold text-background transition-transform duration-base hover:scale-[1.03]"
              >
                Get in Touch
              </Link>
              <a
                href="https://github.com/zkortam"
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring rounded-full border border-white/10 px-7 py-3.5 text-sm font-semibold transition-all duration-base hover:scale-[1.03] hover:border-white/25"
              >
                GitHub
              </a>
            </div>
          </GlassCard>
        </Reveal>
      </section>
    </main>
  )
}
