import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { earlierProjects, featuredProjects, projects, work, type Project } from '@/lib/projects-data'
import { PLATES } from '@/lib/media'
import { Plate } from '@/components/Plate'
import { Stills } from '@/components/Stills'
import { Footer } from '@/components/Footer'
import { ULink } from '@/components/ULink'
import { LivePill } from '@/components/LivePill'
import { Rule } from '@/components/Rule'
import { NextRow } from '@/components/IndexRows'
import { domainOf, noWidow } from '@/lib/site'

type Params = { params: Promise<{ id: string }> }

export function generateStaticParams() {
  return projects.map((p) => ({ id: p.id }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const p = projects.find((x) => x.id === id)
  return p ? { title: p.title, description: p.line } : {}
}

function nextIn(list: Project[], id: string) {
  const i = list.findIndex((p) => p.id === id)
  return list[(i + 1) % list.length]
}

function Overview({ p }: { p: Project }) {
  const rows: [string, React.ReactNode][] = [
    ['Role', p.role],
    ['When', p.year],
    ['Stack', noWidow(p.stack.join(', '))],
  ]
  if (p.links?.live || p.links?.github) {
    rows.push([
      'Links',
      <span key="l" className="flex flex-wrap gap-x-[16px]">
        {p.links?.live && <ULink href={p.links.live} label={domainOf(p.links.live)}>{domainOf(p.links.live)}</ULink>}
        {p.links?.github && <ULink href={p.links.github} label="GitHub">GitHub</ULink>}
      </span>,
    ])
  }
  return (
    <div className="grid-main">
      <p className="col-span-4 text-read md:col-span-5 md:col-start-7 md:row-start-1" data-reveal="">
        {noWidow(p.overview)}
      </p>
      <dl className="col-span-4 mt-[48px] grid grid-cols-subgrid gap-y-[12px] text-body md:col-span-5 md:col-start-1 md:row-start-1 md:mt-0" data-reveal="">
        {rows.map(([k, v]) => (
          <div key={k} className="col-span-full grid grid-cols-subgrid">
            <dt className="c3 col-span-4 md:col-span-2">{k}</dt>
            <dd className="col-span-4 md:col-span-3">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function Block({ title, children, first = false }: { title: string; children: React.ReactNode; first?: boolean }) {
  return (
    <div className={`grid-main ${first ? '' : 'mt-sec'}`}>
      <Rule className="col-span-full" />
      <h2 className="oc col-span-4 pt-row text-statement md:col-span-5" data-rise="">
        {title}
      </h2>
      <div className="col-span-4 mt-[24px] md:col-span-5 md:col-start-7 md:mt-0 md:pt-row">{children}</div>
    </div>
  )
}

function Narrative({ p }: { p: Project }) {
  return (
    <>
      {p.problem && (
        <Block title="The problem">
          <p className="text-read" data-reveal="">
            {noWidow(p.problem)}
          </p>
        </Block>
      )}
      {p.approach && (
        <Block title="The approach">
          <p className="text-read" data-reveal="">
            {noWidow(p.approach)}
          </p>
        </Block>
      )}
    </>
  )
}

function Results({ p, first = false }: { p: Project; first?: boolean }) {
  if (!p.results?.length) return null
  return (
    <Block title="Results" first={first}>
      <ul className="text-read">
        {p.results.map((r) => (
          <li key={r} className="relative py-[16px] md:py-[20px]" data-reveal="">
            <span aria-hidden="true" className="rule absolute left-0 right-0 top-0" />
            {noWidow(r)}
          </li>
        ))}
      </ul>
    </Block>
  )
}

export default async function ProjectPage({ params }: Params) {
  const { id } = await params
  const p = projects.find((x) => x.id === id)
  if (!p) notFound()
  const spec = PLATES[p.id]

  if (spec) {
    const next = nextIn(featuredProjects, p.id)
    const nextSpec = PLATES[next.id]
    return (
      <>
        <main id="main" tabIndex={-1}>
          <Plate project={p} spec={spec} heading="h1" link={false} flipTarget showGithub />
          <section className="paper pt-sec" data-tone="light">
            <Overview p={p} />
            <Narrative p={p} />
            <div className="mt-stills" />
          </section>
          <Stills spec={spec} />
          {p.results?.length ? (
            <section className="paper pb-sec" data-tone="light">
              <Results p={p} first />
            </section>
          ) : null}
          {nextSpec && <Plate project={next} spec={nextSpec} line="Next project →" />}
        </main>
        <Footer />
      </>
    )
  }

  const next = p.kind === 'work' ? nextIn(work, p.id) : nextIn(earlierProjects, p.id)
  return (
    <>
      <main id="main" tabIndex={-1}>
        <section className="role-hero" data-tone="dark">
          <div aria-hidden="true" className="light light-rose" style={{ width: '100vmax', height: '100vmax', left: '70%', top: '30%', opacity: 0.8 }} />
          <div className="grid-main relative">
            <h1 className="oc col-span-4 text-display md:col-span-12 lg:col-span-6" data-rise="">
              {p.title}
            </h1>
            <p className="plate-line col-span-4 mt-[16px] text-read md:col-span-10 lg:col-span-5 lg:col-start-7 lg:mt-0" style={{ color: 'var(--bone-92)' }} data-reveal="">
              {noWidow(p.line)}
            </p>
          </div>
          <div className="plate-foot grid-main relative mt-[48px]">
            <p className="text-body" style={{ color: 'var(--bone-64)' }} data-reveal="">
              {p.role}, {p.year}
            </p>
            {p.links?.live && (
              <div className="pills" data-reveal="" data-align="end">
                <LivePill href={p.links.live} />
              </div>
            )}
          </div>
        </section>
        <section className="paper pt-sec pb-sec" data-tone="light">
          <Overview p={p} />
          <Narrative p={p} />
          <Results p={p} />
          <div className="grid-main mt-sec">
            <NextRow href={`/portfolio/${next.id}`} title={next.title} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
