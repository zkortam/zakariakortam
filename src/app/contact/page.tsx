import type { Metadata } from 'next'
import { CopyPill } from '@/components/CopyPill'
import { Icon } from '@/components/Icon'
import { COPY, EMAIL, LOCATION, SOCIALS, YEAR } from '@/lib/site'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta({
  path: '/contact',
  title: 'Contact',
  ogTitle: 'Contact Zakaria Kortam',
  description: `Contact Zakaria Kortam for consulting on product design and AI implementation, opportunities, or general questions. Email ${EMAIL}.`,
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
          <div className="grid-main contact-inq">
            {COPY.inquiries.map((q) => (
              <a
                key={q.label}
                href={`mailto:${EMAIL}?subject=${encodeURIComponent(q.subject)}`}
                className="u-group col-span-4 block py-[20px] md:col-span-4"
                data-reveal=""
              >
                <span className="text-read block font-medium">
                  <span className="u-box">
                    {q.label}
                    <span aria-hidden="true" className="u-line" />
                  </span>
                </span>
                <span className="mt-[8px] block max-w-[34ch] text-body" style={{ color: 'var(--bone-64)' }}>
                  {q.body}
                </span>
              </a>
            ))}
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
                    className="u-group col-span-full flex items-center gap-[16px] py-[14px] text-read md:py-[18px]"
                    data-reveal=""
                  >
                    <Icon name={s.icon} size={24} style={{ color: 'var(--bone-64)', flex: 'none' }} />
                    <span className="u-box">
                      {s.handle}
                      <span aria-hidden="true" className="u-line" />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid-main contact-foot text-body" style={{ color: 'var(--bone-64)' }}>
            <span className="col-span-2 md:col-span-6">{LOCATION}</span>
            <span className="tnum col-span-2 text-right md:col-span-6" data-align="end">
              ©{'\u00a0'}{YEAR}
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}
