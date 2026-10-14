import { Hero } from '@/components/Hero'
import { PortraitBand } from '@/components/PortraitBand'
import { Grid } from '@/components/Container'
import { Fade, SectionHead } from '@/components/Motion'
import { Rail, Rows, Shot } from '@/components/Work'
import { work, featuredProjects, earlierProjects } from '@/lib/projects-data'

export default function HomePage() {
  const [first, second, ...rest] = featuredProjects

  return (
    <main>
      <Hero />
      <PortraitBand />

      {/* Short statement, NDS manifesto layout: label left, text right */}
      <Grid className="mt-32 gap-y-6 sm:mt-48">
        <Fade className="text-[15px] text-foreground-muted lg:col-span-6">Now</Fade>
        <Fade delay={0.08} className="text-statement text-pretty lg:col-span-5 lg:col-start-7">
          I work on new products at DigiCert. On my own time I build Helio, a tutor that talks and
          draws, and Surf, a social network that is on its fourth version.
        </Fade>
      </Grid>

      <Grid className="mt-32 gap-y-14 sm:mt-48">
        <SectionHead n="I">Selected projects</SectionHead>
        <Shot p={first} ratio="aspect-[4/3]" className="lg:col-span-6" />
        <Shot p={second} ratio="aspect-[4/3]" className="lg:col-span-6" delay={0.08} />
        {rest.map((p, i) => (
          <Shot key={p.id} p={p} className="lg:col-span-4" delay={i * 0.08} />
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
