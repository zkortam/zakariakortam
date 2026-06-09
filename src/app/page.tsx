import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Hero } from '@/components/Hero'
import { Section } from '@/components/Section'
import { WorkIndex } from '@/components/WorkIndex'
import { Reveal } from '@/components/Reveal'
import { MaskText } from '@/components/MaskText'
import { FocusScroll, type Focus } from '@/components/FocusScroll'
import { ChapterRail } from '@/components/ChapterRail'
import { projects, isWorkProject } from '@/lib/projects-data'

const chapters = [
  { id: 'intro', label: 'Intro' },
  { id: 'focus', label: 'What I do' },
  { id: 'work', label: 'Work' },
  { id: 'contact', label: 'Contact' },
]

const focus: Focus[] = [
  {
    area: 'Agentic AI',
    desc: 'Model Context Protocol, tool-using agents, and orchestration for enterprise systems.',
  },
  {
    area: 'Product Engineering',
    desc: 'React, TypeScript, and Node.js. Shipping interfaces people actually use.',
  },
  {
    area: 'Applied ML',
    desc: 'LLMs, vector search, and computer vision wired into real products.',
  },
  {
    area: 'Cross-Platform',
    desc: 'Flutter and Dart for native iOS, Android, and the web from one codebase.',
  },
]

export default function HomePage() {
  const featured = projects.filter(isWorkProject)

  return (
    <main>
      <ChapterRail chapters={chapters} />

      <div id="intro">
        <Hero />
      </div>

      {/* What I work on — pinned, scrubbed */}
      <FocusScroll items={focus} id="focus" />

      {/* Work: professional roles and ventures */}
      <Section id="work" divider band className="py-24 sm:py-32">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Work</p>
            <MaskText as="h2" className="mt-4 text-headline" lines={['Roles']} />
          </div>
          <Link
            href="/portfolio"
            className="focus-ring group inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-5 py-2.5 text-sm text-foreground-muted transition-all duration-300 hover:border-accent/30 hover:text-accent"
          >
            Work and projects
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>

        <WorkIndex items={featured} />
      </Section>

      {/* CTA */}
      <Section id="contact" divider className="relative overflow-hidden py-32 sm:py-40">
        <div className="relative text-center">
          <Reveal>
            <p className="eyebrow">Get in touch</p>
          </Reveal>
          <MaskText
            as="h2"
            stagger={0.1}
            className="mx-auto mt-5 max-w-3xl text-display text-balance"
            lines={[
              <span key="cta">
                Let&apos;s build <span className="text-accent">something.</span>
              </span>,
            ]}
          />
          <Reveal delay={0.1}>
            <p className="mx-auto mt-7 max-w-md text-lg text-foreground-muted">
              Open to AI engineering work and product collaborations. I usually
              reply within a day.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link href="/contact" className="btn-primary focus-ring">
                Contact
              </Link>
              <a
                href="https://github.com/zkortam"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary focus-ring"
              >
                GitHub
              </a>
            </div>
          </Reveal>
        </div>
      </Section>
    </main>
  )
}
