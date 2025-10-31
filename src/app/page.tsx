'use client'

import { Hero } from '@/components/Hero'
import { SocialLinks } from '@/components/SocialLinks'
import Link from 'next/link'

export default function HomePage() {
  return (
    <main>
      {/* Hero Section */}
      <Hero />

      {/* Quick Introduction - Redesigned */}
      <section className="py-20 bg-surface/30">
        <div className="mx-auto max-w-5xl px-6">
          <div className="space-y-10">
            {/* Main intro */}
            <div className="max-w-3xl space-y-6">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                Building AI that feels invisible
              </h2>
              <div className="space-y-4 text-lg text-foreground-muted leading-relaxed">
                <p>
                  AI Engineer at <span className="text-foreground font-medium">Facilis</span>, building agentic tools for industrial enterprise.
                  Senior at <span className="text-foreground font-medium">UC San Diego</span> studying Electrical Engineering—Machine Learning & Controls.
                </p>
                <p>
                  Previously Product Development Intern at <span className="text-foreground font-medium">Incorta</span> and Founder of <span className="text-foreground font-medium">Surf</span>,
                  a cross-platform social app. Graduated Magna Cum Laude with triple major in CS, Math, and Physics from Evergreen Valley College.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/about"
                  className="px-5 py-2.5 bg-foreground text-background rounded-card text-sm font-medium hover:bg-foreground/90 transition-all duration-normal focus-ring"
                >
                  More About Me
                </Link>
                <Link
                  href="/portfolio"
                  className="px-5 py-2.5 glass-elevated rounded-card text-sm font-medium hover:scale-[1.02] transition-all duration-normal focus-ring"
                >
                  View Projects
                </Link>
              </div>
            </div>

            {/* Focus areas - redesigned as simple list */}
            <div className="grid md:grid-cols-2 gap-x-12 gap-y-4 pt-6 border-t border-border-subtle">
              {[
                { area: 'Agentic AI & MCPs', desc: 'Enterprise AI with Model Context Protocol' },
                { area: 'Product Engineering', desc: 'React, TypeScript, Node.js' },
                { area: 'AI Integration', desc: 'GPT-4, LangChain, Vector DBs' },
                { area: 'Cross-Platform', desc: 'Flutter & Dart for iOS, Android, Web' }
              ].map((item, index) => (
                <div key={index} className="flex gap-3 group">
                  <div className="w-1 h-1 bg-accent-blue rounded-full mt-2 flex-shrink-0 group-hover:scale-150 transition-transform" />
                  <div>
                    <div className="font-medium text-sm">{item.area}</div>
                    <div className="text-sm text-foreground-subtle">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Work Preview */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="space-y-10">
            <div className="text-center space-y-4">
              <h2 className="text-headline">Featured Work</h2>
              <p className="text-body text-foreground-muted max-w-2xl mx-auto">
                A selection of recent projects that showcase technical depth and real-world impact.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Featured Project 1 */}
              <Link href="/portfolio/facilis-ai" className="group block">
                <article className="glass-elevated rounded-card-lg p-8 hover:scale-[1.02] transition-all duration-normal">
                  <div className="space-y-6">
                    <div className="aspect-video bg-gradient-subtle rounded-card flex items-center justify-center">
                      <div className="text-foreground-subtle">Facilis</div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-title group-hover:text-accent-blue transition-colors">
                        Facilis - Agentic AI Tools
                      </h3>
                      <p className="text-body text-foreground-muted">
                        Building production agentic tools for industrial enterprise customers using Model Context Protocol,
                        React, TypeScript, and Node.js. Current role as AI Engineer.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {['MCP', 'Node.js', 'React', 'TypeScript', 'Agents'].map((tag) => (
                          <span key={tag} className="text-xs px-2 py-1 bg-surface rounded text-foreground-subtle">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              </Link>

              {/* Featured Project 2 */}
              <Link href="/portfolio/surf" className="group block">
                <article className="glass-elevated rounded-card-lg p-8 hover:scale-[1.02] transition-all duration-normal">
                  <div className="space-y-6">
                    <div className="aspect-video bg-gradient-subtle rounded-card flex items-center justify-center">
                      <div className="text-foreground-subtle">Surf</div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-title group-hover:text-accent-blue transition-colors">
                        Surf Platform
                      </h3>
                      <p className="text-body text-foreground-muted">
                        Cross-platform social application built with Flutter and Dart. Integrates GPT-4 for text
                        processing and YOLOv8 for image analysis, with 2.5+ years of active development.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {['Flutter', 'GPT-4', 'YOLOv8', 'Supabase'].map((tag) => (
                          <span key={tag} className="text-xs px-2 py-1 bg-surface rounded text-foreground-subtle">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              </Link>
            </div>

            <div className="text-center">
              <Link
                href="/portfolio"
                className="inline-flex items-center gap-2 px-8 py-4 bg-foreground text-background rounded-full font-medium hover:bg-foreground/90 transition-all duration-normal focus-ring"
              >
                View All Projects
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Connect Section - Minimal & Clean */}
      <section className="py-20 bg-surface/50">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center space-y-12">
            {/* Header */}
            <div className="space-y-4">
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
                Let's work together
              </h2>
              <p className="text-lg text-foreground-muted">
                Open to AI engineering projects and product collaborations
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/contact"
                className="px-8 py-4 bg-foreground text-background rounded-full font-medium hover:bg-foreground/90 transition-all duration-normal focus-ring"
              >
                Get in Touch
              </Link>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('zakaria@zakariakortam.com')
                }}
                className="px-8 py-4 glass rounded-full font-medium hover:glass-elevated transition-all duration-normal focus-ring"
              >
                Copy Email
              </button>
            </div>

            {/* Quick Info */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center text-sm text-foreground-muted">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                <span>Available · 24h response</span>
              </div>
              <div className="hidden sm:block text-foreground-subtle">·</div>
              <span>San Jose, California</span>
            </div>

            {/* Social Links */}
            <div className="flex items-center justify-center gap-4 pt-4">
              <a
                href="https://linkedin.com/in/zkortam"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 glass rounded-full hover:glass-elevated transition-all duration-normal focus-ring group"
                aria-label="LinkedIn"
              >
                <svg className="w-5 h-5 group-hover:scale-110 transition-transform duration-normal" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
              <a
                href="https://x.com/zakariakortam"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 glass rounded-full hover:glass-elevated transition-all duration-normal focus-ring group"
                aria-label="X (Twitter)"
              >
                <svg className="w-5 h-5 group-hover:scale-110 transition-transform duration-normal" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a
                href="https://instagram.com/zkortam"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 glass rounded-full hover:glass-elevated transition-all duration-normal focus-ring group"
                aria-label="Instagram"
              >
                <svg className="w-5 h-5 group-hover:scale-110 transition-transform duration-normal" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a
                href="https://github.com/zkortam"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 glass rounded-full hover:glass-elevated transition-all duration-normal focus-ring group"
                aria-label="GitHub"
              >
                <svg className="w-5 h-5 group-hover:scale-110 transition-transform duration-normal" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
