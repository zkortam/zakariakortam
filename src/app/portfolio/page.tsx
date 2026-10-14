import type { Metadata } from 'next'
import { Container } from '@/components/Container'
import { PageHead } from '@/components/PageHead'
import { SectionHead } from '@/components/Motion'
import { FeatureRow, PlainList } from '@/components/Tiles'
import { work, featuredProjects, earlierProjects } from '@/lib/projects-data'

export const metadata: Metadata = {
  title: 'Work',
  description: 'Roles and projects by Zakaria Kortam: DigiCert, FacilisAI, Incorta, Helio, Surf, SPICE++, AiroFind, and more.',
}

export default function PortfolioPage() {
  return (
    <main>
      <PageHead
        title="Work"
        statement="Four jobs and a lot of things I built on nights and weekends. Click into any of them for the details."
      />

      <Container className="pt-24 sm:pt-32">
        <SectionHead n="I" label="Jobs" />
        {work.map((p, i) => (
          <FeatureRow key={p.id} p={p} i={i} />
        ))}
      </Container>

      <Container className="pt-28 sm:pt-40">
        <SectionHead n="II" label="Projects" />
        {featuredProjects.map((p, i) => (
          <FeatureRow key={p.id} p={p} i={i} />
        ))}
      </Container>

      <Container className="pt-28 sm:pt-40">
        <SectionHead n="III" label="Earlier" />
        <PlainList items={earlierProjects} />
      </Container>
    </main>
  )
}
