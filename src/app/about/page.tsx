'use client'

import Link from 'next/link'
import { Section } from '@/components/Section'
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

const skills: [string, string][] = [
  ['AI and ML', 'Agentic AI, MCP, LLMs (GPT-4, Claude), LangChain, vector databases, computer vision'],
  ['Engineering', 'React, TypeScript, Node.js, Flutter, Dart, Python, system architecture'],
  ['Infrastructure', 'Supabase, PostgreSQL, Docker, CI/CD, cloud platforms'],
  ['Languages', 'English (native), Arabic (professional), French (working)'],
]

export default function AboutPage() {
  return (
    <main>
      {/* Hero */}
      <Section className="relative overflow-hidden pt-40 pb-24 sm:pt-48 sm:pb-32">
        <Reveal className="relative">
          <p className="eyebrow">About</p>
          <h1 className="mt-4 max-w-4xl text-display text-balance">
            AI engineer building production systems.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-foreground-muted text-pretty sm:text-xl">
            I work across machine learning, product engineering, and distributed
            systems. Currently at Facilis and a senior in Electrical Engineering
            at UC San Diego.
          </p>
        </Reveal>
      </Section>

      {/* Experience */}
      <Section divider band className="py-24 sm:py-32">
        <Reveal className="grid gap-x-16 gap-y-12 lg:grid-cols-[0.55fr_1.45fr]">
          <p className="eyebrow lg:sticky lg:top-28 lg:self-start">
            Experience
          </p>
          <div className="space-y-px overflow-hidden rounded-3xl border border-white/[0.07]">
            {experience.map((e) => (
              <div key={e.org} className="bg-white/[0.015] p-8 sm:p-10">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-xl font-semibold">
                    {e.role}{' '}
                    <span className="text-foreground-muted">· {e.org}</span>
                  </h3>
                  <span className="text-sm text-foreground-subtle">
                    {e.when}
                  </span>
                </div>
                <ul className="mt-5 space-y-2.5">
                  {e.points.map((p) => (
                    <li
                      key={p}
                      className="flex gap-3 text-sm leading-relaxed text-foreground-muted"
                    >
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground-subtle" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Reveal>
      </Section>

      {/* Education */}
      <Section divider className="py-24 sm:py-32">
        <Reveal className="grid gap-x-16 gap-y-12 lg:grid-cols-[0.55fr_1.45fr]">
          <p className="eyebrow">Education</p>
          <div className="space-y-10">
            {education.map((e) => (
              <div key={e.school}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-xl font-semibold">{e.school}</h3>
                  <span className="text-sm text-foreground-subtle">
                    {e.when}
                  </span>
                </div>
                <p className="mt-2 text-foreground-muted">{e.detail}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </Section>

      {/* Skills */}
      <Section divider band className="py-24 sm:py-32">
        <Reveal className="grid gap-x-16 gap-y-12 lg:grid-cols-[0.55fr_1.45fr]">
          <p className="eyebrow">Skills</p>
          <div className="grid gap-px overflow-hidden rounded-3xl border border-white/[0.07] sm:grid-cols-2">
            {skills.map(([title, body]) => (
              <div key={title} className="bg-white/[0.015] p-8">
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </Section>

      {/* CTA */}
      <Section divider className="relative overflow-hidden py-32 sm:py-40">
        <Reveal className="relative text-center">
          <h2 className="mx-auto max-w-3xl text-display text-balance">
            Let&apos;s work <span className="text-accent">together.</span>
          </h2>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/portfolio" className="btn-primary focus-ring">
              View Work
            </Link>
            <Link href="/contact" className="btn-secondary focus-ring">
              Get in Touch
            </Link>
          </div>
        </Reveal>
      </Section>
    </main>
  )
}
