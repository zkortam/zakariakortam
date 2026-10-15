import type { Metadata } from 'next'
import Image from 'next/image'
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
        <div className="ct-portrait" aria-hidden="true">
          <Image src="/portrait/zakaria-plate.webp" alt="" width={1485} height={1485} sizes="(min-width:1024px) 46vw, 90vw" quality={90} priority />
        </div>
        <div className="ct-body grid-main relative">
          <div className="col-span-4 md:col-span-8 lg:col-span-6">
            <h1 className="oc text-display" data-rise="">
              Say hello.
            </h1>
            <div className="ct-email" data-reveal="">
              <a href={`mailto:${EMAIL}`} className="u-box u-hover" data-email="">
                {EMAIL}
                <span aria-hidden="true" className="u-line" />
              </a>
              <CopyPill />
            </div>
            <div className="ct-topics" data-reveal="">
              {COPY.inquiries.map((q) => (
                <a key={q.label} href={`mailto:${EMAIL}?subject=${encodeURIComponent(q.subject)}`} className="ct-topic" title={q.body}>
                  {q.label}
                  <Icon name="arrow-up-right" size="1em" strokeWidth={2.25} className="ar" />
                </a>
              ))}
            </div>
            <ul className="ct-social" data-reveal="">
              {SOCIALS.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={`${s.label}, ${s.handle}, opens in a new tab`} title={`${s.label} ${s.handle}`}>
                    <Icon name={s.icon} size={24} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="ct-foot grid-main relative text-body">
          <span className="col-span-full">
            {LOCATION} · <span className="tnum">©{'\u00a0'}{YEAR}</span>
          </span>
        </p>
      </section>
    </main>
  )
}
