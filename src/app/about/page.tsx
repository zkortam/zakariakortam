'use client'

import Link from 'next/link'
import { Container } from '@/components/Container'
import { Reveal } from '@/components/Reveal'

const experience = [
  {
    role: 'AI Engineer',
    org: 'Facilis',
    when: 'Apr 2025 to Present',
    points: [
      'Build agentic AI tools for industrial enterprise using the Model Context Protocol',
      'Architect agent orchestration with React, TypeScript, and Node.js',
      'Design and ship production LLM integrations',
    ],
  },
  {
    role: 'Product Development Intern',
    org: 'Incorta',
    when: 'Jun 2024 to Mar 2025',
    points: [
      'Built full-stack visual components and interactive dashboards',
      'Contributed to AI Copilot features on an enterprise analytics platform',
      'Shipped responsive UI in React and TypeScript',
    ],
  },
  {
    role: 'Founder and Lead Engineer',
    org: 'Surf',
    when: 'Aug 2022 to Mar 2025',
    points: [
      'Built a cross-platform social app with Flutter and Dart',
      'Integrated GPT-4 for language and YOLOv8 for vision',
      'Owned the full product lifecycle over 2.5 years',
    ],
  },
]

const education = [
  {
    school: 'University of California, San Diego',
    detail: 'B.S. Electrical Engineering: Machine Learning and Controls',
    when: '2024 to 2026',
  },
  {
    school: 'Evergreen Valley College',
    detail: 'Triple major: Computer Science, Mathematics, Physics. Magna Cum Laude.',
    when: '2022 to 2024',
  },
]

const skills = [
  ['AI and ML', 'Agentic AI, MCP, LLMs (GPT-4, Claude), LangChain, vector databases, computer vision'],
  ['Engineering', 'React, TypeScript, Node.js, Flutter, Dart, Python, system architecture'],
  ['Infrastructure', 'Supabase, PostgreSQL, Docker, CI/CD, cloud platforms'],
  ['Languages', 'English (native), Arabic (professional), French (working)'],
]

export default function AboutPage() {
  return (
    <main className="pt-16">
      <Container>
        <section className="border-b border-white/8 py-20">
          <Reveal>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              About
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-foreground-muted text-pretty">
              I am an AI engineer focused on building production systems across
              machine learning, product engineering, and distributed systems.
              Currently at Facilis and a senior in Electrical Engineering at UC
              San Diego.
            </p>
          </Reveal>
        </section>

        <section className="border-b border-white/8 py-16">
          <h2 className="text-sm font-medium text-foreground-subtle">
            Experience
          </h2>
          <div className="mt-10 space-y-12">
            {experience.map((e, i) => (
              <Reveal key={e.org} delay={i * 0.04}>
                <div className="grid gap-3 sm:grid-cols-[170px_1fr] sm:gap-8">
                  <div className="text-sm text-foreground-subtle">{e.when}</div>
                  <div>
                    <h3 className="font-semibold">
                      {e.role}{' '}
                      <span className="text-foreground-muted">· {e.org}</span>
                    </h3>
                    <ul className="mt-3 space-y-2">
                      {e.points.map((p) => (
                        <li
                          key={p}
                          className="flex gap-3 text-sm text-foreground-muted"
                        >
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground-subtle" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="border-b border-white/8 py-16">
          <h2 className="text-sm font-medium text-foreground-subtle">
            Education
          </h2>
          <div className="mt-10 space-y-10">
            {education.map((e, i) => (
              <Reveal key={e.school} delay={i * 0.04}>
                <div className="grid gap-3 sm:grid-cols-[170px_1fr] sm:gap-8">
                  <div className="text-sm text-foreground-subtle">{e.when}</div>
                  <div>
                    <h3 className="font-semibold">{e.school}</h3>
                    <p className="mt-1 text-sm text-foreground-muted">
                      {e.detail}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="border-b border-white/8 py-16">
          <h2 className="text-sm font-medium text-foreground-subtle">Skills</h2>
          <div className="mt-10 space-y-8">
            {skills.map(([title, body], i) => (
              <Reveal key={title} delay={i * 0.04}>
                <div className="grid gap-2 sm:grid-cols-[170px_1fr] sm:gap-8">
                  <div className="text-sm font-medium">{title}</div>
                  <p className="text-sm leading-relaxed text-foreground-muted">
                    {body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="py-20">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/portfolio"
              className="focus-ring rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              View Work
            </Link>
            <Link
              href="/contact"
              className="card card-hover focus-ring rounded-full px-6 py-3 text-sm font-medium"
            >
              Get in Touch
            </Link>
          </div>
        </section>
      </Container>
    </main>
  )
}
