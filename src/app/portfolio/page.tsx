import type { Metadata } from 'next'
import { WorkIndex } from '@/components/WorkIndex'
import { Footer } from '@/components/Footer'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta({
  path: '/portfolio',
  title: 'Work',
  ogTitle: 'Work by Zakaria Kortam',
  description:
    'Products Zakaria Kortam built end to end, including Helio, Surf, SPICE++, and AiroFind, plus his roles at DigiCert, FacilisAI, Incorta, and Inqueue.',
})

export default function WorkPage() {
  return (
    <>
      <main id="main" tabIndex={-1}>
        <section className="paper pt-page pb-sec" data-tone="light">
          <div className="grid-main">
            <h1 className="oc col-span-4 text-display md:col-span-6" data-rise="">
              Work
            </h1>
          </div>

          <WorkIndex />
        </section>
      </main>
      <Footer />
    </>
  )
}
