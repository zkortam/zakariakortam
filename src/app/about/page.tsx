import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Container } from '@/components/Container'
import { PageHead } from '@/components/PageHead'
import { BlurIn, ClipReveal, Rule, SectionHead } from '@/components/Motion'
import { work } from '@/lib/projects-data'

export const metadata: Metadata = {
  title: 'About',
  description: 'Zakaria Kortam is an Associate Product Manager on the Innovation team at DigiCert, based in San Jose.',
}

const tools: [string, string][] = [
  ['Product', 'Roadmaps, PRDs, KPIs, user research, A/B tests'],
  ['Code', 'TypeScript, Python, Rust, Go, C/C++, SQL'],
  ['AI', 'Claude, OpenAI, MCP, RAG, vector databases'],
  ['Infrastructure', 'Supabase, Postgres, Docker, Kubernetes, AWS, Azure, GCP'],
]

const P = 'text-[clamp(1.25rem,1.9vw,1.65rem)] leading-[1.32] tracking-[-0.02em] text-pretty'

export default function AboutPage() {
  return (
    <main>
      <PageHead
        title="About"
        statement="I’m a product manager in San Jose. I studied electrical engineering at UC San Diego."
      />

      {/* Portrait and story */}
      <Container className="pt-24 sm:pt-32">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-5">
          <ClipReveal className="lg:sticky lg:top-28 lg:self-start">
            <div className="glass relative aspect-[4/5] max-w-[34rem] overflow-hidden rounded-[32px]">
              <div
                className="absolute inset-0"
                style={{ background: 'radial-gradient(80% 60% at 60% 30%, rgba(122,26,40,0.55), transparent 75%)' }}
              />
              <Image
                src="/zakaria.png"
                alt="Zakaria Kortam"
                fill
                sizes="(min-width: 1024px) 34rem, 100vw"
                className="object-cover object-top mix-blend-lighten"
              />
            </div>
          </ClipReveal>

          <div className="max-w-[36rem] space-y-8">
            <BlurIn as="p" className={P}>
              Most of what I know about product came from shipping my own things. Surf started in 2022 and
              is on its fourth version. Helio, SPICE++, and AiroFind came after it.
            </BlurIn>
            <BlurIn as="p" className={P}>
              Before DigiCert I was the founding AI engineer at FacilisAI, building agents that work with
              factory systems. Before that I did product work at Incorta and Inqueue.
            </BlurIn>
            <BlurIn as="p" className={P}>
              I was also COO of ClosingTheDivide, a nonprofit that has donated more than 1,350 computers
              and set up 12 computer labs.
            </BlurIn>
            <BlurIn>
              <Link href="/contact" className="group inline-flex items-center gap-2 text-[0.95rem] font-medium">
                Get in touch
                <span className="transition-transform duration-500 group-hover:translate-x-1">→</span>
              </Link>
            </BlurIn>
          </div>
        </div>
      </Container>

      {/* I. Experience */}
      <Container className="pt-36 sm:pt-48">
        <SectionHead n="I" label="Experience" />
        {work.map((w, i) => (
          <div key={w.id}>
            <Link
              href={`/portfolio/${w.id}`}
              className="group grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-1 py-6 sm:grid-cols-[14rem_1fr_auto] sm:py-8"
            >
              <BlurIn as="span" delay={i * 0.05} className="text-foreground-muted">
                {w.org}
              </BlurIn>
              <BlurIn
                as="span"
                delay={i * 0.05 + 0.05}
                className="col-span-2 row-start-2 text-[clamp(1.35rem,2.2vw,1.9rem)] leading-tight tracking-[-0.025em] transition-transform duration-500 group-hover:translate-x-1 sm:col-span-1 sm:row-start-auto"
              >
                {w.role}
              </BlurIn>
              <BlurIn as="span" delay={i * 0.05 + 0.1} className="text-sm tabular-nums text-foreground-subtle">
                {w.year}
              </BlurIn>
            </Link>
            <Rule delay={i * 0.05} />
          </div>
        ))}
      </Container>

      {/* II. Tools */}
      <Container className="pt-36 sm:pt-48">
        <SectionHead n="II" label="Tools" />
        <div className="grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {tools.map(([k, v], i) => (
            <BlurIn key={k} delay={i * 0.06}>
              <p className="text-sm text-foreground-subtle">{k}</p>
              <p className="mt-2 text-[1.1rem] leading-snug tracking-[-0.015em]">{v}</p>
            </BlurIn>
          ))}
        </div>
      </Container>

      {/* III. School */}
      <Container className="pt-36 sm:pt-48">
        <SectionHead n="III" label="School" />
        <div className="grid gap-4 lg:grid-cols-2">
          <BlurIn className="text-foreground-muted">University of California, San Diego</BlurIn>
          <BlurIn as="p" delay={0.08} className={P}>
            B.S. Electrical Engineering, with a depth in computer system design. Class of 2026.
          </BlurIn>
        </div>
      </Container>
    </main>
  )
}
