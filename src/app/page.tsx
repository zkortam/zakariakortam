import { HomeHero } from '@/components/HomeHero'
import { Footer } from '@/components/Footer'
import { TLink } from '@/components/TLink'
import { Bento } from '@/components/Bento'
import { COPY } from '@/lib/site'
import { Icon } from '@/components/Icon'

export default function HomePage() {
  return (
    <>
      <link rel="preload" as="image" href="/light/bloom.webp" />
      <main id="main" tabIndex={-1}>
        <HomeHero />

        <section className="paper pt-statement" data-tone="light">
          <div className="grid-main">
            <p className="oc col-span-4 text-statement md:col-span-12 lg:col-span-11" data-rise="">
              {COPY.statementLead} <span className="c-ink50">{COPY.statementRest}</span>
            </p>
          </div>
        </section>

        <section className="paper pb-sec" data-tone="light">
          <div className="grid-main">
            <Bento />
          </div>
        </section>

        <section className="paper sec-pad" data-tone="light">
          <div className="grid-main">
            <div className="rows-solo col-span-full">
              <TLink href="/portfolio" className="u-group relative block py-row">
                <span className="flex items-end justify-between gap-[24px]">
                  <span className="oc text-statement" data-reveal="">
                    <span className="u-box">
                      {COPY.allWork}
                      <span aria-hidden="true" className="u-line thick" />
                    </span>
                  </span>
                  <span className="text-statement" aria-hidden="true" data-reveal="" data-align="end">
                    <span className="arrow-shift"><Icon name="arrow-right" size="0.78em" strokeWidth={2.25} className="ar" /></span>
                  </span>
                </span>
              </TLink>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  )
}
