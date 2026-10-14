import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { projects } from '@/lib/projects-data'
import { Container } from '@/components/Container'
import { ProjectArt } from '@/components/ProjectArt'
import { BlurIn, ClipReveal, Rule, Words } from '@/components/Motion'
import { DetailTitle } from '@/components/DetailTitle'
import { Sheen } from '@/components/Sheen'

type Params = { params: Promise<{ id: string }> }

export function generateStaticParams() {
  return projects.map((p) => ({ id: p.id }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const p = projects.find((x) => x.id === id)
  if (!p) return {}
  return { title: p.title, description: p.line }
}

export default async function ProjectPage({ params }: Params) {
  const { id } = await params
  const idx = projects.findIndex((p) => p.id === id)
  if (idx < 0) notFound()
  const p = projects[idx]
  const next = projects[(idx + 1) % projects.length]

  const host = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
  const meta: [string, React.ReactNode][] = [
    ['Role', p.role],
    ['When', p.year],
    [p.kind === 'work' ? 'Company' : 'Type', p.org ?? 'Independent'],
    [
      'Links',
      p.links ? (
        <span className="flex flex-col">
          {p.links.live && (
            <a href={p.links.live} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-accent">
              {host(p.links.live)} ↗
            </a>
          )}
          {p.links.github && (
            <a href={p.links.github} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-accent">
              GitHub ↗
            </a>
          )}
        </span>
      ) : (
        <span className="text-foreground-subtle">None public</span>
      ),
    ],
  ]

  const rows = [
    ['Overview', p.overview],
    ['Problem', p.problem],
    ['Approach', p.approach],
  ].filter(([, v]) => v) as [string, string][]

  return (
    <main>
      <Container className="pt-32 sm:pt-40">
        <BlurIn>
          <Link href="/portfolio" className="group inline-flex items-center gap-2 text-sm text-foreground-muted transition-colors hover:text-foreground">
            <span className="transition-transform duration-500 group-hover:-translate-x-1">←</span> Work
          </Link>
        </BlurIn>

        <DetailTitle title={p.title} />
        <Words as="p" onMount delay={0.35} stagger={0.03} className="mt-6 max-w-[40rem] text-lede text-foreground-muted" text={p.line} />

        <dl className="mt-16 grid grid-cols-2 gap-x-5 gap-y-8 sm:mt-20 lg:grid-cols-4">
          {meta.map(([k, v], i) => (
            <BlurIn key={k} delay={0.5 + i * 0.06}>
              <Rule className="mb-4" delay={0.4 + i * 0.06} />
              <dt className="text-sm text-foreground-subtle">{k}</dt>
              <dd className="mt-1.5 text-[0.95rem]">{v}</dd>
            </BlurIn>
          ))}
        </dl>
      </Container>

      <div className="px-2 pt-16 sm:px-3 sm:pt-24">
        <ClipReveal>
          <Sheen className="glass relative aspect-[4/3] overflow-hidden rounded-[36px] sm:aspect-[16/9] lg:aspect-[21/9]">
            <ProjectArt id={p.id} seed={idx * 0.29} className="absolute inset-0" />
          </Sheen>
        </ClipReveal>
      </div>

      <Container className="pt-24 sm:pt-36">
        {rows.map(([label, text]) => (
          <div key={label} className="grid gap-4 pb-16 sm:pb-24 lg:grid-cols-2">
            <BlurIn className="text-foreground-muted">{label}</BlurIn>
            <BlurIn as="p" delay={0.08} className="max-w-[36rem] text-[clamp(1.25rem,1.9vw,1.65rem)] leading-[1.32] tracking-[-0.02em] text-pretty">
              {text}
            </BlurIn>
          </div>
        ))}

        {p.results && (
          <div className="grid gap-4 pb-16 sm:pb-24 lg:grid-cols-2">
            <BlurIn className="text-foreground-muted">Results</BlurIn>
            <ol className="max-w-[36rem]">
              {p.results.map((r, i) => (
                <li key={r}>
                  <Rule delay={i * 0.08} />
                  <BlurIn delay={i * 0.08} className="flex gap-6 py-5 text-[clamp(1.1rem,1.6vw,1.35rem)] tracking-[-0.015em]">
                    <span className="w-5 shrink-0 tabular-nums text-accent">{i + 1}</span>
                    {r}
                  </BlurIn>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <BlurIn className="text-foreground-muted">Built with</BlurIn>
          <BlurIn as="p" delay={0.08} className="max-w-[36rem] text-[clamp(1.1rem,1.6vw,1.35rem)] tracking-[-0.015em]">
            {p.stack.join(', ')}
          </BlurIn>
        </div>
      </Container>

      {/* Next */}
      <Container className="pt-32 sm:pt-44">
        <Rule />
        <Link href={`/portfolio/${next.id}`} className="focus-ring group block rounded py-10">
          <span className="text-sm text-foreground-muted">Next</span>
          <span className="mt-3 flex items-end justify-between gap-6">
            <span className="font-display text-display transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-3">
              {next.title}
            </span>
            <span className="mb-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/15 text-xl transition-all duration-500 group-hover:border-transparent group-hover:bg-white group-hover:text-black">
              →
            </span>
          </span>
        </Link>
      </Container>
    </main>
  )
}
