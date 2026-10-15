import Image from 'next/image'
import { FooterLight } from './FooterLight'
import { Wordmark } from './Wordmark'
import { ULink } from './ULink'
import { TLink } from './TLink'
import { CopyPill } from './CopyPill'
import { LocalTime } from './LocalTime'
import { EMAIL, LOCATION, NAV, SOCIALS, YEAR } from '@/lib/site'
import { featuredProjects } from '@/lib/projects-data'

/** End credits: the ask, every product one tap away, then the name. */
export function Footer() {
  return (
    <footer className="footer relative overflow-hidden" data-tone="dark">
      <FooterLight />
      <div className="footer-inner relative">
        <div>
          <div className="grid-main items-end">
            <p className="c1 oc col-span-4 text-statement md:col-span-7" data-rise="">
              Have something to build? <span style={{ color: 'var(--bone-64)' }}>Email is best.</span>
            </p>
            <div className="col-span-4 mt-[28px] flex flex-col gap-[16px] md:col-span-5 md:col-start-8 md:mt-0 md:items-end" data-reveal="">
              <p className="c1 text-read">
                <ULink href={`mailto:${EMAIL}`}>
                  <span data-email="">{EMAIL}</span>
                </ULink>
              </p>
              <div className="flex flex-wrap items-center gap-[12px]">
                <CopyPill />
                <span className="text-body" style={{ color: 'var(--bone-64)' }}>
                  Usually replies within a day
                </span>
              </div>
            </div>
          </div>

          <ul className="foot-work grid-main" data-reveal="">
            {featuredProjects.map((p) => (
              <li key={p.id} className="col-span-2 md:col-span-4 lg:col-span-2">
                <TLink href={`/portfolio/${p.id}`} className="foot-proj">
                  <Image src={`/work/thumb/${p.id}.webp`} alt="" width={96} height={96} sizes="40px" quality={82} />
                  <span>{p.title}</span>
                </TLink>
              </li>
            ))}
          </ul>

          <div className="grid-main footer-row2 text-body">
            <ul className="col-span-2 flex flex-col gap-[6px] md:col-start-7" data-reveal="">
              {NAV.map((l) => (
                <li key={l.href}>
                  <TLink href={l.href} className="flink">
                    {l.label}
                  </TLink>
                </li>
              ))}
            </ul>
            <ul className="col-span-2 flex flex-col gap-[6px] md:col-start-9" data-reveal="">
              {SOCIALS.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={`${s.label}, opens in a new tab`} className="flink">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="c3 col-span-4 mt-[32px] flex flex-col gap-[6px] md:col-span-2 md:col-start-11 md:mt-0 md:text-right md:whitespace-nowrap" data-reveal="" data-align="end">
              <span className="inline-flex items-center gap-[8px] md:justify-end">
                <span className="about-live" aria-hidden="true" />
                {LOCATION}
              </span>
              <LocalTime />
              <span className="tnum">©{' '}{YEAR}</span>
            </div>
          </div>
        </div>
        <div className="grid-main footer-wm">
          <Wordmark as="p" className="wm-foot col-span-4 md:col-span-12" />
        </div>
      </div>
    </footer>
  )
}
