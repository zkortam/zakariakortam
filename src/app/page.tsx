import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Container } from '@/components/Container'
import { Hero } from '@/components/Hero'
import { ProjectCard } from '@/components/ProjectCard'
import { Reveal } from '@/components/Reveal'
import { projects } from '@/lib/projects-data'

const focus = [
  { area: 'Agentic AI', desc: 'Model Context Protocol and tool-using agents' },
  { area: 'Product Engineering', desc: 'React, TypeScript, Node.js' },
  { area: 'Applied ML', desc: 'LLMs, vector search, computer vision' },
  { area: 'Cross-Platform', desc: 'Flutter and Dart for iOS, Android, web' },
]

const featuredIds = ['facilis-ai', 'surf', 'documap-ai', 'incorta-dashboards']

export default function HomePage() {
  const featured = featuredIds.map((id) => projects.find((p) => p.id === id)!)

  return (
    <main className="pt-16">
      <Container>
        <Hero />

        {/* What I work on */}
        <section className="border-b border-white/8 py-20">
          <Reveal>
            <h2 className="text-sm font-medium text-foreground-subtle">
              What I work on
            </h2>
          </Reveal>
          <div className="mt-8 grid gap-x-12 gap-y-8 sm:grid-cols-2">
            {focus.map((f, i) => (
              <Reveal
                key={f.area}
                delay={i * 0.05}
                className="border-t border-white/8 pt-5"
              >
                <h3 className="text-base font-semibold">{f.area}</h3>
                <p className="mt-1 text-sm text-foreground-muted">{f.desc}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Selected work */}
        <section className="border-b border-white/8 py-20">
          <Reveal className="flex items-end justify-between gap-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Selected work
            </h2>
            <Link
              href="/portfolio"
              className="focus-ring group inline-flex shrink-0 items-center gap-1.5 rounded text-sm text-foreground-muted transition-colors hover:text-foreground"
            >
              All projects
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {featured.map((p, i) => (
              <Reveal key={p.id} delay={(i % 2) * 0.06}>
                <ProjectCard project={p} />
              </Reveal>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="py-24">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Get in touch
            </h2>
            <p className="mt-3 max-w-md text-foreground-muted">
              Open to AI engineering work and product collaborations. I usually
              reply within a day.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="focus-ring rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                Contact
              </Link>
              <a
                href="https://github.com/zkortam"
                target="_blank"
                rel="noopener noreferrer"
                className="card card-hover focus-ring rounded-full px-6 py-3 text-sm font-medium"
              >
                GitHub
              </a>
            </div>
          </Reveal>
        </section>
      </Container>
    </main>
  )
}
