import { HomeHero } from '@/components/HomeHero'
import { Footer } from '@/components/Footer'
import { TLink } from '@/components/TLink'
import { Bento } from '@/components/Bento'
import { ScrollWords } from '@/components/ScrollWords'
import { COPY } from '@/lib/site'
import { Icon } from '@/components/Icon'

export default function HomePage() {
  return (
    <>
      <link rel="preload" as="image" href="/light/bloom.webp" />
      <main id="main" tabIndex={-1}>
        <HomeHero />

        <section className="paper sw-pin" data-tone="light">
          <div className="sw-stage">
            <div className="grid-main">
              <p className="col-span-4 text-statement md:col-span-12 lg:col-span-11">
                <ScrollWords lead={COPY.statementLead} rest={COPY.statementRest} />
              </p>
            </div>
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
