'use client'

import Link from 'next/link'
import { Section } from '@/components/Section'
import { Reveal, Stagger, StaggerItem } from '@/components/Reveal'
import { MaskText } from '@/components/MaskText'
import { HeroShader } from '@/components/HeroShader'
import { ExperienceTimeline } from '@/components/ExperienceTimeline'

const experience = [
  {
    role: 'Founding AI Engineer',
    org: 'FacilisAI',
    when: 'Apr 2025 to Present',
    points: [
      'Architected and launched the flagship agentic platform connecting plant systems (PLCs, MES, SCADA) to specialized AI agents',
      'Led 0-to-1 discovery with 15+ customer interviews; owned ICP, roadmap, demos, and enterprise sales',
      'Deployed to 20 enterprise testers; converted demos into provisional contracts',
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
    role: 'Product Intern',
    org: 'Inqueue',
    when: 'Jun 2023 to Oct 2023',
    points: [
      'Owned MVP discovery to launch: market research, core journeys, and a shipped Flutter app',
      'Defined activation, completion, and engagement KPIs; reprioritized the backlog from signals',
    ],
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
      <Section
        className="relative overflow-hidden pt-40 pb-24 sm:pt-48 sm:pb-32"
        backdrop={<HeroShader seed={0.8} />}
      >
        <div className="relative">
          <Reveal>
            <p className="eyebrow">About</p>
          </Reveal>
          <MaskText
            as="h1"
            inView={false}
            className="mt-4 max-w-4xl text-display text-balance"
            lines={['AI engineer building', 'production systems.']}
          />
          <Reveal delay={0.12}>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-foreground-muted text-pretty sm:text-xl">
              I build products across engineering, design, and product.
              Founding AI Engineer at FacilisAI, finishing a B.S. in Electrical
              Engineering at UC San Diego. Based in San Jose.
            </p>
          </Reveal>
        </div>
      </Section>

      {/* Approach — large statement */}
      <Section divider className="py-24 sm:py-36">
        <Reveal>
          <p className="eyebrow">Approach</p>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mt-8 max-w-5xl text-[clamp(1.5rem,3.4vw,2.6rem)] font-medium leading-[1.28] tracking-tight text-pretty">
            I work at the seam between{' '}
            <span className="text-accent">hardware and intelligence</span>.
            Agentic systems for industrial plants, a SPICE-class circuit
            simulator written from scratch, computer-vision pipelines shipped
            solo. From PRD to PID loop,{' '}
            <span className="text-accent">owned end to end</span>.
          </p>
        </Reveal>
      </Section>

      {/* Experience */}
      <Section divider band className="py-24 sm:py-32">
        <Reveal>
          <p className="eyebrow">Career</p>
          <MaskText
            as="h2"
            className="mt-3 text-headline"
            lines={['Experience']}
          />
        </Reveal>
        <ExperienceTimeline items={experience} />
      </Section>

      {/* Skills */}
      <Section divider band className="py-24 sm:py-32">
        <div className="grid gap-x-16 gap-y-12 lg:grid-cols-[0.55fr_1.45fr]">
          <Reveal>
            <p className="eyebrow lg:sticky lg:top-28 lg:self-start">Skills</p>
          </Reveal>
          <Stagger className="grid gap-px overflow-hidden rounded-3xl border border-white/[0.07] sm:grid-cols-2">
            {skills.map(([title, body]) => (
              <StaggerItem
                key={title}
                className="bg-white/[0.015] p-8 transition-colors duration-500 hover:bg-white/[0.03]"
              >
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
                  {body}
                </p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Section>

      {/* Education */}
      <Section divider className="py-20 sm:py-24">
        <Reveal className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <div>
            <p className="eyebrow">Education</p>
            <h3 className="mt-3 text-xl font-semibold sm:text-2xl">
              University of California, San Diego
            </h3>
            <p className="mt-1 text-foreground-muted">
              B.S. Electrical Engineering, Computer System Design Depth
            </p>
          </div>
          <span className="text-sm text-foreground-subtle">
            Expected Jun 2026
          </span>
        </Reveal>
      </Section>

      {/* CTA */}
      <Section divider className="relative overflow-hidden py-32 sm:py-40">
        <div className="relative text-center">
          <MaskText
            as="h2"
            stagger={0.1}
            className="mx-auto max-w-3xl text-display text-balance"
            lines={[
              <span key="cta">
                Let&apos;s work <span className="text-accent">together.</span>
              </span>,
            ]}
          />
          <Reveal delay={0.1} className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/portfolio" className="btn-primary focus-ring">
              View Work
            </Link>
            <Link href="/contact" className="btn-secondary focus-ring">
              Get in Touch
            </Link>
          </Reveal>
        </div>
      </Section>
    </main>
  )
}
