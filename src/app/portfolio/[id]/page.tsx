import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { earlierProjects, featuredProjects, projects, work, type Project } from '@/lib/projects-data'
import { PLATES } from '@/lib/media'
import Image from 'next/image'
import { Plate } from '@/components/Plate'
import { StatBand, Flow, Story, ResultCards, Chips, Gallery } from '@/components/Case'
import { OrgMark } from '@/components/ExperienceList'
import { SHOTS } from '@/components/EarlierCards'
import { Glyph } from '@/components/Glyph'
import { SurfHistory } from '@/components/SurfHistory'
import { ACCENT } from '@/lib/accent'
import { Footer } from '@/components/Footer'
import { ULink } from '@/components/ULink'
import { ProjectKeys } from '@/components/ProjectKeys'
import { DEMOS } from '@/components/demos'
import { PopOut } from '@/components/PopOut'
import { LivePill } from '@/components/LivePill'
import { NextRow } from '@/components/IndexRows'
import { domainOf, noWidow } from '@/lib/site'
import { pageMeta } from '@/lib/seo'
import { ProjectStructuredData } from '@/components/StructuredData'
import { HeroPreload } from '@/components/HeroPreload'

type Params = { params: Promise<{ id: string }> }

export function generateStaticParams() {
  return projects.map((p) => ({ id: p.id }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const p = projects.find((x) => x.id === id)
  if (!p) return {}
  const path = `/portfolio/${p.id}`
  const share = { image: `${path}/opengraph-image`, imageAlt: `${p.title}, by Zakaria Kortam` }
  if (p.kind === 'work') {
    const org = p.org ?? p.title
    return pageMeta({
      ...share,
      path,
      title: `${p.role} at ${org}`,
      description: fit(`${p.line} Zakaria Kortam, ${p.role} at ${org}, ${p.year}.`, p.line),
    })
  }
  return pageMeta({
    ...share,
    path,
    title: p.title,
    ogTitle: `${p.title}, by Zakaria Kortam`,
    description: p.line,
    type: 'article',
  })
}

/** Search snippets cut off near 155 characters; fall back to the plain line when the full one runs long. */
function fit(full: string, short: string) {
  return full.length <= 155 ? full : short
}

function nextIn(list: Project[], id: string) {
  const i = list.findIndex((p) => p.id === id)
  return list[(i + 1) % list.length]
}

function prevIn(list: Project[], id: string) {
  const i = list.findIndex((p) => p.id === id)
  return list[(i - 1 + list.length) % list.length]
}

function Overview({ p }: { p: Project }) {
  const rows: [string, React.ReactNode][] = [
    ['Role', p.role],
    ['When', p.year],
    ['Stack', <Chips key="s" items={p.stack} />],
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
            <dt className="meta c3 col-span-4 pt-[3px] md:col-span-2">{k}</dt>
            <dd className="col-span-4 md:col-span-3">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** The live demo, full width, under a heading. */
function DemoSection({ p }: { p: Project }) {
  const Demo = DEMOS[p.id]
  if (!Demo || !p.demo) return null
  return (
    <div className="grid-main mt-sec">
      <h2 className="oc col-span-4 pt-row text-statement md:col-span-5" data-rise="">
        {p.demo.title}
      </h2>
      <p className="col-span-4 mt-[24px] text-read md:col-span-5 md:col-start-7 md:mt-0 md:pt-row" data-reveal="">
        {noWidow(p.demo.line)}
      </p>
      <div className="col-span-full mt-head" data-reveal="">
        <PopOut title={`${p.title}: ${p.demo.title}`}>
          <Demo />
        </PopOut>
      </div>
    </div>
  )
}

/** The picture on an earlier project's opening: its live screen, or its drawing, in the dark. */
function RoleArt({ p }: { p: Project }) {
  const shot = SHOTS[p.id]
  if (shot) {
    return (
      <div className="role-art role-shot" aria-hidden="true" data-media="">
        <Image src={shot} alt="" width={1200} height={750} quality={82} sizes="(min-width:1024px) 40vw, 90vw" priority />
      </div>
    )
  }
  return (
    <div className="role-art role-glyph" aria-hidden="true">
      <Glyph id={p.id} />
    </div>
  )
}

export default async function ProjectPage({ params }: Params) {
  const { id } = await params
  const p = projects.find((x) => x.id === id)
  if (!p) notFound()
  const spec = PLATES[p.id]

  if (spec) {
    const next = nextIn(featuredProjects, p.id)
    const prev = prevIn(featuredProjects, p.id)
    const nextSpec = PLATES[next.id]
    return (
      <>
        <HeroPreload path={`/portfolio/${p.id}`} />
        <ProjectKeys prev={prev.id} next={next.id} prevTitle={prev.title} nextTitle={next.title} />
        <ProjectStructuredData p={p} />
        <main id="main" tabIndex={-1}>
          <Plate project={p} spec={spec} heading="h1" link={false} flipTarget showGithub />
          <section className="paper pt-sec" data-tone="light" style={{ ['--accent' as string]: ACCENT[p.id] }}>
            <Overview p={p} />
            <StatBand p={p} />
            <DemoSection p={p} />
            <Flow p={p} />
            {p.id === 'surf' && <SurfHistory />}
            <Story p={p} />
            <ResultCards p={p} />
            <div className="mt-stills" />
          </section>
          <Gallery spec={spec} live={p.links?.live} />
          {nextSpec && <Plate project={next} spec={nextSpec} line="Next project →" />}
        </main>
        <Footer />
      </>
    )
  }

  const list = p.kind === 'work' ? work : earlierProjects
  const next = nextIn(list, p.id)
  const prev = prevIn(list, p.id)
  return (
    <>
      <ProjectKeys prev={prev.id} next={next.id} prevTitle={prev.title} nextTitle={next.title} />
      <ProjectStructuredData p={p} />
      <main id="main" tabIndex={-1}>
        <section className="role-hero" data-tone="dark">
          <div aria-hidden="true" className="light light-rose" style={{ width: '100vmax', height: '100vmax', left: '70%', top: '30%', opacity: 0.8 }} />
          {p.kind === 'project' && <RoleArt p={p} />}
          <div className="grid-main relative">
            <h1 className="oc col-span-4 text-display md:col-span-12 lg:col-span-6" data-rise="">
              {p.title}
            </h1>
            <p className="plate-line col-span-4 mt-[16px] text-read md:col-span-10 lg:col-span-5 lg:col-start-7 lg:mt-0" style={{ color: 'var(--bone-92)' }} data-reveal="">
              {noWidow(p.line)}
            </p>
          </div>
          <div className="plate-foot grid-main relative mt-[48px]">
            <div className="role-meta" data-reveal="">
              {p.kind === 'work' && <OrgMark p={p} height={30} />}
              <p className="text-body" style={{ color: 'var(--bone-64)' }}>
                {p.role}, {p.year}
              </p>
            </div>
            {(p.links?.live || p.links?.github) && (
              <div className="pills" data-reveal="" data-align="end">
                {p.links?.github && <LivePill href={p.links.github} label="GitHub" />}
                {p.links?.live && <LivePill href={p.links.live} />}
              </div>
            )}
          </div>
        </section>
        <section className="paper pt-sec pb-sec" data-tone="light">
          <Overview p={p} />
          <StatBand p={p} />
          <DemoSection p={p} />
          <Story p={p} />
          <ResultCards p={p} />
          <div className="grid-main mt-sec">
            <NextRow href={`/portfolio/${next.id}`} title={next.title} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
