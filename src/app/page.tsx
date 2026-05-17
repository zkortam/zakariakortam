import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Hero } from '@/components/Hero'
import { Section } from '@/components/Section'
import { ProjectCard } from '@/components/ProjectCard'
import { Reveal } from '@/components/Reveal'
import { projects } from '@/lib/projects-data'

const focus = [
  {
    area: 'Agentic AI',
    desc: 'Model Context Protocol, tool-using agents, and orchestration for enterprise systems.',
  },
  {
    area: 'Product Engineering',
    desc: 'React, TypeScript, and Node.js — shipping interfaces people actually use.',
  },
  {
    area: 'Applied ML',
    desc: 'LLMs, vector search, and computer vision wired into real products.',
  },
  {
    area: 'Cross-Platform',
    desc: 'Flutter and Dart for native iOS, Android, and the web from one codebase.',
  },
]

const featuredIds = ['facilis-ai', 'surf', 'documap-ai', 'incorta-dashboards']

export default function HomePage() {
  const featured = featuredIds.map((id) => projects.find((p) => p.id === id)!)

  return (
    <main>
      <Hero />

      {/* What I work on — editorial, numbered, asymmetric */}
      <Section divider className="py-24 sm:py-32">
        <Reveal>
          <div className="grid gap-x-16 gap-y-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="eyebrow">What I work on</p>
              <h2 className="mt-4 text-headline text-gradient">
                Systems that
                <br />
                think and ship.
              </h2>
            </div>

            <div className="grid gap-px overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.04] sm:grid-cols-2">
              {focus.map((f, i) => (
                <div
                  key={f.area}
                  className="group bg-black p-8 transition-colors duration-500 hover:bg-white/[0.02]"
                >
                  <div className="text-sm font-semibold text-accent">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{f.area}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </Section>

      {/* Selected work — full-bleed band, large cards */}
      <Section divider band className="py-24 sm:py-32">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Portfolio</p>
            <h2 className="mt-4 text-headline text-gradient">Selected work</h2>
          </div>
          <Link
            href="/portfolio"
            className="focus-ring group inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-5 py-2.5 text-sm text-foreground-muted transition-all duration-300 hover:border-accent/30 hover:text-accent"
          >
            All projects
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {featured.map((p, i) => (
            <Reveal key={p.id} delay={(i % 2) * 0.08}>
              <ProjectCard project={p} />
            </Reveal>
          ))}
        </div>
      </Section>

      {/* CTA — full-bleed, centered, glow */}
      <Section divider className="relative overflow-hidden py-32 sm:py-40">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-[140px]" />
        <Reveal className="relative text-center">
          <p className="eyebrow">Get in touch</p>
          <h2 className="mx-auto mt-5 max-w-3xl text-display text-balance">
            <span className="text-gradient">Let&apos;s build </span>
            <span className="text-accent">something.</span>
          </h2>
          <p className="mx-auto mt-7 max-w-md text-lg text-foreground-muted">
            Open to AI engineering work and product collaborations. I usually
            reply within a day.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/contact" className="btn-primary focus-ring">
              Contact
            </Link>
            <a
              href="https://github.com/zkortam"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary focus-ring"
            >
              GitHub
            </a>
          </div>
        </Reveal>
      </Section>
    </main>
  )
}
