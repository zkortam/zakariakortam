import type { Metadata } from 'next'
import { Container } from '@/components/Container'
import { Fade, Label } from '@/components/Motion'
import { Rows, Shot } from '@/components/Work'
import { work, featuredProjects, earlierProjects } from '@/lib/projects-data'

export const metadata: Metadata = {
  title: 'Work',
  description: 'Roles and projects by Zakaria Kortam: DigiCert, FacilisAI, Incorta, Helio, Surf, SPICE++, AiroFind, and more.',
}

export default function WorkPage() {
  return (
    <main>
      <Container className="pt-40 sm:pt-52">
        <Fade now>
          <h1 className="font-display text-title">Work</h1>
        </Fade>
      </Container>

      <Container className="mt-24 sm:mt-32">
        <Label>Roles</Label>
        <Fade className="mt-4">
          <Rows items={work} left={(p) => p.org ?? p.title} mid={(p) => p.role} />
        </Fade>
      </Container>

      <Container className="mt-32 sm:mt-48">
        <Label>Projects</Label>
        <div className="mt-10 grid gap-x-6 gap-y-16 sm:grid-cols-2">
          {featuredProjects.map((p, i) => (
            <Shot key={p.id} p={p} wide={i === 0} />
          ))}
        </div>
      </Container>

      <Container className="mt-32 sm:mt-48">
        <Label>Other projects</Label>
        <Fade className="mt-4">
          <Rows items={earlierProjects} left={(p) => p.title} mid={(p) => p.line} />
        </Fade>
      </Container>
    </main>
  )
}
