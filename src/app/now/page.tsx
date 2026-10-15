import type { Metadata } from 'next'
import Image from 'next/image'
import { Footer } from '@/components/Footer'
import { Principles } from '@/components/Principles'
import { CommitHeat } from '@/components/CommitHeat'
import { LocalTime } from '@/components/LocalTime'
import { TLink } from '@/components/TLink'
import { OrgMark } from '@/components/ExperienceList'
import { NOW, NOW_UPDATED } from '@/lib/voice'
import { ACTIVITY } from '@/lib/figures'
import { projects } from '@/lib/projects-data'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta({
  path: '/now',
  title: 'Now',
  ogTitle: 'What Zakaria Kortam is doing now',
  description: 'What Zakaria Kortam is working on, building, and shipping right now, and the principles he builds by.',
})

/** The picture a Now card leads with: the product's own screen, or the company's mark. */
function Art({ href }: { href?: string }) {
  const id = href?.split('/').pop()
  const p = projects.find((x) => x.id === id)
  if (p?.kind === 'work') return <span className="now-art now-logo"><OrgMark p={p} height={26} /></span>
  if (id) {
    return (
      <span className="now-art">
        <Image src={`/work/thumb/${id}.webp`} alt="" width={192} height={192} sizes="64px" quality={82} />
      </span>
    )
  }
  return <span className="now-art now-site" aria-hidden="true">Z</span>
}

export default function NowPage() {
  return (
    <>
      <main id="main" tabIndex={-1}>
        <section className="paper pt-page pb-sec" data-tone="light">
          <div className="grid-main items-end">
            <h1 className="oc col-span-4 text-display md:col-span-6" data-rise="">
              Now
            </h1>
            <p className="now-stamp col-span-4 mt-[20px] md:col-span-6 md:mt-0 md:text-right" data-reveal="">
              <span className="about-live" aria-hidden="true" />
              <span>Updated {NOW_UPDATED}</span>
              <span className="c3">
                <LocalTime />
              </span>
            </p>
          </div>

          <ul className="now-grid grid-main mt-head">
            {NOW.map((n, i) => {
              const body = (
                <>
                  <span className="now-top">
                    <Art href={n.href} />
                    <span className="meta c3">{n.label}</span>
                  </span>
                  <span className="now-t">{n.text}</span>
                  {n.href && <span className="now-go" aria-hidden="true">→</span>}
                </>
              )
              return (
                <li key={n.label} className={`col-span-4 ${i === 0 ? 'md:col-span-12 lg:col-span-6' : 'md:col-span-6 lg:col-span-3'}`} data-reveal="" style={{ ['--d' as string]: `${i * 60}ms` }}>
                  {n.href ? (
                    <TLink href={n.href} className="now-card cardx" data-light="">
                      {body}
                    </TLink>
                  ) : (
                    <div className="now-card cardx">{body}</div>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="grid-main mt-big">
            <div className="col-span-full flex flex-wrap items-end justify-between gap-x-[24px] gap-y-[12px]">
              <h2 className="oc text-statement" data-rise="">
                {ACTIVITY.year}, day by day
              </h2>
              <p className="meta c3" data-reveal="">
                {ACTIVITY.total.toLocaleString('en-US')} commits across Surf, Helio, and AiroFind
              </p>
            </div>
            <div className="col-span-full mt-[36px]">
              <CommitHeat />
            </div>
          </div>

          <div className="grid-main mt-big">
            <h2 className="oc col-span-4 text-display md:col-span-12" data-rise="">
              Principles
            </h2>
            <Principles />
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
