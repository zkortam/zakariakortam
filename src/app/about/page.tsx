import type { Metadata } from 'next'
import Image from 'next/image'
import { Grid } from '@/components/Container'
import { PageHead } from '@/components/PageHead'
import { Fade, SectionHead } from '@/components/Motion'
import { Rail } from '@/components/Work'
import { work } from '@/lib/projects-data'

export const metadata: Metadata = {
  title: 'About',
  description: 'Zakaria Kortam is an Associate Product Manager on the Innovation team at DigiCert, based in San Jose.',
}

const tools: [string, string][] = [
  ['Product', 'Roadmaps, PRDs, KPIs, user research, A/B tests'],
  ['Code', 'TypeScript, Python, Rust, Go, C/C++, SQL'],
  ['AI', 'Claude, OpenAI, MCP, retrieval, vector databases'],
  ['Infrastructure', 'Supabase, Postgres, Docker, Kubernetes, AWS, Azure'],
]

export default function AboutPage() {
  return (
    <main>
      <PageHead title="About" statement="I’m a product manager in San Jose. I studied electrical engineering at UC San Diego." />

      <Grid className="mt-24 gap-y-12 sm:mt-36">
        <Fade className="lg:col-span-5">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[6px]" style={{ background: 'linear-gradient(180deg, #4a1320 0%, #2a0a12 100%)' }}>
            <Image src="/zakaria.png" alt="Zakaria Kortam" fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover object-top grayscale" />
          </div>
        </Fade>
        <div className="space-y-6 text-prose text-pretty lg:col-span-5 lg:col-start-7">
          <Fade>
            Most of what I know about product came from shipping my own things. Surf started in 2022 and is
            on its fourth version. Helio, SPICE++, and AiroFind came after it.
          </Fade>
          <Fade delay={0.06}>
            Before DigiCert I was the founding AI engineer at FacilisAI, building agents that work with
            factory systems. Before that I did product work at Incorta and Inqueue.
          </Fade>
          <Fade delay={0.12}>
            I was also COO of ClosingTheDivide, a nonprofit that has donated more than 1,350 computers and
            set up 12 computer labs.
          </Fade>
        </div>
      </Grid>

      <Grid className="mt-32 sm:mt-48">
        <SectionHead n="I">Experience</SectionHead>
        <Rail items={work} />
      </Grid>

      <Grid className="mt-32 gap-y-10 sm:mt-48">
        <SectionHead n="II">Tools</SectionHead>
        {tools.map(([k, v], i) => (
          <Fade key={k} delay={i * 0.05} className="text-[15px] sm:max-lg:inline-block lg:col-span-3">
            <div className="text-foreground-subtle">{k}</div>
            <div className="mt-1 max-w-[18rem] leading-snug">{v}</div>
          </Fade>
        ))}
      </Grid>

      <Grid className="mt-32 gap-y-6 sm:mt-48">
        <SectionHead n="III">Education</SectionHead>
        <Fade className="text-prose lg:col-span-6">UC San Diego</Fade>
        <Fade delay={0.06} className="text-prose text-foreground-muted lg:col-span-6">
          B.S. Electrical Engineering, 2026
        </Fade>
      </Grid>
    </main>
  )
}
