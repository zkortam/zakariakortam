import type { Metadata } from 'next'
import { ProjectTile } from '@/components/ProjectTile'
import { ExperienceList } from '@/components/ExperienceList'
import { IndexRows } from '@/components/IndexRows'
import { Footer } from '@/components/Footer'
import { earlierProjects, featuredProjects } from '@/lib/projects-data'
import { COPY } from '@/lib/site'
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
            <p className="cap-md col-span-4 mt-[24px] text-read md:col-span-5 md:col-start-7 md:mt-0" data-reveal="">
              {COPY.workLine}
            </p>
          </div>

          <div className="grid-main mt-sec gap-y-[64px] md:gap-y-[80px] lg:gap-y-[96px]">
            {featuredProjects.map((p, i) => (
              <ProjectTile key={p.id} project={p} index={i} />
            ))}
          </div>

          <div className="grid-main mt-big">
            <h2 className="oc col-span-4 text-statement md:col-span-12" data-rise="">
              Roles
            </h2>
            <div className="mt-head col-span-full grid grid-cols-subgrid">
              <ExperienceList />
            </div>
          </div>

          <div className="grid-main mt-sec">
            <h2 className="oc col-span-4 text-statement md:col-span-12" data-rise="">
              Earlier projects
            </h2>
            <div className="mt-head col-span-full grid grid-cols-subgrid">
              <IndexRows items={earlierProjects} />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
