import Link from 'next/link'
import { type Project } from '@/lib/projects-data'
import {
  Bot, Users, FileText, BarChart3, Globe2, Network,
  Briefcase, MessageSquare, ScrollText, Cpu, Sparkles, Droplet,
  ArrowUpRight,
} from 'lucide-react'

const iconMap: Record<string, typeof Bot> = {
  'facilis-ai': Bot,
  surf: Users,
  'documap-ai': FileText,
  'incorta-dashboards': BarChart3,
  closingthedivide: Globe2,
  'risk-factors-viz': Network,
  'alex-ai': Briefcase,
  pixal: MessageSquare,
  legiscan: ScrollText,
  'nexus-robot': Cpu,
  'clippy-2': Sparkles,
  'hypersonic-sprinkler': Droplet,
}

export function ProjectIcon({
  id,
  className = 'h-5 w-5',
}: {
  id: string
  className?: string
}) {
  const Icon = iconMap[id] || Bot
  return <Icon className={className} strokeWidth={1.6} />
}

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/portfolio/${project.id}`}
      className="focus-ring group relative flex min-h-[19rem] flex-col overflow-hidden rounded-4xl border border-white/[0.07] bg-white/[0.015] p-9 transition-all duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 hover:border-accent/30 hover:bg-white/[0.03]"
    >
      {/* Accent wash that blooms on hover */}
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/0 blur-[90px] transition-all duration-[700ms] group-hover:bg-accent/25" />

      <div className="relative flex items-start justify-between">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/20 bg-accent/[0.08] text-accent transition-all duration-500 group-hover:scale-105 group-hover:border-accent/40 group-hover:bg-accent/15">
          <ProjectIcon id={project.id} className="h-6 w-6" />
        </div>
        <ArrowUpRight className="h-5 w-5 text-foreground-subtle transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />
      </div>

      <div className="relative mt-auto pt-10">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          {project.category} · {project.year}
        </div>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight">
          {project.title}
        </h3>
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-foreground-muted">
          {project.description}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {project.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-xs text-foreground-subtle"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  )
}
