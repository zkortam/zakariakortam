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
    <main className="pt-28">
      <Container className="space-y-6 pb-24">
        <Reveal>
          <Hero />
        </Reveal>

        {/* What I work on */}
        <Reveal>
          <section className="glass rounded-5xl px-8 py-12 sm:px-12">
            <h2 className="text-sm font-medium text-foreground-subtle">
              What I work on
            </h2>
            <div className="mt-8 grid gap-x-12 gap-y-8 sm:grid-cols-2">
              {focus.map((f) => (
                <div key={f.area} className="border-t border-white/8 pt-5">
                  <h3 className="text-base font-semibold">{f.area}</h3>
                  <p className="mt-1 text-sm text-foreground-muted">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        {/* Selected work */}
        <section className="pt-16">
          <Reveal className="flex items-end justify-between gap-6 px-2">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Selected work
            </h2>
            <Link
              href="/portfolio"
              className="focus-ring group inline-flex shrink-0 items-center gap-1.5 rounded-full text-sm text-foreground-muted transition-colors hover:text-foreground"
            >
              All projects
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </Reveal>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {featured.map((p, i) => (
              <Reveal key={p.id} delay={(i % 2) * 0.06}>
                <ProjectCard project={p} />
              </Reveal>
            ))}
          </div>
        </section>

        {/* Contact */}
        <Reveal className="pt-10">
          <section className="glass rounded-5xl px-8 py-16 text-center sm:px-12">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Get in touch
            </h2>
            <p className="mx-auto mt-3 max-w-md text-foreground-muted">
              Open to AI engineering work and product collaborations. I usually
              reply within a day.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/contact"
                className="focus-ring rounded-full bg-foreground px-7 py-3.5 text-sm font-medium text-background transition-transform duration-300 hover:scale-[1.03]"
              >
                Contact
              </Link>
              <a
                href="https://github.com/zkortam"
                target="_blank"
                rel="noopener noreferrer"
                className="glass glass-hover focus-ring rounded-full px-7 py-3.5 text-sm font-medium"
              >
                GitHub
              </a>
            </div>
          </section>
        </Reveal>
      </Container>
    </main>
  )
}
