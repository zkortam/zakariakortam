import type { Metadata } from 'next'
import { Footer } from '@/components/Footer'
import { Principles } from '@/components/Principles'
import { TLink } from '@/components/TLink'
import { NOW, NOW_UPDATED } from '@/lib/voice'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta({
  path: '/now',
  title: 'Now',
  ogTitle: 'What Zakaria Kortam is doing now',
  description: 'What Zakaria Kortam is working on, building, and shipping right now, and the principles he builds by.',
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
            <ul className="col-span-full grid grid-cols-subgrid">
              {NOW.map((n) => (
                <li key={n.label} className="relative col-span-full grid grid-cols-subgrid py-row">
                  <span className="c3 col-span-4 text-read md:col-span-6" data-reveal="">
                    {n.label}
                  </span>
                  <span className="col-span-4 mt-[8px] text-read md:col-span-5 md:col-start-7 md:mt-0" data-reveal="">
                    {n.href ? (
                      <TLink href={n.href} className="u-group">
                        <span className="u-box">
                          {n.text}
                          <span aria-hidden="true" className="u-line" />
                        </span>
                      </TLink>
                    ) : (
                      n.text
                    )}
                  </span>
                </li>
              ))}
            </ul>
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
