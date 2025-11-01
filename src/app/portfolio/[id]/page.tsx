'use client'

import { notFound } from 'next/navigation'
import { projects } from '@/lib/projects-data'
import Link from 'next/link'
import { use } from 'react'
import { ProjectPreview } from '@/components/ProjectPreview'

interface ProjectDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id } = use(params)
  const project = projects.find(p => p.id === id)

  if (!project) {
    notFound()
  }

  const currentIndex = projects.findIndex(p => p.id === id)
  const previousProject = currentIndex > 0 ? projects[currentIndex - 1] : null
  const nextProject = currentIndex < projects.length - 1 ? projects[currentIndex + 1] : null

  return (
    <main className="min-h-screen pt-16">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="space-y-12">
          {/* Back Button */}
          <Link
            href="/portfolio"
            className="inline-flex items-center gap-2 text-foreground-muted hover:text-foreground transition-colors group"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Portfolio
          </Link>

          {/* Project Header */}
          <header className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="px-3 py-1 bg-accent-blue/20 text-accent-blue rounded-full text-sm font-medium">
                    {project.category}
                  </span>
                  <span className="text-foreground-subtle">{project.year}</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">{project.title}</h1>
                <p className="text-xl text-foreground-muted max-w-3xl">
                  {project.description}
                </p>
              </div>
            </div>

            {/* Project Meta */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 glass rounded-card-lg p-6">
              {project.role && (
                <div className="space-y-2">
                  <div className="text-sm text-foreground-subtle">Role</div>
                  <div className="font-medium">{project.role}</div>
                </div>
              )}
              {project.timeline && (
                <div className="space-y-2">
                  <div className="text-sm text-foreground-subtle">Timeline</div>
                  <div className="font-medium">{project.timeline}</div>
                </div>
              )}
              {project.team && (
                <div className="space-y-2">
                  <div className="text-sm text-foreground-subtle">Team</div>
                  <div className="font-medium">{project.team}</div>
                </div>
              )}
              <div className="space-y-2">
                <div className="text-sm text-foreground-subtle">Year</div>
                <div className="font-medium">{project.year}</div>
              </div>
            </div>
          </header>

          {/* Project Image */}
          <div className="aspect-video glass-elevated rounded-card-lg overflow-hidden">
            <ProjectPreview project={project} size="lg" />
          </div>

          {/* Project Content */}
          <div className="grid gap-12 lg:grid-cols-3">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-10">
              {/* Overview */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Overview</h2>
                <p className="text-body text-foreground-muted leading-relaxed">
                  {project.overview}
                </p>
              </section>

              {/* Challenge */}
              {project.challenge && (
                <section className="space-y-4">
                  <h2 className="text-2xl font-semibold">The Challenge</h2>
                  <p className="text-body text-foreground-muted leading-relaxed">
                    {project.challenge}
                  </p>
                </section>
              )}

              {/* Solution */}
              {project.solution && (
                <section className="space-y-4">
                  <h2 className="text-2xl font-semibold">The Solution</h2>
                  <p className="text-body text-foreground-muted leading-relaxed">
                    {project.solution}
                  </p>
                </section>
              )}

              {/* Impact */}
              {project.impact && project.impact.length > 0 && (
                <section className="space-y-4">
                  <h2 className="text-2xl font-semibold">Impact & Results</h2>
                  <div className="space-y-3">
                    {project.impact.map((item, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 bg-accent-blue rounded-full mt-2.5 flex-shrink-0" />
                        <p className="text-body text-foreground-muted">{item}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Technologies */}
              <div className="glass-elevated rounded-card-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold">Technologies</h3>
                <div className="flex flex-wrap gap-2">
                  {project.technologies.map((tech) => (
                    <span
                      key={tech}
                      className="px-3 py-1.5 bg-surface-elevated rounded-card text-sm"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              {/* Links */}
              {project.links && (
                <div className="glass rounded-card-lg p-6 space-y-4">
                  <h3 className="text-lg font-semibold">Project Links</h3>
                  <div className="space-y-3">
                    {project.links.live && (
                      <a
                        href={project.links.live}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-accent-blue hover:text-accent-cyan transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Live Demo
                      </a>
                    )}
                    {project.links.github && (
                      <a
                        href={project.links.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-accent-blue hover:text-accent-cyan transition-colors"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        View Code
                      </a>
                    )}
                    {project.links.demo && (
                      <a
                        href={project.links.demo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-accent-blue hover:text-accent-cyan transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Demo Video
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Tags */}
              <div className="glass rounded-card-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-surface rounded text-xs text-foreground-subtle"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation to Other Projects */}
          <section className="border-t border-border pt-12 mt-12">
            <div className="grid gap-6 md:grid-cols-2">
              {previousProject && (
                <Link
                  href={`/portfolio/${previousProject.id}`}
                  className="group glass rounded-card-lg p-6 hover:glass-elevated transition-all duration-normal"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-foreground-subtle">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Previous Project
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium group-hover:text-accent-blue transition-colors">
                        {previousProject.title}
                      </h3>
                      <p className="text-sm text-foreground-muted line-clamp-2">
                        {previousProject.description}
                      </p>
                    </div>
                  </div>
                </Link>
              )}
              {nextProject && (
                <Link
                  href={`/portfolio/${nextProject.id}`}
                  className="group glass rounded-card-lg p-6 hover:glass-elevated transition-all duration-normal md:ml-auto md:text-right"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-foreground-subtle md:justify-end">
                      Next Project
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium group-hover:text-accent-blue transition-colors">
                        {nextProject.title}
                      </h3>
                      <p className="text-sm text-foreground-muted line-clamp-2">
                        {nextProject.description}
                      </p>
                    </div>
                  </div>
                </Link>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
