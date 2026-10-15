import type { Metadata } from 'next'
import { CopyPill } from '@/components/CopyPill'
import { COPY, EMAIL, LOCATION, SOCIALS, YEAR } from '@/lib/site'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta({
  path: '/contact',
  title: 'Contact',
  ogTitle: 'Contact Zakaria Kortam',
  description: `Contact Zakaria Kortam by email at ${EMAIL}, or find him on LinkedIn, GitHub, X, and Instagram.`,
})

export default function ContactPage() {
  return (
    <main id="main" tabIndex={-1}>
      <section className="contact tone-dark" data-tone="dark">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="light light-rose" style={{ width: '110vmax', height: '110vmax', left: '70%', top: '30%' }} />
          <div className="light light-amber" style={{ width: '100vmax', height: '100vmax', left: '25%', top: '85%' }} />
        </div>
        <div className="relative">
          <div className="grid-main">
            <h1 className="oc col-span-4 text-statement md:col-span-8" data-rise="">
              {COPY.contactHead}
            </h1>
          </div>
          <div className="grid-main contact-email">
            <div className="fit-wrap col-span-4 md:col-span-12" data-reveal="">
              <a href={`mailto:${EMAIL}`} className="fit-email u-box u-hover" data-email="">
                {EMAIL}
                <span aria-hidden="true" className="u-line thick" />
              </a>
            </div>
            <div className="col-span-4 mt-[24px] md:col-span-12" data-reveal="">
              <CopyPill />
            </div>
          </div>
          <div className="grid-main contact-links">
            <ul className="rows col-span-4 grid grid-cols-subgrid md:col-span-6 md:col-start-7">
              {SOCIALS.map((s) => (
                <li key={s.label} className="row col-span-full grid grid-cols-subgrid">
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${s.label}, ${s.handle}, opens in a new tab`}
                    className="u-group col-span-full grid grid-cols-subgrid items-baseline py-[16px] text-read md:py-[20px]"
                  >
                    <span className="col-span-4 md:col-span-3" data-reveal="">
                      <span className="u-box">
                        {s.label}
                        <span aria-hidden="true" className="u-line" />
                      </span>
                    </span>
                    <span className="col-span-4 md:col-span-3 md:text-right" style={{ color: 'var(--bone-64)' }} data-reveal="" data-align="end">
                      {s.handle}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid-main contact-foot text-body" style={{ color: 'var(--bone-64)' }}>
            <span className="col-span-2 md:col-span-6">{LOCATION}</span>
            <span className="tnum col-span-2 text-right md:col-span-6" data-align="end">
              © {YEAR}
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}
