import Image from 'next/image'
import type { Project } from '@/lib/projects-data'
import type { PlateSpec } from '@/lib/media'
import { noWidow, domainOf } from '@/lib/site'

/** The figures a project is measured by, large, four across. Counted from the repositories. */
export function StatBand({ p }: { p: Project }) {
  if (!p.stats?.length) return null
  return (
    <div className="grid-main mt-sec">
      <ul className="stats col-span-full">
        {p.stats.map((s, i) => (
          <li key={s.label} className="stat" data-reveal="" style={{ ['--d' as string]: `${i * 70}ms` }}>
            <span className="stat-v">{s.value}</span>
            <span className="stat-l">{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** How it works: four steps on a rail, numbered, left to right on wide screens and top to bottom on phones. */
export function Flow({ p }: { p: Project }) {
  if (!p.flow?.length) return null
  return (
    <div className="grid-main mt-sec">
      <h2 className="oc col-span-4 text-statement md:col-span-12" data-rise="">
        How it works
      </h2>
      <ol className="flow col-span-full mt-head">
        {p.flow.map((s, i) => (
          <li key={s.t} className="flow-step" data-reveal="" style={{ ['--d' as string]: `${i * 90}ms` }}>
            <span className="flow-n meta" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="flow-dot" aria-hidden="true" />
            <span className="flow-t">{s.t}</span>
            <span className="flow-d">{noWidow(s.d)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** The problem and the approach, side by side as two cards. */
export function Story({ p }: { p: Project }) {
  if (!p.problem && !p.approach) return null
  const parts = [
    p.problem && { k: 'The problem', v: p.problem },
    p.approach && { k: 'The approach', v: p.approach },
  ].filter(Boolean) as { k: string; v: string }[]
  return (
    <div className="grid-main mt-sec">
      <div className={`story col-span-full ${parts.length === 1 ? 'one' : ''}`}>
        {parts.map((x, i) => (
          <section key={x.k} className="story-card cardx" data-reveal="" style={{ ['--d' as string]: `${i * 90}ms` }}>
            <h2 className="meta story-k">{x.k}</h2>
            <p className="story-v">{noWidow(x.v)}</p>
          </section>
        ))}
      </div>
    </div>
  )
}

/** What shipped, as a grid of short claims, each with the accent tick. */
export function ResultCards({ p }: { p: Project }) {
  if (!p.results?.length) return null
  return (
    <div className="grid-main mt-sec">
      <h2 className="oc col-span-4 text-statement md:col-span-12" data-rise="">
        What shipped
      </h2>
      <ul className="results-grid col-span-full mt-head">
        {p.results.map((r, i) => (
          <li key={r} className="result cardx" data-reveal="" style={{ ['--d' as string]: `${(i % 4) * 70}ms` }}>
            <svg viewBox="0 0 20 20" className="result-tick" aria-hidden="true">
              <circle cx="10" cy="10" r="10" />
              <path d="M6 10.4l2.7 2.6L14 7.6" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{noWidow(r)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The stack as chips. */
export function Chips({ items }: { items: string[] }) {
  return (
    <ul className="chips">
      {items.map((s) => (
        <li key={s}>{s}</li>
      ))}
    </ul>
  )
}

/** The product in the wild: the live site in a browser window, beside the same site on a phone. */
export function Gallery({ spec, live }: { spec: PlateSpec; live?: string }) {
  const { a, b1 } = spec.stills
  return (
    <section className="paper pb-sec" data-tone="light">
      <div className="grid-main">
        <div className="gal col-span-full">
          <figure className="gal-browser" data-media="">
            <div className="gal-bar" aria-hidden="true">
              <i />
              <i />
              <i />
              {live && <span className="gal-url">{domainOf(live)}</span>}
            </div>
            <Image src={a.src} alt={a.alt} width={a.w} height={a.h} quality={82} sizes="(min-width:1024px) 66vw, 100vw" className="block h-auto w-full" />
          </figure>
          <figure className="gal-phone" data-media="" style={{ ['--d' as string]: '120ms' }}>
            <Image src={b1.src} alt={b1.alt} width={b1.w} height={b1.h} quality={82} sizes="(min-width:1024px) 22vw, 46vw" className="block h-auto w-full" />
          </figure>
        </div>
      </div>
    </section>
  )
}
