import type { Metadata } from 'next'
import Image from 'next/image'
import { ExperienceList } from '@/components/ExperienceList'
import { Footer } from '@/components/Footer'
import { Reel } from '@/components/Reel'
import { LocalTime } from '@/components/LocalTime'
import { COPY, LOCATION, noWidow } from '@/lib/site'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta({
  path: '/about',
  title: 'About',
  ogTitle: 'About Zakaria Kortam',
  type: 'profile',
  description:
    'Zakaria Kortam is a Product Manager at DigiCert who takes products from zero to one, end to end. UC San Diego EE, based in San Jose.',
})

/** One line drawing per discipline, on the same grid and stroke as the project drawings. */
const ICON: Record<string, React.ReactNode> = {
  Product: <path d="M12 4l8 4.5v7L12 20l-8-4.5v-7zM12 4v16M4 8.5l8 4.5 8-4.5" />,
  Design: <path d="M4 20l4-1 11-11-3-3L5 16zM14 7l3 3" />,
  Building: <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />,
  AI: <path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0" />,
  Cloud: <path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z" />,
  Shipping: <path d="M5 19c3-1 4-3 4-3l-2-2s-2 1-3 4zM9 16l6-6c2-2 5-5 5-6-1 0-4 3-6 5l-6 6M14 10l1 4-3 3M10 6l4-1" />,
}

/** Figures for the side panel, each one backed elsewhere on the site. */
const FACTS = [
  { v: '2021', l: 'started Surf, now on version 4' },
  { v: '6', l: 'products live today' },
  { v: '3', l: 'associate degrees before UC San Diego' },
  { v: '2026', l: 'B.S. Electrical Engineering' },
]

export default function AboutPage() {
  return (
    <>
      <main id="main" tabIndex={-1}>
        <section className="paper pt-page pb-sec" data-tone="light">
          <div className="grid-main items-end">
            <h1 className="oc col-span-4 text-statement md:col-span-7" data-rise="">
              {COPY.aboutHead}
            </h1>
            <figure className="about-portrait col-span-4 mt-[48px] md:col-span-4 md:col-start-9 md:mt-0" data-media="">
              <Image
                src="/portrait/zakaria-paper.webp"
                width={1485}
                height={1485}
                quality={90}
                priority
                sizes="(min-width:1024px) 31vw, (min-width:768px) 34vw, 92vw"
                alt="Zakaria Kortam"
                className="block aspect-square h-auto w-full object-cover"
              />
              <figcaption className="about-tag">
                <span className="about-live" aria-hidden="true" />
                <span>{LOCATION}</span>
                <span className="c3">
                  <LocalTime />
                </span>
              </figcaption>
            </figure>
          </div>

          <div className="grid-main mt-big">
            <p className="quote col-span-4 md:col-span-11" data-reveal="">
              “{COPY.aboutQuote}”
            </p>
          </div>

          <div className="grid-main mt-sec items-start">
            <div className="col-span-4 flex flex-col gap-[28px] text-read md:col-span-6">
              {COPY.aboutStory.map((s) => (
                <p key={s} data-reveal="">
                  {noWidow(s)}
                </p>
              ))}
            </div>
            <ul className="facts col-span-4 mt-[48px] md:col-span-5 md:col-start-8 md:mt-0">
              {FACTS.map((f, i) => (
                <li key={f.l} className="fact cardx" data-reveal="" style={{ ['--d' as string]: `${i * 70}ms` }}>
                  <span className="fact-v">{f.v}</span>
                  <span className="fact-l">{f.l}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="paper pb-sec" data-tone="light" aria-label="Products">
          <Reel />
        </section>

        <section className="paper pb-sec" data-tone="light">
          <div className="grid-main">
            <h2 className="oc col-span-4 text-display md:col-span-12" data-rise="">
              Experience
            </h2>
            <div className="mt-head col-span-full">
              <ExperienceList />
            </div>
          </div>

          <div className="grid-main mt-big">
            <h2 className="oc col-span-4 text-display md:col-span-12" data-rise="">
              How I work
            </h2>
            <ul className="skills col-span-full mt-head">
              {COPY.tools.map((t, i) => (
                <li key={t.label} className="skill cardx" data-light="" data-reveal="" style={{ ['--d' as string]: `${(i % 3) * 70}ms` }}>
                  <svg viewBox="0 0 24 24" className="skill-i" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    {ICON[t.label]}
                  </svg>
                  <h3 className="skill-t">{t.label}</h3>
                  <p className="skill-v">{noWidow(t.value)}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid-main mt-big">
            <h2 className="oc col-span-4 text-display md:col-span-12" data-rise="">
              Education
            </h2>
            <ul className="edu col-span-full mt-head">
              {COPY.education.map((e, i) => (
                <li key={e.label} className="edu-card cardx" data-reveal="" style={{ ['--d' as string]: `${i * 80}ms` }}>
                  <span className="meta c3">{i === 0 ? 'Bachelor’s' : 'Associate'}</span>
                  <span className="edu-t">{e.label}</span>
                  <span className="edu-v">{e.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
