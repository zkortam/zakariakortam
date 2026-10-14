import { Hero } from '@/components/Hero'
import { PortraitBand } from '@/components/PortraitBand'
import { Grid } from '@/components/Container'
import { SectionHead } from '@/components/Motion'
import { Rail, Rows, Shot } from '@/components/Work'
import { work, featuredProjects, earlierProjects } from '@/lib/projects-data'

export default function HomePage() {
  return (
    <main>
      {/* The band slides over the pinned hero; both live in one wrapper so the pin ends here */}
      <div className="relative">
        <Hero />
        <PortraitBand />
      </div>

      <Grid className="mt-32 gap-y-14 sm:mt-48">
        <SectionHead n="I">Selected projects</SectionHead>
        {featuredProjects.map((p, i) => (
          <Shot
            key={p.id}
            p={p}
            className={i < 2 ? 'lg:col-span-6' : 'lg:col-span-4'}
            delay={(i < 2 ? i : i - 2) * 0.08}
          />
        ))}
      </Grid>

      <Grid className="mt-32 sm:mt-48">
        <SectionHead n="II">Experience</SectionHead>
        <Rail items={work} />
      </Grid>

      <Grid className="mt-32 sm:mt-48">
        <SectionHead n="III">Other projects</SectionHead>
        <Rows items={earlierProjects} />
      </Grid>
    </main>
  )
}
