'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { projects, categories } from '@/lib/projects-data'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function PortfolioPage() {
  const [selectedCategory, setSelectedCategory] = useState('All')
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const filteredProjects = selectedCategory === 'All'
    ? projects
    : projects.filter(project => project.category === selectedCategory)

  const featuredProjects = projects.filter(p => p.featured)

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 400
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
    }
  }

  return (
    <main className="min-h-screen pt-16">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="space-y-12">
          {/* Header */}
          <section className="space-y-4">
            <h1 className="text-display">Portfolio</h1>
            <p className="text-lg text-foreground-muted max-w-2xl">
              Selected projects showcasing systems thinking, technical depth, and shipped impact.
            </p>
          </section>

          {/* Featured Projects Carousel */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-headline">Featured Work</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => scroll('left')}
                  className="p-2 glass rounded-card hover:glass-elevated transition-all focus-ring"
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => scroll('right')}
                  className="p-2 glass rounded-card hover:glass-elevated transition-all focus-ring"
                  aria-label="Scroll right"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div
              ref={scrollContainerRef}
              className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-4"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {featuredProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/portfolio/${project.id}`}
                  className="group glass-elevated rounded-card-lg p-5 hover:scale-[1.02] transition-all duration-normal flex-shrink-0 w-[340px] snap-start"
                >
                  <div className="space-y-3">
                    <div className="aspect-video bg-surface rounded-card overflow-hidden">
                      <div className="w-full h-full bg-gradient-subtle flex items-center justify-center">
                        <div className="text-foreground-subtle text-sm">Preview</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-medium group-hover:text-accent-blue transition-colors line-clamp-1">
                          {project.title}
                        </h3>
                        <span className="text-xs px-2 py-0.5 bg-surface rounded text-accent-blue flex-shrink-0">
                          {project.category}
                        </span>
                      </div>
                      <p className="text-sm text-foreground-muted line-clamp-2">
                        {project.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {project.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="text-xs px-2 py-0.5 bg-surface-elevated rounded text-foreground-subtle"
                          >
                            {tag}
                          </span>
                        ))}
                        {project.tags.length > 3 && (
                          <span className="text-xs text-foreground-subtle">
                            +{project.tags.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Filters - Moved below featured */}
          <section className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const isActive = selectedCategory === category
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`relative px-3 py-1.5 text-sm rounded-card transition-all duration-normal focus-ring ${
                    isActive
                      ? 'bg-foreground text-background'
                      : 'glass hover:glass-elevated'
                  }`}
                >
                  {category}
                  {isActive && (
                    <motion.div
                      layoutId="activeFilter"
                      className="absolute inset-0 bg-foreground rounded-card -z-10"
                      initial={false}
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>
              )
            })}
          </section>

          {/* All Projects */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-headline">
                {selectedCategory === 'All' ? 'All Projects' : selectedCategory + ' Projects'}
              </h2>
              <span className="text-sm text-foreground-muted">
                {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
              </span>
            </div>
            <motion.div
              layout
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            >
              <AnimatePresence mode="popLayout">
                {filteredProjects.map((project) => (
                <motion.div
                  key={project.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3 }}
                >
                  <Link
                    href={`/portfolio/${project.id}`}
                    className="group glass rounded-card-lg p-4 hover:glass-elevated hover:scale-[1.02] transition-all duration-normal block h-full"
                  >
                    <div className="space-y-3">
                      <div className="aspect-video bg-surface rounded-card overflow-hidden">
                        <div className="w-full h-full bg-gradient-subtle flex items-center justify-center">
                          <div className="text-foreground-subtle text-xs">Preview</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-medium group-hover:text-accent-blue transition-colors line-clamp-1">
                            {project.title}
                          </h3>
                          <span className="text-xs text-accent-blue flex-shrink-0">
                            {project.category}
                          </span>
                        </div>
                        <p className="text-xs text-foreground-muted line-clamp-2">
                          {project.description}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {project.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="text-xs px-1.5 py-0.5 bg-surface-elevated rounded text-foreground-subtle"
                            >
                              {tag}
                            </span>
                          ))}
                          {project.tags.length > 3 && (
                            <span className="text-xs text-foreground-subtle">
                              +{project.tags.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
              </AnimatePresence>
            </motion.div>
          </section>
        </div>
      </div>
    </main>
  )
}
