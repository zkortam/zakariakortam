import type { Metadata } from 'next'
import { Grid } from '@/components/Container'
import { PageHead } from '@/components/PageHead'
import { SectionHead } from '@/components/Motion'
import { Rail, Rows, Shot } from '@/components/Work'
import { work, featuredProjects, earlierProjects } from '@/lib/projects-data'

export const metadata: Metadata = {
  title: 'Work',
  description: 'Roles and projects by Zakaria Kortam: DigiCert, FacilisAI, Incorta, Helio, Surf, SPICE++, AiroFind, and more.',
}

export default function WorkPage() {
  return (
    <main>
      <PageHead title="Work" statement="Four roles in product and engineering, and the products I build on my own." />

      <Grid className="mt-32 sm:mt-44">
        <SectionHead n="I">Experience</SectionHead>
        <Rail items={work} />
      </Grid>

      <Grid className="mt-32 gap-y-14 sm:mt-48">
        <SectionHead n="II">Projects</SectionHead>
        {featuredProjects.map((p, i) => (
          <Shot key={p.id} p={p} ratio="aspect-[4/3]" className="lg:col-span-6" delay={(i % 2) * 0.08} />
        ))}
      </Grid>

      <Grid className="mt-32 sm:mt-48">
        <SectionHead n="III">Other projects</SectionHead>
        <Rows items={earlierProjects} />
      </Grid>
    </main>
  )
}
