'use client'

import { notFound } from 'next/navigation'
import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import { projects } from '@/lib/projects-data'
import { ProjectPreview } from '@/components/ProjectPreview'
import { GlassCard } from '@/components/GlassCard'
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

  const sections = [
    ['Overview', project.overview],
    ['Challenge', project.challenge],
    ['Solution', project.solution],
  ].filter(([, v]) => v) as [string, string][]

  return (
    <main className="mx-auto max-w-5xl px-6 pb-32 pt-36">
      <Reveal>
        <Link
          href="/portfolio"
          className="group inline-flex items-center gap-2 text-sm text-foreground-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-base group-hover:-translate-x-1" />
          Back to Work
        </Link>
      </Reveal>

      <Reveal delay={0.05} className="mt-10">
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full bg-accent/15 px-3 py-1 font-medium text-accent">
            {project.category}
          </span>
          <span className="text-foreground-subtle">{project.year}</span>
        </div>
        <h1 className="mt-6 text-display text-gradient">{project.title}</h1>
        <p className="mt-6 max-w-2xl text-balance text-lg text-foreground-muted">
          {project.description}
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mt-10 overflow-hidden rounded-5xl glass">
        <div className="aspect-[2/1]">
          <ProjectPreview project={project} size="lg" />
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-3xl glass md:grid-cols-4">
          {[
            ['Role', project.role],
            ['Timeline', project.timeline],
            ['Team', project.team],
            ['Year', project.year],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="bg-white/[0.015] p-6">
                <div className="text-xs uppercase tracking-[0.15em] text-foreground-subtle">
                  {k}
                </div>
                <div className="mt-2 text-sm font-medium">{v}</div>
              </div>
            ))}
        </div>
      </Reveal>

      <div className="mt-20 grid gap-14 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-14">
          {sections.map(([title, body]) => (
            <Reveal key={title} className="space-y-4">
              <h2 className="text-title text-foreground">{title}</h2>
              <p className="leading-relaxed text-foreground-muted text-pretty">
                {body}
              </p>
            </Reveal>
          ))}

          {project.impact && project.impact.length > 0 && (
            <Reveal className="space-y-4">
              <h2 className="text-title text-foreground">Impact</h2>
              <div className="space-y-3">
                {project.impact.map((it) => (
                  <div key={it} className="flex gap-3 text-foreground-muted">
                    <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                    {it}
                  </div>
                ))}
              </div>
            </Reveal>
          )}
        </div>

        <div className="space-y-5">
          <Reveal>
            <GlassCard className="rounded-3xl p-7">
              <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-foreground-subtle">
                Technologies
              </h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {project.technologies.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-white/8 px-3 py-1 text-xs text-foreground-muted"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </GlassCard>
          </Reveal>

          {project.links?.live && (
            <Reveal delay={0.05}>
              <a
                href={project.links.live}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <GlassCard className="flex items-center justify-between rounded-3xl p-7">
                  <span className="text-sm font-semibold">Visit live</span>
                  <ArrowUpRight className="h-5 w-5 text-foreground-muted transition-transform duration-base group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </GlassCard>
              </a>
            </Reveal>
          )}
        </div>
      </div>

      <div className="mt-28 grid gap-4 border-t border-white/8 pt-12 sm:grid-cols-2">
        {prev && (
          <Link href={`/portfolio/${prev.id}`}>
            <GlassCard className="group h-full rounded-3xl p-7">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-foreground-subtle">
                <ArrowLeft className="h-4 w-4 transition-transform duration-base group-hover:-translate-x-1" />
                Previous
              </div>
              <div className="mt-3 text-title">{prev.title}</div>
            </GlassCard>
          </Link>
        )}
        {next && (
          <Link href={`/portfolio/${next.id}`} className="sm:text-right">
            <GlassCard className="group h-full rounded-3xl p-7">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-foreground-subtle sm:justify-end">
                Next
                <ArrowRight className="h-4 w-4 transition-transform duration-base group-hover:translate-x-1" />
              </div>
              <div className="mt-3 text-title">{next.title}</div>
            </GlassCard>
          </Link>
        )}
      </div>
    </main>
  )
}
