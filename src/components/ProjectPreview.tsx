import { type Project } from '@/lib/projects-data'
import {
  Bot, Users, FileText, BarChart3, Globe2, Network,
  Briefcase, MessageSquare, ScrollText, Cpu, Sparkles, Droplet,
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

const iconSize = { sm: 'h-7 w-7', md: 'h-9 w-9', lg: 'h-12 w-12' }

export function ProjectPreview({
  project,
  size = 'md',
}: {
  project: Project
  size?: 'sm' | 'md' | 'lg'
}) {
  const Icon = iconMap[project.id] || Bot

  return (
    <div className="relative h-full w-full overflow-hidden bg-surface-elevated">
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      />
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/15 blur-3xl" />
      <div className="relative flex h-full w-full flex-col items-start justify-between p-6">
        <Icon
          className={`${iconSize[size]} text-foreground/80`}
          strokeWidth={1.4}
        />
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-accent/80">
            {project.category}
          </div>
          <div className="text-title text-foreground">{project.title}</div>
        </div>
      </div>
    </div>
  )
}
