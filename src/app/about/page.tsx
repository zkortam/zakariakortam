import type { Metadata } from 'next'
import Image from 'next/image'
import { ExperienceList } from '@/components/ExperienceList'
import { Footer } from '@/components/Footer'
import { Rule } from '@/components/Rule'
import { COPY, noWidow } from '@/lib/site'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta({
  path: '/about',
  title: 'About',
  ogTitle: 'About Zakaria Kortam',
  type: 'profile',
  description:
    'Zakaria Kortam is an Associate Product Manager at DigiCert who takes products from zero to one, end to end. UC San Diego EE, based in San Jose.',
})

function Rows({ items }: { items: readonly { label: string; value: string }[] }) {
  return (
    <>
      <ul className="rows col-span-full grid grid-cols-subgrid">
        {items.map((t) => (
          <li key={t.label} className="row col-span-full grid grid-cols-subgrid items-baseline py-[20px] md:py-[28px]">
            <Rule className="rule-top" />
            <span className="col-span-4 text-read md:col-span-6" data-reveal="">
              {t.label}
            </span>
            <span className="c3 col-span-4 mt-[4px] text-read md:col-span-5 md:col-start-7 md:mt-0" data-reveal="">
              {noWidow(t.value)}
            </span>
          </li>
        ))}
      </ul>
      <Rule className="rule-end col-span-full" />
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
            <div className="mt-head col-span-full grid grid-cols-subgrid">
              <Rows items={COPY.education} />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
