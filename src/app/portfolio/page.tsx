import { Section } from '@/components/Section'
import { ProjectCard } from '@/components/ProjectCard'
import { Reveal } from '@/components/Reveal'
import { projects, isWorkProject } from '@/lib/projects-data'

export default function PortfolioPage() {
  const work = projects.filter(isWorkProject)
  const builds = projects.filter((p) => !isWorkProject(p))

  return (
    <main>
      {/* Hero */}
      <Section className="relative overflow-hidden pt-40 pb-20 sm:pt-48 sm:pb-24">
        <Reveal className="relative">
          <p className="eyebrow">Portfolio</p>
          <h1 className="mt-4 text-display text-balance">Selected work</h1>
          <p className="mt-7 max-w-xl text-lg text-foreground-muted sm:text-xl">
            Shipped products, research, and the systems behind them.
          </p>
        </Reveal>
      </Section>

      {/* Work: professional roles and ventures */}
      <Section divider band className="py-20 sm:py-28">
        <Reveal>
          <p className="eyebrow">Work</p>
          <h2 className="mt-3 text-headline">Roles and ventures</h2>
        </Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {work.map((p, i) => (
            <Reveal key={p.id} delay={(i % 3) * 0.06}>
              <ProjectCard project={p} />
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Projects: builds, hackathons, and experiments */}
      <Section divider className="py-20 sm:py-28">
        <Reveal>
          <p className="eyebrow">Projects</p>
          <h2 className="mt-3 text-headline">Builds and experiments</h2>
        </Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {builds.map((p, i) => (
            <Reveal key={p.id} delay={(i % 3) * 0.06}>
              <ProjectCard project={p} />
            </Reveal>
          ))}
        </div>
      </Section>
    </main>
  )
}
