'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { projects, categories } from '@/lib/projects-data'
import { ProjectPreview } from '@/components/ProjectPreview'
import { GlassCard } from '@/components/GlassCard'
import { Reveal } from '@/components/Reveal'

const EASE = [0.22, 1, 0.36, 1] as const

export default function PortfolioPage() {
  const [active, setActive] = useState<string>('All')

  const filtered =
    active === 'All' ? projects : projects.filter((p) => p.category === active)

  return (
    <main className="mx-auto max-w-6xl px-6 pb-32 pt-40">
      <Reveal>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent/80">
          Work
        </p>
        <h1 className="mt-5 text-display text-gradient">Selected projects.</h1>
        <p className="mt-7 max-w-xl text-balance text-lg text-foreground-muted">
          Shipped products, research, and the systems behind them.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mt-12 flex flex-wrap gap-2">
        {categories.map((c) => {
          const on = active === c
          return (
            <button
              key={c}
              onClick={() => setActive(c)}
              className="focus-ring relative rounded-full px-4 py-2 text-sm font-medium transition-colors duration-base"
            >
              <span
                className={`relative z-10 ${
                  on ? 'text-background' : 'text-foreground-muted hover:text-foreground'
                }`}
              >
                {c}
              </span>
              {on && (
                <motion.span
                  layoutId="filter-pill"
                  className="absolute inset-0 rounded-full bg-foreground"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              {!on && (
                <span className="absolute inset-0 rounded-full border border-white/8" />
              )}
            </button>
          )
        })}
      </Reveal>

      <motion.div layout className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((p, i) => (
            <motion.div
              key={p.id}
              layout
              initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.97, filter: 'blur(6px)' }}
              transition={{ duration: 0.55, delay: (i % 3) * 0.05, ease: EASE }}
            >
              <Link href={`/portfolio/${p.id}`} className="block h-full">
                <GlassCard className="flex h-full flex-col overflow-hidden rounded-4xl">
                  <div className="aspect-[16/10]">
                    <ProjectPreview project={p} size="md" />
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-6">
                    <h3 className="text-title">{p.title}</h3>
                    <p className="line-clamp-2 flex-1 text-sm text-foreground-muted">
                      {p.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {p.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-white/8 px-2.5 py-0.5 text-xs text-foreground-subtle"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </GlassCard>
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </main>
  )
}
