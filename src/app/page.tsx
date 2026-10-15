import Image from 'next/image'
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
            <div className="sw-card" data-tone="dark">
              <div className="sw-photo" aria-hidden="true">
                <Image src="/about/ive.webp" alt="" fill sizes="(min-width:1024px) 60vw, 100vw" quality={90} />
              </div>
              <figure className="sw-quote">
                <blockquote className="text-statement">
                  <ScrollWords lead={COPY.statementLead} rest={COPY.statementRest} />
                </blockquote>
                <figcaption className="sw-by text-read">{COPY.statementBy}</figcaption>
              </figure>
              <a className="sw-credit" href="https://commons.wikimedia.org/wiki/File:Jonathan_Ive_2009.jpg" target="_blank" rel="noopener noreferrer">
                Photo: Gary Cohen, CC BY-SA 2.0
              </a>
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
