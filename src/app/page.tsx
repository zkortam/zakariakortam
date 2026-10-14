import Link from 'next/link'
import { Hero } from '@/components/Hero'
import { Container } from '@/components/Container'
import { Chip } from '@/components/Chip'
import { ScrollFill, SectionHead } from '@/components/Motion'
import { ProjectTile, RoleColumns, PlainList } from '@/components/Tiles'
import { work, featuredProjects, earlierProjects } from '@/lib/projects-data'

export default function HomePage() {
  return (
    <main>
      <Hero />

      {/* Statement */}
      <Container className="pb-32 pt-28 sm:pb-40 sm:pt-44">
        <ScrollFill
          className="mx-auto max-w-[68rem] text-center font-display text-[clamp(2.1rem,4.6vw,4.4rem)] leading-[1.1] tracking-[-0.03em]"
          parts={[
            'I’m a product manager at',
            { node: <Chip glyph="lock" label="DigiCert" href="/portfolio/digicert" /> },
            'who still writes the code. Right now that means',
            { node: <Chip glyph="helio" label="Helio," href="/portfolio/helio" /> },
            'a tutor that talks and draws,',
            { node: <Chip glyph="surf" label="Surf" href="/portfolio/surf" /> },
            'and',
            { node: <Chip glyph="messenger" label="Surf Messenger," href="/portfolio/surf-messenger" /> },
            { node: <Chip glyph="spice" label="SPICE++," href="/portfolio/spice-plus-plus" /> },
            'and',
            { node: <Chip glyph="plane" label="AiroFind." href="/portfolio/airofind" /> },
          ]}
        />
      </Container>

      {/* I. Projects */}
      <Container>
        <SectionHead
          n="I"
          label="Projects"
          right={
            <Link href="/portfolio" className="group text-foreground-muted transition-colors hover:text-foreground">
              All work <span className="inline-block transition-transform duration-500 group-hover:translate-x-1">→</span>
            </Link>
          }
        />
        {/* 2, 3, 2: two large, three small, two large */}
        <div className="grid gap-x-5 gap-y-14 sm:grid-cols-2 lg:grid-cols-6">
          {featuredProjects.map((p, i) => (
            <ProjectTile
              key={p.id}
              p={p}
              i={i}
              className={i >= 2 && i <= 4 ? 'lg:col-span-2' : 'lg:col-span-3'}
            />
          ))}
        </div>
      </Container>

      {/* II. Work */}
      <Container className="pt-36 sm:pt-48">
        <SectionHead n="II" label="Work" />
        <RoleColumns items={work} />
      </Container>

      {/* III. Earlier */}
      <Container className="pt-36 sm:pt-48">
        <SectionHead n="III" label="Earlier" />
        <PlainList items={earlierProjects} />
      </Container>
    </main>
  )
}
