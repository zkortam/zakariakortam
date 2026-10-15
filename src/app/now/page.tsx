import type { Metadata } from 'next'
import { Footer } from '@/components/Footer'
import { TLink } from '@/components/TLink'
import { Icon } from '@/components/Icon'
import { NOW, NOW_UPDATED } from '@/lib/voice'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta({
  path: '/now',
  title: 'Now',
  ogTitle: 'What Zakaria Kortam is doing now',
  description: 'What Zakaria Kortam is working on, building, and shipping right now.',
})

export default function NowPage() {
  return (
    <>
      <main id="main" tabIndex={-1}>
        <section className="paper pt-page pb-sec" data-tone="light">
          <div className="grid-main">
            <h1 className="oc col-span-4 text-display md:col-span-12" data-rise="">
              Now
            </h1>
            <p className="c3 col-span-4 mt-[16px] text-body md:col-span-6" data-reveal="">
              Updated {NOW_UPDATED}.
            </p>
          </div>

          <div className="grid-main mt-head">
            <ul className="rows col-span-full grid grid-cols-subgrid">
              {NOW.map((n) => {
                const row = (
                  <>
                    <span className="c3 col-span-4 text-body md:col-span-3" data-reveal="">
                      {n.label}
                    </span>
                    <span className="col-span-4 mt-[4px] text-read md:col-span-8 md:col-start-4 md:mt-0" data-reveal="">
                      <span className={n.href ? 'u-box' : undefined}>
                        {n.text}
                        {n.href && <span aria-hidden="true" className="u-line" />}
                      </span>
                    </span>
                    {n.href && (
                      <span className="hidden text-right text-read md:col-start-12 md:block" aria-hidden="true">
                        <span className="arrow-shift">
                          <Icon name="arrow-right" size="0.9em" strokeWidth={2.25} className="ar" />
                        </span>
                      </span>
                    )}
                  </>
                )
                return (
                  <li key={n.label} className="row col-span-full grid grid-cols-subgrid">
                    {n.href ? (
                      <TLink href={n.href} className="u-group col-span-full grid grid-cols-subgrid items-baseline py-[20px] md:py-[28px]">
                        {row}
                      </TLink>
                    ) : (
                      <div className="col-span-full grid grid-cols-subgrid items-baseline py-[20px] md:py-[28px]">{row}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
