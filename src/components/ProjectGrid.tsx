'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ProjectCard } from './ProjectCard'
import { type Project } from '@/lib/projects-data'

const EASE = [0.16, 1, 0.3, 1] as const

export function ProjectGrid({ projects }: { projects: Project[] }) {
  // Only show categories that actually exist in the set.
  const categories = [
    'All',
    ...Array.from(new Set(projects.map((p) => p.category))),
  ]
  const [active, setActive] = useState('All')
  const shown =
    active === 'All' ? projects : projects.filter((p) => p.category === active)

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setActive(c)}
            className={`focus-ring relative rounded-full px-4 py-2 text-sm font-medium transition-colors duration-300 ${
              active === c
                ? 'text-white'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            {active === c && (
              <motion.span
                layoutId="filter-pill"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                className="absolute inset-0 -z-10 rounded-full border border-accent/40 bg-accent/[0.18]"
              />
            )}
            {c}
          </button>
        ))}
      </div>

      <motion.div
        layout
        className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        <AnimatePresence mode="popLayout">
          {shown.map((p) => (
            <motion.div
              key={p.id}
              layout
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <ProjectCard project={p} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
