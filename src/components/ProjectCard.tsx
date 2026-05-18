import Link from 'next/link'
import Image from 'next/image'
import { type Project, isWorkProject } from '@/lib/projects-data'

export function ProjectCard({ project }: { project: Project }) {
  const hasImage =
    !!project.image && !project.image.startsWith('/api/placeholder')
  const kicker =
    isWorkProject(project) && project.role ? project.role : project.category

  return (
    <Link
      href={`/portfolio/${project.id}`}
      className="focus-ring group block h-full"
    >
      <div className="relative h-[360px] overflow-hidden rounded-3xl sm:h-[420px]">
        {/* Brand-tinted color tile (sits behind, peeks as a frame) */}
        {hasImage ? (
          <Image
            src={project.image}
            alt={project.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/50 via-neutral-900 to-neutral-950 transition-transform duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105" />
        )}

        {/* Glass panel — fills most of the card, color framing the edges */}
        <div className="absolute inset-3 flex flex-col justify-end rounded-[1.25rem] border border-white/[0.08] bg-black/25 p-7 backdrop-blur-2xl transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:border-white/15 group-hover:bg-black/15 sm:inset-4 sm:p-9">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm font-medium uppercase tracking-[0.12em] text-foreground-subtle">
            <span>{kicker}</span>
            <span className="h-1 w-1 rounded-full bg-foreground-subtle/60" />
            <span>{project.year}</span>
          </div>
          <h3 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">
            {project.title}
          </h3>
          <p className="mt-3 line-clamp-2 text-base leading-relaxed text-foreground-muted sm:text-lg">
            {project.description}
          </p>
        </div>
      </div>
    </Link>
  )
}
