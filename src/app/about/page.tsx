import type { Metadata } from 'next'
import { Container } from '@/components/Container'
import { Fade, Label } from '@/components/Motion'
import { Rows } from '@/components/Work'
import { work } from '@/lib/projects-data'

export const metadata: Metadata = {
  title: 'About',
  description: 'Zakaria Kortam is an Associate Product Manager on the Innovation team at DigiCert, based in San Jose.',
}

export default function AboutPage() {
  return (
    <main>
      <Container className="pt-40 sm:pt-52">
        <Fade now>
          <h1 className="font-display text-title">About</h1>
        </Fade>
        <Fade now delay={0.15} className="mt-16 max-w-[38rem] space-y-6 text-xl leading-[1.45] text-pretty sm:ml-[13rem] sm:mt-24">
          <p>
            I’m a product manager on the Innovation team at DigiCert, based in San Jose. I studied
            electrical engineering at UC San Diego.
          </p>
          <p>
            Most of what I know about product came from shipping my own things. Surf started in 2022
            and is on its fourth version. Helio, SPICE++, and AiroFind came after it.
          </p>
          <p>
            Before DigiCert I was the founding AI engineer at FacilisAI. Before that I did product
            work at Incorta and Inqueue.
          </p>
        </Fade>
      </Container>

      <Container className="mt-32 sm:mt-48">
        <Label>Experience</Label>
        <Fade className="mt-4">
          <Rows items={work} left={(p) => p.org ?? p.title} mid={(p) => p.role} />
        </Fade>
      </Container>

      <Container className="mt-32 sm:mt-48">
        <Label>Education</Label>
        <Fade className="mt-4 grid grid-cols-[1fr_auto] gap-x-6 gap-y-0.5 py-5 sm:grid-cols-[13rem_1fr_auto]">
          <span className="text-foreground-muted">UC San Diego</span>
          <span className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">B.S. Electrical Engineering</span>
          <span className="col-start-2 row-start-1 text-sm text-foreground-subtle sm:col-start-auto sm:row-start-auto">2026</span>
        </Fade>
      </Container>
    </main>
  )
}
