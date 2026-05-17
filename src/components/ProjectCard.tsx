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
      className="card card-hover focus-ring group flex flex-col rounded-2xl p-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-foreground-muted">
          <ProjectIcon id={project.id} />
        </div>
        <ArrowUpRight className="h-4 w-4 text-foreground-subtle transition-colors duration-200 group-hover:text-foreground" />
      </div>

      <div className="mt-5 text-xs font-medium uppercase tracking-wider text-foreground-subtle">
        {project.category} · {project.year}
      </div>
      <h3 className="mt-2 text-base font-semibold tracking-tight">
        {project.title}
      </h3>
      <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-foreground-muted">
        {project.description}
      </p>

      <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground-subtle">
        {project.tags.slice(0, 4).map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </Link>
  )
}
