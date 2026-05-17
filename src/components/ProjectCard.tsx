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
      className="glass glass-hover focus-ring group flex flex-col rounded-4xl p-7"
    >
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.05] text-foreground-muted">
          <ProjectIcon id={project.id} />
        </div>
        <ArrowUpRight className="h-4 w-4 text-foreground-subtle transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>

      <div className="mt-6 text-xs font-medium uppercase tracking-wider text-foreground-subtle">
        {project.category} · {project.year}
      </div>
      <h3 className="mt-2 text-lg font-semibold tracking-tight">
        {project.title}
      </h3>
      <p className="mt-2.5 line-clamp-2 flex-1 text-sm leading-relaxed text-foreground-muted">
        {project.description}
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {project.tags.slice(0, 4).map((t) => (
          <span
            key={t}
            className="rounded-full bg-white/5 px-3 py-1 text-xs text-foreground-subtle"
          >
            {t}
          </span>
        ))}
      </div>
    </Link>
  )
}
