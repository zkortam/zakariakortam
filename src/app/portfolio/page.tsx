import { Section } from '@/components/Section'
import { WorkIndex } from '@/components/WorkIndex'
import { ProjectGrid } from '@/components/ProjectGrid'
import { FeatureRow } from '@/components/FeatureRow'
import { Counter } from '@/components/Counter'
import { Reveal } from '@/components/Reveal'
import { MaskText } from '@/components/MaskText'
import { HeroShader } from '@/components/HeroShader'
import { projects, isWorkProject } from '@/lib/projects-data'

const stats = [
  { to: 10, suffix: '+', label: 'Projects shipped' },
  { to: 3, label: 'Hackathon podiums' },
  { to: 3, label: 'Industry roles' },
]

export default function PortfolioPage() {
  const work = projects.filter(isWorkProject)
  const builds = projects.filter((p) => !isWorkProject(p))
  const featured = builds.filter((p) => p.featured)
  const rest = builds.filter((p) => !p.featured)

  return (
    <main>
      {/* Hero */}
      <Section
        className="relative overflow-hidden pt-40 pb-20 sm:pt-48 sm:pb-28"
        backdrop={<HeroShader seed={0.5} />}
      >
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

          <Reveal delay={0.2}>
            <div className="mt-14 grid max-w-2xl grid-cols-3 gap-6 border-t border-white/10 pt-8 sm:gap-10">
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="font-display text-4xl text-accent sm:text-5xl">
                    <Counter to={s.to} suffix={s.suffix} />
                  </div>
                  <div className="mt-2 text-sm text-foreground-muted">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Roles — editorial index */}
      <Section divider band className="py-20 sm:py-28">
        <Reveal>
          <p className="eyebrow">Work</p>
          <MaskText as="h2" className="mt-3 text-headline" lines={['Roles']} />
        </Reveal>
        <WorkIndex items={work} />
      </Section>

      {/* Featured — immersive */}
      <Section divider className="py-20 sm:py-28">
        <Reveal className="mb-16">
          <p className="eyebrow">Featured</p>
          <MaskText
            as="h2"
            className="mt-3 text-headline"
            lines={['Things I built']}
          />
        </Reveal>
        <div className="space-y-24 sm:space-y-32">
          {featured.map((p, i) => (
            <FeatureRow key={p.id} project={p} index={i} flip={i % 2 === 1} />
          ))}
        </div>
      </Section>

      {/* Archive — filterable */}
      <Section divider band className="py-20 sm:py-28">
        <Reveal className="mb-12">
          <p className="eyebrow">Archive</p>
          <MaskText
            as="h2"
            className="mt-3 text-headline"
            lines={['Everything else']}
          />
        </Reveal>
        <ProjectGrid projects={rest} />
      </Section>
    </main>
  )
}
