import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { projects } from '@/lib/projects-data'
import { Container } from '@/components/Container'
import { Fade } from '@/components/Motion'

type Params = { params: Promise<{ id: string }> }

export function generateStaticParams() {
  return projects.map((p) => ({ id: p.id }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const p = projects.find((x) => x.id === id)
  return p ? { title: p.title, description: p.line } : {}
}

const host = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')

export default async function ProjectPage({ params }: Params) {
  const { id } = await params
  const idx = projects.findIndex((p) => p.id === id)
  if (idx < 0) notFound()
  const p = projects[idx]
  const next = projects[(idx + 1) % projects.length]

  const sections = [
    ['Overview', p.overview],
    ['Problem', p.problem],
    ['Approach', p.approach],
  ].filter(([, v]) => v) as [string, string][]

  return (
    <main>
      <Container className="pt-40 sm:pt-52">
        <Fade now>
          <h1 className="font-display text-title">{p.title}</h1>
          <p className="mt-6 max-w-[34rem] text-xl leading-snug text-foreground-muted">{p.line}</p>
        </Fade>

        <Fade now delay={0.15}>
          <dl className="mt-12 flex flex-wrap gap-x-12 gap-y-4 border-t pt-5 text-sm">
            <div>
              <dt className="text-foreground-subtle">Role</dt>
              <dd className="mt-1">{p.role}</dd>
            </div>
            <div>
              <dt className="text-foreground-subtle">When</dt>
              <dd className="mt-1">{p.year}</dd>
            </div>
            {p.links?.live && (
              <div>
                <dt className="text-foreground-subtle">Site</dt>
                <dd className="mt-1">
                  <a href={p.links.live} target="_blank" rel="noopener noreferrer" className="underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-white">
                    {host(p.links.live)}
                  </a>
                </dd>
              </div>
            )}
            {p.links?.github && (
              <div>
                <dt className="text-foreground-subtle">Code</dt>
                <dd className="mt-1">
                  <a href={p.links.github} target="_blank" rel="noopener noreferrer" className="underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-white">
                    GitHub
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </Fade>
      </Container>

      {p.image && (
        <Container className="mt-16 sm:mt-24">
          <Fade>
            <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-white/[0.03]">
              <Image src={p.image} alt={p.title} fill priority sizes="90vw" className="object-cover" />
            </div>
          </Fade>
        </Container>
      )}

      <Container className="mt-24 sm:mt-32">
        <div className="space-y-14 sm:space-y-20">
          {sections.map(([label, text]) => (
            <Fade key={label} className="grid gap-3 sm:grid-cols-[13rem_1fr]">
              <h2 className="text-foreground-muted">{label}</h2>
              <p className="max-w-[38rem] text-xl leading-[1.45] text-pretty">{text}</p>
            </Fade>
          ))}
          {p.results && (
            <Fade className="grid gap-3 sm:grid-cols-[13rem_1fr]">
              <h2 className="text-foreground-muted">Results</h2>
              <ul className="max-w-[38rem] space-y-2 text-xl leading-[1.45]">
                {p.results.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </Fade>
          )}
          <Fade className="grid gap-3 sm:grid-cols-[13rem_1fr]">
            <h2 className="text-foreground-muted">Built with</h2>
            <p className="max-w-[38rem] text-xl leading-[1.45]">{p.stack.join(', ')}</p>
          </Fade>
        </div>
      </Container>

      <Container className="mt-32 sm:mt-48">
        <Link href={`/portfolio/${next.id}`} className="group block border-t pt-5">
          <span className="text-sm text-foreground-muted">Next</span>
          <span className="mt-2 block font-display text-[clamp(2.25rem,5vw,4rem)] leading-none tracking-[-0.03em] transition-colors duration-300 group-hover:text-foreground-muted">
            {next.title}
          </span>
        </Link>
      </Container>
    </main>
  )
}
