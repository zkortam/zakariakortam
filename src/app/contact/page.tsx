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
            <div className="contact-line col-span-full" data-reveal="">
              <a href={`mailto:${EMAIL}`} className="fit-email u-box u-hover" data-email="">
                {EMAIL}
                <span aria-hidden="true" className="u-line thick" />
              </a>
              <CopyPill />
            </div>
          </div>
          <div className="grid-main contact-groups">
            <div className="col-span-4 md:col-span-6">
              <h2 className="c3 text-body" data-reveal="">
                Write about
              </h2>
              <ul className="rows mt-[12px]">
                {COPY.inquiries.map((q) => (
                  <li key={q.label} className="row">
                    <a href={`mailto:${EMAIL}?subject=${encodeURIComponent(q.subject)}`} className="u-group contact-row" data-reveal="">
                      <span className="text-read">
                        <span className="u-box">
                          {q.label}
                          <span aria-hidden="true" className="u-line" />
                        </span>
                        <span className="contact-sub text-body">{q.body}</span>
                      </span>
                      <Icon name="arrow-right" size={22} strokeWidth={2.25} className="contact-ar" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-span-4 mt-[56px] md:col-span-5 md:col-start-8 md:mt-0">
              <h2 className="c3 text-body" data-reveal="">
                Elsewhere
              </h2>
              <ul className="rows mt-[12px]">
                {SOCIALS.map((s) => (
                  <li key={s.label} className="row">
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${s.label}, ${s.handle}, opens in a new tab`}
                      className="u-group contact-row"
                      data-reveal=""
                    >
                      <span className="flex items-center gap-[14px] text-read">
                        <Icon name={s.icon} size={22} style={{ color: 'var(--bone-64)', flex: 'none' }} />
                        <span className="u-box">
                          {s.handle}
                          <span aria-hidden="true" className="u-line" />
                        </span>
                      </span>
                      <Icon name="arrow-up-right" size={22} strokeWidth={2.25} className="contact-ar" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="grid-main contact-foot text-body" style={{ color: 'var(--bone-64)' }}>
            <span className="col-span-full">
              {LOCATION} · <span className="tnum">©{'\u00a0'}{YEAR}</span>
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}
