import type { Metadata } from 'next'
import Image from 'next/image'
import { ExperienceList } from '@/components/ExperienceList'
import { Footer } from '@/components/Footer'
import { COPY, noWidow } from '@/lib/site'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta({
  path: '/about',
  title: 'About',
  ogTitle: 'About Zakaria Kortam',
  type: 'profile',
  description:
    'Zakaria Kortam is an Associate Innovation Product Manager at DigiCert who takes products from zero to one, end to end. UC San Diego EE, based in San Jose.',
})

/** Photos from Wikimedia Commons, credited as their licenses ask. */
const SAN_JOSE = {
  credit: 'Photo: Ben Loomis, CC BY 2.0',
  href: 'https://commons.wikimedia.org/wiki/File:San_Jose_CA_skyline_at_night_2014.jpg',
}
const SCHOOLS = [
  {
    name: 'UC San Diego',
    degree: 'B.S. Electrical Engineering, 2026',
    src: '/about/geisel.webp',
    alt: 'Geisel Library at UC San Diego',
    credit: 'Photo: Stephen Bay, CC BY 4.0',
    href: 'https://commons.wikimedia.org/wiki/File:Geisel_Library,_UC_San_Diego.jpg',
  },
  {
    name: 'Evergreen Valley College',
    degree: 'A.S. Mathematics, A.S. Computer Science, A.S. Physics',
    src: '/about/evc.webp',
    alt: 'The lake at Evergreen Valley College',
    credit: 'Photo: Cristiano Tomás, CC BY-SA 4.0',
    href: 'https://commons.wikimedia.org/wiki/File:Evergreen_Lake_-_Evergreen_Valley_College_0825.jpg',
  },
]

function Rows({ items }: { items: readonly { label: string; value: string }[] }) {
  return (
    <>
      <ul className="rows col-span-full grid grid-cols-subgrid">
        {items.map((t) => (
          <li key={t.label} className="row col-span-full grid grid-cols-subgrid items-baseline py-[20px] md:py-[28px]">
            <span className="col-span-4 text-read md:col-span-6" data-reveal="">
              {t.label}
            </span>
            <span className="c3 col-span-4 mt-[4px] text-read md:col-span-5 md:col-start-7 md:mt-0" data-reveal="">
              {noWidow(t.value)}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

export default function AboutPage() {
  return (
    <>
      <main id="main" tabIndex={-1}>
        <section className="paper pt-page pb-sec" data-tone="light">
          <div className="grid-main">
            <h1 className="oc col-span-4 text-statement md:col-span-10" data-rise="">
              {COPY.aboutHead}
            </h1>
          </div>

          <div className="grid-main mt-sec items-end">
            <div className="col-span-3 md:col-span-5 lg:col-span-4" data-media="">
              <Image
                src="/portrait/zakaria-paper.webp"
                width={1485}
                height={1485}
                quality={90}
                priority
                sizes="(min-width:1024px) 31vw, (min-width:768px) 40vw, 75vw"
                alt="Zakaria Kortam"
                className="block aspect-square h-auto w-full object-contain"
              />
            </div>
            <div className="col-span-4 mt-[48px] flex flex-col gap-[32px] text-read md:col-span-5 md:col-start-7 md:mt-0">
              {COPY.aboutStory.map((s) => (
                <p key={s} data-reveal="">
                  {noWidow(s)}
                </p>
              ))}
            </div>
          </div>

          <div className="grid-main mt-big">
            <figure className="ph-wide col-span-full" data-reveal="">
              <Image src="/about/san-jose.webp" alt="Downtown San Jose at night" width={2400} height={1028} sizes="100vw" quality={82} />
              <figcaption>
                <span>San Jose, California</span>
                <a href={SAN_JOSE.href} target="_blank" rel="noopener noreferrer">
                  {SAN_JOSE.credit}
                </a>
              </figcaption>
            </figure>
          </div>

          <div className="grid-main mt-big">
            <h2 className="oc col-span-4 text-display md:col-span-12" data-rise="">
              Experience
            </h2>
            <div className="mt-head col-span-full grid grid-cols-subgrid">
              <ExperienceList />
            </div>
          </div>

          <div className="grid-main pt-sec">
            <h2 className="oc col-span-4 text-display md:col-span-12" data-rise="">
              How I work
            </h2>
            <div className="mt-head col-span-full grid grid-cols-subgrid">
              <Rows items={COPY.tools} />
            </div>
          </div>

          <div className="grid-main pt-sec">
            <h2 className="oc col-span-4 text-display md:col-span-12" data-rise="">
              Education
            </h2>
            <div className="edu mt-head col-span-full">
              {SCHOOLS.map((sc) => (
                <figure key={sc.name} className="edu-card" data-reveal="">
                  <Image src={sc.src} alt={sc.alt} fill sizes="(min-width:768px) 50vw, 100vw" quality={82} />
                  <figcaption className="edu-txt">
                    <span className="edu-name">{sc.name}</span>
                    <span className="edu-deg">{sc.degree}</span>
                  </figcaption>
                  <a className="edu-credit" href={sc.href} target="_blank" rel="noopener noreferrer">
                    {sc.credit}
                  </a>
                </figure>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
