import Link from 'next/link'
import { type Project } from '@/lib/projects-data'
import { ArrowUpRight } from 'lucide-react'

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/portfolio/${project.id}`}
      className="focus-ring group flex h-full flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-white/[0.12] hover:bg-white/[0.04]"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="text-xs font-medium uppercase tracking-[0.1em] text-foreground-subtle">
          {project.category} · {project.year}
        </span>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-foreground-subtle transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>

      <h3 className="mt-6 text-xl font-semibold tracking-tight sm:text-2xl">
        {project.title}
      </h3>
      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-foreground-muted">
        {project.description}
      </p>

      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-8 text-xs text-foreground-subtle">
        {project.tags.slice(0, 4).map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </Link>
  )
}
