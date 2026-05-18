import Link from 'next/link'
import Image from 'next/image'
import { type Project } from '@/lib/projects-data'

export function ProjectCard({ project }: { project: Project }) {
  const hasImage =
    !!project.image && !project.image.startsWith('/api/placeholder')

  return (
    <Link
      href={`/portfolio/${project.id}`}
      className="focus-ring group block h-full"
    >
      <div className="relative h-[340px] overflow-hidden rounded-3xl border border-white/[0.06] sm:h-[380px]">
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

        {/* Readability gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />

        {/* Glassmorphic content panel */}
        <div className="absolute inset-x-0 bottom-0 p-4 transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1">
          <div className="rounded-2xl border border-white/[0.12] bg-white/[0.06] p-5 backdrop-blur-xl transition-colors duration-300 group-hover:border-white/20 group-hover:bg-white/[0.09]">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-foreground-subtle">
              <span>{project.category}</span>
              <span className="h-1 w-1 rounded-full bg-foreground-subtle/60" />
              <span>{project.year}</span>
            </div>
            <h3 className="mt-2.5 text-lg font-semibold leading-snug">
              {project.title}
            </h3>
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-foreground-muted">
              {project.description}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}
