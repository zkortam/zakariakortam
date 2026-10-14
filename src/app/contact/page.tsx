import type { Metadata } from 'next'
import { Container } from '@/components/Container'
import { Fade } from '@/components/Motion'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with Zakaria Kortam.',
}

const links = [
  { name: 'LinkedIn', href: 'https://linkedin.com/in/zkortam' },
  { name: 'GitHub', href: 'https://github.com/zkortam' },
  { name: 'X', href: 'https://x.com/zakariakortam' },
  { name: 'Instagram', href: 'https://instagram.com/zkortam' },
]

export default function ContactPage() {
  return (
    <main>
      <Container className="flex min-h-[70svh] flex-col justify-end pt-40">
        <Fade now>
          <h1 className="font-display text-title">Contact</h1>
        </Fade>
        <Fade now delay={0.15} className="mt-12 sm:mt-16">
          <a
            href="mailto:zakaria@zakariakortam.com"
            className="text-[clamp(1.5rem,3.4vw,2.5rem)] tracking-[-0.025em] underline decoration-white/20 underline-offset-[0.2em] transition-colors hover:decoration-accent"
          >
            zakaria@zakariakortam.com
          </a>
        </Fade>
        <Fade now delay={0.25} className="mt-10 flex flex-wrap gap-x-8 gap-y-2 text-foreground-muted">
          {links.map((l) => (
            <a key={l.name} href={l.href} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">
              {l.name}
            </a>
          ))}
        </Fade>
      </Container>
    </main>
  )
}
