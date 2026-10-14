import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { projects } from '@/lib/projects-data'
import { Grid } from '@/components/Container'
import { Fade, Rule, SectionHead } from '@/components/Motion'
import { Backdrop } from '@/components/Work'

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
const linkCls = 'underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-white'

export default async function ProjectPage({ params }: Params) {
  const { id } = await params
  const idx = projects.findIndex((p) => p.id === id)
  if (idx < 0) notFound()
  const p = projects[idx]
  const next = projects[(idx + 1) % projects.length]

  const meta: [string, React.ReactNode][] = [
    ['Role', p.role],
    ['When', p.year],
    [p.kind === 'work' ? 'Company' : 'Type', p.org ?? 'Independent'],
    [
      'Links',
      p.links?.live || p.links?.github ? (
        <span className="flex flex-col">
          {p.links?.live && (
            <a href={p.links.live} target="_blank" rel="noopener noreferrer" className={linkCls}>
              {host(p.links.live)}
            </a>
          )}
          {p.links?.github && (
            <a href={p.links.github} target="_blank" rel="noopener noreferrer" className={linkCls}>
              GitHub
            </a>
          )}
        </span>
      ) : (
        <span className="text-foreground-subtle">None</span>
      ),
    ],
  ]

  const sections = [
    ['Overview', p.overview],
    ['Problem', p.problem],
    ['Approach', p.approach],
  ].filter(([, v]) => v) as [string, string][]

  return (
    <main>
      <Grid className="gap-y-10 pt-36 sm:pt-48">
        <Fade now className="lg:col-span-6">
          <h1 className="font-display text-title">{p.title}</h1>
        </Fade>
        <Fade now delay={0.15} className="text-statement text-balance lg:col-span-5 lg:col-start-7 lg:pt-3">
          {p.line}
        </Fade>
      </Grid>

      <Grid className="mt-20 gap-y-8 sm:mt-28">
        {meta.map(([k, v], i) => (
          <Fade key={k} now delay={0.25 + i * 0.05} className="text-[15px] lg:col-span-3">
            <Rule className="mb-4" delay={0.2 + i * 0.05} />
            <div className="text-foreground-subtle">{k}</div>
            <div className="mt-1">{v}</div>
          </Fade>
        ))}
      </Grid>

      {p.image && (
        <Grid className="mt-16 sm:mt-24">
          <Fade className="lg:col-span-12">
            <Backdrop p={p} ratio="aspect-[4/3] sm:aspect-[16/9]" priority />
          </Fade>
        </Grid>
      )}

      <Grid className="mt-28 gap-y-16 sm:mt-40 sm:gap-y-24">
        {sections.map(([label, text]) => (
          <Row key={label} label={label}>
            {text}
          </Row>
        ))}
        {p.results && (
          <Row label="Results">
            <ul>
              {p.results.map((r) => (
                <li key={r} className="border-b border-white/[0.12] py-3 first:pt-0">
                  {r}
                </li>
              ))}
            </ul>
          </Row>
        )}
        <Row label="Built with">{p.stack.join(', ')}</Row>
      </Grid>

      <Grid className="mt-36 sm:mt-52">
        <SectionHead n="Next">{next.kind === 'work' ? 'Role' : 'Project'}</SectionHead>
        <Link href={`/portfolio/${next.id}`} className="group mt-8 block lg:col-span-12">
          <span className="font-display text-title transition-colors duration-500 group-hover:text-foreground-muted">
            {next.title}
          </span>
        </Link>
      </Grid>
    </main>
  )
}

/** Label at column 1, text at column 7. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Fade className="grid gap-3 lg:col-span-12 lg:grid-cols-12 lg:gap-x-5">
      <h2 className="text-[15px] text-foreground-muted lg:col-span-6">{label}</h2>
      <div className="text-prose text-pretty lg:col-span-5 lg:col-start-7">{children}</div>
    </Fade>
  )
}
