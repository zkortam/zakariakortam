import Link from 'next/link'
import { Hero } from '@/components/Hero'
import { Section } from '@/components/Section'
import { WorkShowcase } from '@/components/WorkShowcase'
import { Reveal } from '@/components/Reveal'
import { MaskText } from '@/components/MaskText'
import { FocusScroll, type Focus } from '@/components/FocusScroll'
import { projects, isWorkProject } from '@/lib/projects-data'

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
      <Hero />

      {/* What I work on — pinned, scrubbed */}
      <FocusScroll items={focus} />

      {/* Work: horizontal scroll showcase */}
      <WorkShowcase items={featured} />

      {/* CTA */}
      <Section divider className="relative overflow-hidden py-32 sm:py-40">
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
