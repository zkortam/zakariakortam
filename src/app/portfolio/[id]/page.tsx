'use client'

import { notFound } from 'next/navigation'
import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import { projects } from '@/lib/projects-data'
import { ProjectIcon } from '@/components/ProjectCard'
import { Container } from '@/components/Container'
import { Reveal } from '@/components/Reveal'

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const project = projects.find((p) => p.id === id)
  if (!project) notFound()

  const idx = projects.findIndex((p) => p.id === id)
  const prev = idx > 0 ? projects[idx - 1] : null
  const next = idx < projects.length - 1 ? projects[idx + 1] : null

  const meta = [
    ['Role', project.role],
    ['Timeline', project.timeline],
    ['Team', project.team],
    ['Year', project.year],
  ].filter(([, v]) => v) as [string, string][]

  const sections = [
    ['Overview', project.overview],
    ['Challenge', project.challenge],
    ['Solution', project.solution],
  ].filter(([, v]) => v) as [string, string][]

  return (
    <main className="pt-28">
      <Container className="space-y-6 pb-24">
        <Reveal className="px-2">
          <Link
            href="/portfolio"
            className="focus-ring group inline-flex items-center gap-2 rounded-full text-sm text-foreground-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
            Work
          </Link>
        </Reveal>

        <Reveal>
          <header className="glass rounded-5xl px-8 py-12 sm:px-14">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] text-foreground-muted">
              <ProjectIcon id={project.id} className="h-5 w-5" />
            </div>
            <div className="mt-7 text-xs font-medium uppercase tracking-wider text-foreground-subtle">
              {project.category} · {project.year}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-gradient sm:text-5xl">
              {project.title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-foreground-muted text-pretty">
              {project.description}
            </p>

            <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-white/8 pt-8 sm:grid-cols-4">
              {meta.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs uppercase tracking-wider text-foreground-subtle">
                    {k}
                  </dt>
                  <dd className="mt-1.5 text-sm font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </header>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <Reveal>
            <div className="glass space-y-12 rounded-4xl px-8 py-10 sm:px-12">
              {sections.map(([title, body]) => (
                <div key={title}>
                  <h2 className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
                    {title}
                  </h2>
                  <p className="mt-4 leading-relaxed text-foreground-muted text-pretty">
                    {body}
                  </p>
                </div>
              ))}

              {project.impact && project.impact.length > 0 && (
                <div>
                  <h2 className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
                    Impact
                  </h2>
                  <ul className="mt-4 space-y-2.5">
                    {project.impact.map((it) => (
                      <li key={it} className="flex gap-3 text-foreground-muted">
                        <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-foreground-subtle" />
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <aside className="glass space-y-8 rounded-4xl px-7 py-8">
              <div>
                <h2 className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
                  Technologies
                </h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {project.technologies.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-white/5 px-3 py-1 text-xs text-foreground-muted"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {project.links?.live && (
                <a
                  href={project.links.live}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring group inline-flex items-center gap-1.5 rounded-full text-sm font-medium transition-colors hover:text-foreground-muted"
                >
                  Visit live
                  <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              )}
            </aside>
          </Reveal>
        </div>

        <div className="grid gap-5 pt-4 sm:grid-cols-2">
          {prev ? (
            <Link
              href={`/portfolio/${prev.id}`}
              className="glass glass-hover focus-ring rounded-4xl p-7"
            >
              <div className="text-xs uppercase tracking-wider text-foreground-subtle">
                Previous
              </div>
              <div className="mt-2 font-medium">{prev.title}</div>
            </Link>
          ) : (
            <div className="hidden sm:block" />
          )}
          {next && (
            <Link
              href={`/portfolio/${next.id}`}
              className="glass glass-hover focus-ring rounded-4xl p-7 sm:text-right"
            >
              <div className="text-xs uppercase tracking-wider text-foreground-subtle">
                Next
              </div>
              <div className="mt-2 font-medium">{next.title}</div>
            </Link>
          )}
        </div>
      </Container>
    </main>
  )
}
