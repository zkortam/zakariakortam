'use client'

import { useRef } from 'react'
import Link from 'next/link'
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { ShaderGradient } from './ShaderGradient'
import { type Project } from '@/lib/projects-data'

const EASE = [0.16, 1, 0.3, 1] as const

export function FeatureRow({
  project,
  index,
  flip = false,
}: {
  project: Project
  index: number
  flip?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const y = useTransform(scrollYProgress, [0, 1], ['6%', '-6%'])

  return (
    <div
      ref={ref}
      className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
    >
      {/* Visual */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-15%' }}
        transition={{ duration: 0.9, ease: EASE }}
        className={flip ? 'lg:order-2' : ''}
      >
        <Link
          href={`/portfolio/${project.id}`}
          className="focus-ring group block"
        >
          <div className="relative aspect-[5/4] overflow-hidden rounded-[2rem] border border-white/[0.08] sm:aspect-[16/10]">
            <motion.div
              style={reduce ? undefined : { y }}
              className="absolute -inset-y-[8%] inset-x-0"
            >
              <ShaderGradient
                seed={(index + 2) * 0.53}
                className="block h-full w-full transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
              />
            </motion.div>

            <span className="pointer-events-none absolute left-8 top-4 font-display text-[7rem] leading-none text-white/[0.14] sm:text-[9rem]">
              {String(index + 1).padStart(2, '0')}
            </span>

            <div className="absolute bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/30 backdrop-blur-md transition-all duration-500 group-hover:border-accent/40 group-hover:bg-accent/20">
              <ArrowUpRight className="h-5 w-5 text-foreground transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </div>
          </div>
        </Link>
      </motion.div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-15%' }}
        transition={{ duration: 0.9, delay: 0.1, ease: EASE }}
        className={flip ? 'lg:order-1' : ''}
      >
        <p className="eyebrow">
          {project.category} · {project.year}
        </p>
        <h3 className="mt-4 text-[clamp(2rem,3.6vw,3.25rem)] font-semibold leading-[1.02] tracking-tight">
          {project.title}
        </h3>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-foreground-muted">
          {project.description}
        </p>
        {project.tags && project.tags.length > 0 && (
          <div className="mt-7 flex flex-wrap gap-2">
            {project.tags.slice(0, 5).map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-foreground-muted"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        <Link
          href={`/portfolio/${project.id}`}
          className="focus-ring group mt-9 inline-flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-accent"
        >
          View project
          <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </motion.div>
    </div>
  )
}
