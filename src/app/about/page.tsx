'use client'

import Link from 'next/link'
import { Reveal, Stagger, StaggerItem } from '@/components/Reveal'
import { GlassCard } from '@/components/GlassCard'

const experience = [
  {
    role: 'AI Engineer',
    org: 'Facilis',
    when: 'Apr 2025 to Present',
    points: [
      'Building agentic AI tools for industrial enterprise using Model Context Protocol',
      'Architecting agent orchestration with React, TypeScript, and Node.js',
      'Designing production-grade LLM integrations',
    ],
  },
  {
    role: 'Product Development Intern',
    org: 'Incorta',
    when: 'Jun 2024 to Mar 2025',
    points: [
      'Built full-stack visual components and interactive dashboards',
      'Contributed to AI Copilot features for an enterprise analytics platform',
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
    detail: 'B.S. Electrical Engineering, Machine Learning and Controls',
    when: '2024 to 2026',
  },
  {
    school: 'Evergreen Valley College',
    detail: 'Triple major: Computer Science, Mathematics, Physics. Magna Cum Laude.',
    when: '2022 to 2024',
  },
]

const skills = [
  { title: 'AI and ML', body: 'Agentic AI, MCP, LLMs (GPT-4, Claude), LangChain, vector databases, computer vision' },
  { title: 'Engineering', body: 'React, TypeScript, Node.js, Flutter, Dart, Python, system architecture' },
  { title: 'Infrastructure', body: 'Supabase, PostgreSQL, Docker, CI/CD, cloud platforms' },
  { title: 'Languages', body: 'English (native), Arabic (professional), French (working)' },
]

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 pb-32 pt-40">
      <Reveal>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent/80">
          About
        </p>
        <h1 className="mt-5 text-display text-gradient">
          Systems thinking,
          <br /> product taste.
        </h1>
        <p className="mt-7 max-w-xl text-balance text-lg text-foreground-muted">
          AI Engineer working at the intersection of machine learning, product
          engineering, and distributed systems.
        </p>
      </Reveal>

      <div className="mt-28 space-y-28">
        <section>
          <Reveal>
            <h2 className="mb-10 text-headline text-gradient">Experience</h2>
          </Reveal>
          <Stagger className="space-y-4">
            {experience.map((e) => (
              <StaggerItem key={e.org}>
                <GlassCard className="rounded-3xl p-8">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="text-title">{e.role}</h3>
                    <span className="text-sm text-foreground-subtle">{e.when}</span>
                  </div>
                  <div className="mt-1 text-accent/90">{e.org}</div>
                  <ul className="mt-5 space-y-2.5">
                    {e.points.map((p) => (
                      <li key={p} className="flex gap-3 text-sm text-foreground-muted">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </GlassCard>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        <section>
          <Reveal>
            <h2 className="mb-10 text-headline text-gradient">Education</h2>
          </Reveal>
          <Stagger className="grid gap-4 sm:grid-cols-2">
            {education.map((e) => (
              <StaggerItem key={e.school}>
                <GlassCard className="h-full rounded-3xl p-8">
                  <div className="text-sm text-foreground-subtle">{e.when}</div>
                  <h3 className="mt-2 text-title">{e.school}</h3>
                  <p className="mt-2 text-sm text-foreground-muted">{e.detail}</p>
                </GlassCard>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        <section>
          <Reveal>
            <h2 className="mb-10 text-headline text-gradient">Skills</h2>
          </Reveal>
          <Stagger className="grid gap-px overflow-hidden rounded-4xl glass sm:grid-cols-2">
            {skills.map((s) => (
              <StaggerItem
                key={s.title}
                className="bg-white/[0.015] p-7 transition-colors duration-base hover:bg-white/[0.04]"
              >
                <div className="text-base font-semibold">{s.title}</div>
                <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                  {s.body}
                </p>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        <Reveal>
          <div className="flex flex-col gap-3 border-t border-white/8 pt-12 sm:flex-row">
            <Link
              href="/portfolio"
              className="focus-ring rounded-full bg-foreground px-7 py-3.5 text-center text-sm font-semibold text-background transition-transform duration-base hover:scale-[1.03]"
            >
              View Work
            </Link>
            <Link
              href="/contact"
              className="glass focus-ring rounded-full px-7 py-3.5 text-center text-sm font-semibold transition-all duration-base hover:scale-[1.03]"
            >
              Get in Touch
            </Link>
          </div>
        </Reveal>
      </div>
    </main>
  )
}
