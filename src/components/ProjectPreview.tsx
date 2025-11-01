import { Project } from '@/lib/projects-data'
import { 
  Bot, 
  Users, 
  FileText, 
  BarChart, 
  Globe, 
  Network, 
  Briefcase, 
  MessageSquare, 
  ScrollText, 
  Cpu, 
  HelpCircle, 
  Droplet 
} from 'lucide-react'

interface ProjectPreviewProps {
  project: Project
  size?: 'sm' | 'md' | 'lg'
}

const projectIconMap: Record<string, typeof Bot> = {
  'facilis-ai': Bot,
  'surf': Users,
  'documap-ai': FileText,
  'incorta-dashboards': BarChart,
  'closingthedivide': Globe,
  'risk-factors-viz': Network,
  'alex-ai': Briefcase,
  'pixal': MessageSquare,
  'legiscan': ScrollText,
  'nexus-robot': Cpu,
  'clippy-2': HelpCircle,
  'hypersonic-sprinkler': Droplet,
}

const categoryGradients = {
  'AI/ML': 'from-purple-500/20 via-blue-500/20 to-cyan-500/20',
  'Product Engineering': 'from-emerald-500/20 via-teal-500/20 to-cyan-500/20',
  'Research/Academic': 'from-orange-500/20 via-amber-500/20 to-yellow-500/20',
  'Tools': 'from-indigo-500/20 via-purple-500/20 to-pink-500/20',
}

export function ProjectPreview({ project, size = 'md' }: ProjectPreviewProps) {
  const Icon = projectIconMap[project.id] || Bot
  const gradient = categoryGradients[project.category]
  
  // Get initials or short title
  const getTitleDisplay = () => {
    // Special case for ClosingTheDivide
    if (project.id === 'closingthedivide') {
      return 'CTD'
    }
    
    const words = project.title.split(' ')
    if (words.length > 1 && words[0].length <= 8) {
      return words[0]
    }
    return project.title.slice(0, 12)
  }

  const sizeClasses = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
  }

  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  }

  const lineHeights = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-14',
  }

  return (
    <div className={`relative w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center overflow-hidden`}>
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }} />
      </div>
      
      {/* Content */}
      <div className="relative z-10 flex flex-row items-center justify-center gap-3 p-4">
        <Icon className={`${iconSizes[size]} text-white drop-shadow-lg`} strokeWidth={1.5} />
        <div className={`${lineHeights[size]} w-px bg-white/50`} />
        <div className={`${sizeClasses[size]} font-medium text-white text-center drop-shadow-lg`}>
          {getTitleDisplay()}
        </div>
      </div>
    </div>
  )
}

