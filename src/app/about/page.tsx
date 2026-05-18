'use client'

import Link from 'next/link'
import { Section } from '@/components/Section'
import { Reveal } from '@/components/Reveal'

const experience = [
  {
    role: 'Founding AI Engineer',
    org: 'FacilisAI',
    when: 'Apr 2025 to Present',
    points: [
      'Architected and launched the flagship agentic platform connecting plant systems (PLCs, MES, SCADA) to specialized AI agents',
      'Led 0-to-1 discovery with 15+ customer interviews; owned ICP, roadmap, demos, and enterprise sales',
      'Deployed to 20 enterprise testers (MEAU, OKI); secured $100K+ in provisional contracts',
    ],
  },
  {
    role: 'Product Engineering Intern',
    org: 'Incorta',
    when: 'Jul 2024 to Mar 2025',
    points: [
      'Built TypeScript schema interpreters powering the AI Copilot dashboard, JSON spec to streamed charts',
      'Shipped 5+ features end to end: PRDs, design reviews, QA, and rollout',
      'Built a GitHub Actions CI pipeline (Jest, shell) at 90%+ coverage',
    ],
  },
  {
    role: 'Technical Intern',
    org: 'Adobe',
    when: 'Jun 2023 to Aug 2023',
    points: [
      'Built a Slack-native GenAI app (Node.js, Slack Bolt) integrating RAG with RBAC and audit logging',
      'Implemented vector search over Slack data with natural-language Q&A and thread summarization',
    ],
  },
  {
    role: 'Product Intern',
    org: 'Inqueue',
    when: 'Jun 2023 to Oct 2023',
    points: [
      'Owned MVP discovery to launch: market research, core journeys, and a shipped Flutter app',
      'Defined activation, completion, and engagement KPIs; reprioritized the backlog from signals',
    ],
  },
]

const education = [
  {
    school: 'University of California, San Diego',
    detail: 'B.S. Electrical Engineering, Computer System Design Depth',
    when: 'Expected Jun 2026',
  },
]

const skills: [string, string][] = [
  ['Languages', 'C/C++, Python, Go, Rust, Java, TypeScript, Shell, SQL'],
  ['AI', 'MCP, LangChain, RAG, vector databases, Claude, OpenAI, Codex'],
  ['Infrastructure', 'Docker, Kubernetes, AWS, Azure, GCP, PostgreSQL, Firebase'],
  ['Product', 'Roadmapping, PRDs, KPIs, user research, A/B testing, Agile'],
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
            I build products end to end: engineering, design, and product.
            Founding AI Engineer at FacilisAI, finishing a B.S. in Electrical
            Engineering at UC San Diego.
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
