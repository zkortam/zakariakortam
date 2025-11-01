'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { projects, categories } from '@/lib/projects-data'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ProjectPreview } from '@/components/ProjectPreview'

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
    <main className="min-h-screen pt-16 bg-background">
      {/* Hero Section with Cool Animations - Full Screen */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated Background Stars */}
        <div className="absolute inset-0 opacity-50 pointer-events-none">
          {Array.from({ length: 60 }).map((_, i) => {
            const x = (i * 19.7 + 11) % 100;
            const y = (i * 21.3 + 9) % 100;
            const duration = 2.5 + (i % 4);
            const delay = (i % 8) * 0.35;
            const size = i % 6 === 0 ? 2 : 1;

            return (
              <motion.div
                key={i}
                className="absolute rounded-full bg-white"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${size}px`,
                  height: `${size}px`,
                }}
                animate={{
                  opacity: [0.3, 1, 0.3],
                  scale: [0.8, 1.2, 0.8],
                }}
                transition={{
                  duration: duration,
                  delay: delay,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            );
          })}
        </div>

        {/* Floating Gradient Orbs */}
        <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute w-96 h-96 rounded-full bg-gradient-to-r from-emerald-500/30 to-teal-500/30 blur-3xl"
            animate={{
              x: [0, 120, 0],
              y: [0, -60, 0],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: 22,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{ left: '15%', top: '25%' }}
          />
          <motion.div
            className="absolute w-80 h-80 rounded-full bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 blur-3xl"
            animate={{
              x: [0, -90, 0],
              y: [0, 70, 0],
              scale: [1, 1.4, 1],
            }}
            transition={{
              duration: 28,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{ right: '15%', top: '35%' }}
          />
          <motion.div
            className="absolute w-72 h-72 rounded-full bg-gradient-to-r from-teal-500/15 to-cyan-500/15 blur-3xl"
            animate={{
              x: [0, 50, 0],
              y: [0, -40, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 18,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{ left: '50%', top: '60%' }}
          />
        </div>

        <div className="relative mx-auto max-w-4xl px-6">
          <div className="space-y-10 text-center">
            {/* Title with letter animation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <motion.h1
                className="text-6xl md:text-7xl lg:text-8xl font-semibold tracking-tight"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                {'Portfolio'.split('').map((letter, index) => (
                  <motion.span
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.3 + index * 0.1,
                      ease: "easeOut"
                    }}
                    className="inline-block"
                  >
                    {letter}
                  </motion.span>
                ))}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className="text-xl md:text-2xl text-foreground-muted max-w-3xl mx-auto leading-relaxed"
              >
                Selected projects showcasing systems thinking, technical depth, and shipped impact.
              </motion.p>
            </motion.div>

            {/* Multiple animated dividers */}
            <motion.div
              className="flex items-center justify-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "3rem" }}
                transition={{ duration: 0.8, delay: 1.3 }}
                className="h-0.5 bg-foreground/50 rounded-full"
              />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 1.5 }}
                className="w-2 h-2 bg-foreground rounded-full"
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "3rem" }}
                transition={{ duration: 0.8, delay: 1.3 }}
                className="h-0.5 bg-foreground/50 rounded-full"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Content Sections with 50px top padding */}
      <div className="mx-auto max-w-7xl px-6 pb-20" style={{ paddingTop: '50px' }}>
        <div className="space-y-12">

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
                      <ProjectPreview project={project} size="md" />
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredProjects.map((project) => (
                <div key={project.id}>
                  <Link
                    href={`/portfolio/${project.id}`}
                    className="group glass rounded-card-lg p-4 hover:glass-elevated hover:scale-[1.02] transition-all duration-normal block h-full"
                  >
                    <div className="space-y-3">
                      <div className="aspect-video bg-surface rounded-card overflow-hidden">
                        <ProjectPreview project={project} size="sm" />
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
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
