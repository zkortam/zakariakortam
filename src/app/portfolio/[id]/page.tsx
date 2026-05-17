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
    <main className="pt-16">
      <Container>
        <div className="py-12">
          <Link
            href="/portfolio"
            className="focus-ring group inline-flex items-center gap-2 rounded text-sm text-foreground-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
            Work
          </Link>
        </div>

        <header className="border-b border-white/8 pb-14">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.04] text-foreground-muted">
            <ProjectIcon id={project.id} className="h-5 w-5" />
          </div>
          <div className="mt-6 text-xs font-medium uppercase tracking-wider text-foreground-subtle">
            {project.category} · {project.year}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {project.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-foreground-muted text-pretty">
            {project.description}
          </p>

          <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
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

        <div className="grid gap-16 py-14 lg:grid-cols-[1fr_280px]">
          <div className="space-y-12">
            {sections.map(([title, body]) => (
              <Reveal key={title}>
                <h2 className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
                  {title}
                </h2>
                <p className="mt-4 leading-relaxed text-foreground-muted text-pretty">
                  {body}
                </p>
              </Reveal>
            ))}

            {project.impact && project.impact.length > 0 && (
              <Reveal>
                <h2 className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
                  Impact
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {project.impact.map((it) => (
                    <li
                      key={it}
                      className="flex gap-3 text-foreground-muted"
                    >
                      <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-foreground-subtle" />
                      {it}
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}
          </div>

          <aside className="space-y-8 lg:border-l lg:border-white/8 lg:pl-8">
            <div>
              <h2 className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
                Technologies
              </h2>
              <ul className="mt-4 space-y-2 text-sm text-foreground-muted">
                {project.technologies.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>

            {project.links?.live && (
              <a
                href={project.links.live}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring group inline-flex items-center gap-1.5 rounded text-sm font-medium transition-colors hover:text-foreground-muted"
              >
                Visit live
                <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            )}
          </aside>
        </div>

        <nav className="grid gap-px overflow-hidden rounded-2xl border border-white/8 sm:grid-cols-2">
          {prev ? (
            <Link
              href={`/portfolio/${prev.id}`}
              className="card-hover bg-white/[0.02] p-6 transition-colors"
            >
              <div className="text-xs uppercase tracking-wider text-foreground-subtle">
                Previous
              </div>
              <div className="mt-2 font-medium">{prev.title}</div>
            </Link>
          ) : (
            <div />
          )}
          {next && (
            <Link
              href={`/portfolio/${next.id}`}
              className="card-hover bg-white/[0.02] p-6 text-right transition-colors"
            >
              <div className="text-xs uppercase tracking-wider text-foreground-subtle">
                Next
              </div>
              <div className="mt-2 font-medium">{next.title}</div>
            </Link>
          )}
        </nav>

        <div className="h-20" />
      </Container>
    </main>
  )
}
