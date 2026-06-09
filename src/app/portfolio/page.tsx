import { Section } from '@/components/Section'
import { WorkIndex } from '@/components/WorkIndex'
import { ProjectGrid } from '@/components/ProjectGrid'
import { Reveal } from '@/components/Reveal'
import { MaskText } from '@/components/MaskText'
import { ChapterRail } from '@/components/ChapterRail'
import { projects, isWorkProject } from '@/lib/projects-data'

const chapters = [
  { id: 'intro', label: 'Overview' },
  { id: 'work', label: 'Roles' },
  { id: 'projects', label: 'Builds' },
]

export default function PortfolioPage() {
  const work = projects.filter(isWorkProject)
  const builds = projects.filter((p) => !isWorkProject(p))

  return (
    <main>
      <ChapterRail chapters={chapters} />

      {/* Hero */}
      <Section id="intro" className="relative overflow-hidden pt-40 pb-20 sm:pt-48 sm:pb-24">
        <div className="relative">
          <Reveal>
            <p className="eyebrow">Portfolio</p>
          </Reveal>
          <MaskText
            as="h1"
            inView={false}
            className="mt-4 text-display text-balance"
            lines={['Selected work']}
          />
          <Reveal delay={0.12}>
            <p className="mt-7 max-w-xl text-lg text-foreground-muted sm:text-xl">
              Shipped products, research, and the systems behind them — from a
              founding AI role to hackathon wins.
            </p>
          </Reveal>
        </div>
      </Section>

      {/* Roles — editorial index */}
      <Section id="work" divider band className="py-20 sm:py-28">
        <Reveal>
          <p className="eyebrow">Work</p>
          <MaskText as="h2" className="mt-3 text-headline" lines={['Roles']} />
        </Reveal>
        <WorkIndex items={work} />
      </Section>

      {/* Projects — filterable, animated */}
      <Section id="projects" divider className="py-20 sm:py-28">
        <Reveal className="mb-12">
          <p className="eyebrow">Projects</p>
          <MaskText as="h2" className="mt-3 text-headline" lines={['Builds']} />
        </Reveal>
        <ProjectGrid projects={builds} />
      </Section>
    </main>
  )
}
