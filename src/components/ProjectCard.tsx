'use client'

import { useMemo, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { ShaderGradient } from './ShaderGradient'
import { type Project, isWorkProject } from '@/lib/projects-data'

export function ProjectCard({ project }: { project: Project }) {
  const ref = useRef<HTMLDivElement>(null)
  const seed = useMemo(() => {
    let s = 0
    for (const c of project.id) s += c.charCodeAt(0)
    return (s % 53) / 7 + 0.3
  }, [project.id])
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  // The tile drifts inside the clipped card as it passes — quiet depth.
  const tileY = useTransform(scrollYProgress, [0, 1], ['-8%', '8%'])

  const hasImage =
    !!project.image && !project.image.startsWith('/api/placeholder')
  const kicker =
    isWorkProject(project) && project.role ? project.role : project.category

  return (
    <Link
      href={`/portfolio/${project.id}`}
      className="focus-ring group block h-full"
    >
      <motion.div
        ref={ref}
        whileHover={{ y: -6 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="relative h-[360px] overflow-hidden rounded-3xl sm:h-[420px]"
      >
        {/* Brand-tinted tile, oversized so parallax never reveals an edge */}
        <motion.div
          style={reduce ? undefined : { y: tileY }}
          className="absolute -inset-y-[10%] inset-x-0"
        >
          {hasImage ? (
            <Image
              src={project.image}
              alt={project.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]"
            />
          ) : (
            <div className="absolute inset-0 transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]">
              <ShaderGradient
                seed={seed}
                animate={false}
                className="block h-full w-full"
              />
            </div>
          )}
        </motion.div>

        {/* Warm wash on hover — subtle, never glowing */}
        <div className="absolute inset-0 bg-gradient-to-t from-accent/0 to-accent/0 opacity-0 transition-opacity duration-500 group-hover:from-accent/[0.08] group-hover:opacity-100" />

        {/* Glass panel — fills most of the card, color framing the edges */}
        <div className="absolute inset-3 flex flex-col justify-end rounded-[1.25rem] border border-white/[0.08] bg-black/25 p-7 backdrop-blur-2xl transition-all duration-[500ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:border-accent/25 group-hover:bg-black/15 sm:inset-4 sm:p-9">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium uppercase tracking-[0.14em] text-foreground-subtle">
              <span>{kicker}</span>
              <span className="h-1 w-1 rounded-full bg-foreground-subtle/60" />
              <span>{project.year}</span>
            </div>
            <ArrowUpRight className="h-5 w-5 shrink-0 -translate-y-1 translate-x-1 text-foreground-subtle opacity-0 transition-all duration-500 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:text-accent group-hover:opacity-100" />
          </div>
          <h3 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">
            {project.title}
          </h3>
          <p className="mt-3 line-clamp-2 text-base leading-relaxed text-foreground-muted sm:text-lg">
            {project.description}
          </p>
        </div>
      </motion.div>
    </Link>
  )
}
