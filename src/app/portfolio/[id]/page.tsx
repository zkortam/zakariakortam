'use client'

import { notFound } from 'next/navigation'
import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import { projects } from '@/lib/projects-data'
import { ProjectIcon } from '@/components/ProjectCard'
import { Section } from '@/components/Section'
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
    <main>
      {/* Hero header — full-bleed */}
      <Section className="relative overflow-hidden pt-36 pb-20 sm:pt-44 sm:pb-24">
        <div className="pointer-events-none absolute -right-32 top-0 h-[460px] w-[460px] rounded-full bg-accent/15 blur-[140px]" />
        <div className="relative">
          <Reveal>
            <Link
              href="/portfolio"
              className="focus-ring group inline-flex items-center gap-2 text-sm text-foreground-muted transition-colors hover:text-accent"
            >
              <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
              All work
            </Link>
          </Reveal>

          <Reveal delay={0.06} className="mt-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-accent/20 bg-accent/[0.08] text-accent">
              <ProjectIcon id={project.id} className="h-7 w-7" />
            </div>
            <p className="mt-8 eyebrow">
              {project.category} · {project.year}
            </p>
            <h1 className="mt-4 max-w-4xl text-display text-balance text-gradient">
              {project.title}
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-foreground-muted text-pretty sm:text-xl">
              {project.description}
            </p>

            <dl className="mt-12 grid grid-cols-2 gap-x-8 gap-y-8 border-t border-white/[0.08] pt-10 sm:grid-cols-4">
              {meta.map(([k, v]) => (
                <div key={k}>
                  <dt className="eyebrow">{k}</dt>
                  <dd className="mt-2 text-sm font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </Section>

      {/* Body */}
      <Section divider band className="py-20 sm:py-28">
        <div className="grid gap-16 lg:grid-cols-[1.5fr_0.5fr]">
          <Reveal className="space-y-14">
            {sections.map(([title, body]) => (
              <div key={title}>
                <h2 className="eyebrow">{title}</h2>
                <p className="mt-5 text-lg leading-relaxed text-foreground-muted text-pretty">
                  {body}
                </p>
              </div>
            ))}

            {project.impact && project.impact.length > 0 && (
              <div>
                <h2 className="eyebrow">Impact</h2>
                <ul className="mt-5 space-y-3">
                  {project.impact.map((it) => (
                    <li
                      key={it}
                      className="flex gap-3 leading-relaxed text-foreground-muted"
                    >
                      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Reveal>

          <Reveal delay={0.08} className="space-y-10 lg:sticky lg:top-28 lg:self-start">
            <div>
              <h2 className="eyebrow">Technologies</h2>
              <div className="mt-5 flex flex-wrap gap-2">
                {project.technologies.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-xs text-foreground-muted"
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
                className="btn-primary focus-ring group"
              >
                Visit live
                <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            )}
          </Reveal>
        </div>
      </Section>

      {/* Prev / Next */}
      <Section divider className="py-16 sm:py-20">
        <div className="grid gap-5 sm:grid-cols-2">
          {prev ? (
            <Link
              href={`/portfolio/${prev.id}`}
              className="focus-ring group rounded-4xl border border-white/[0.07] bg-white/[0.015] p-8 transition-all duration-500 hover:-translate-y-1 hover:border-accent/30"
            >
              <div className="eyebrow flex items-center gap-2">
                <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-1" />
                Previous
              </div>
              <div className="mt-3 text-lg font-semibold">{prev.title}</div>
            </Link>
          ) : (
            <div className="hidden sm:block" />
          )}
          {next && (
            <Link
              href={`/portfolio/${next.id}`}
              className="focus-ring group rounded-4xl border border-white/[0.07] bg-white/[0.015] p-8 transition-all duration-500 hover:-translate-y-1 hover:border-accent/30 sm:text-right"
            >
              <div className="eyebrow flex items-center gap-2 sm:justify-end">
                Next
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
              </div>
              <div className="mt-3 text-lg font-semibold">{next.title}</div>
            </Link>
          )}
        </div>
      </Section>
    </main>
  )
}
