import { HomeHero } from '@/components/HomeHero'
import { Plate } from '@/components/Plate'
import { ExperienceList } from '@/components/ExperienceList'
import { Footer } from '@/components/Footer'
import { TLink } from '@/components/TLink'
import { BodyOfWork } from '@/components/BodyOfWork'
import { featuredProjects } from '@/lib/projects-data'
import { PLATES } from '@/lib/media'
import { COPY } from '@/lib/site'

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
            <BodyOfWork />
            <p className="c3 col-span-4 mt-[32px] text-body md:col-span-6" data-reveal="">
              Counted from the repositories of Surf, Helio, SPICE++, RTL++, AiroFind, Wingman, and the Surf site.
            </p>
          </div>
        </section>

        {featuredProjects.map((p) => {
          const spec = PLATES[p.id]
          return spec ? <Plate key={p.id} project={p} spec={spec} /> : null
        })}

        <section className="paper pt-sec" data-tone="light">
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
                    <span className="arrow-shift">→</span>
                  </span>
                </span>
              </TLink>
            </div>
          </div>
        </section>

        <section className="paper sec-pad" data-tone="light">
          <div className="grid-main">
            <h2 className="oc col-span-4 text-display md:col-span-12" data-rise="">
              Experience
            </h2>
            <div className="mt-head col-span-full grid grid-cols-subgrid">
              <ExperienceList />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
