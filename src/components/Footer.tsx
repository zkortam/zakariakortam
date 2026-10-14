import { Container } from './Container'

const links = [
  { name: 'LinkedIn', href: 'https://linkedin.com/in/zkortam' },
  { name: 'GitHub', href: 'https://github.com/zkortam' },
  { name: 'X', href: 'https://x.com/zakariakortam' },
]

export function Footer() {
  return (
    <footer className="mt-40 sm:mt-56">
      <Container>
        <div className="flex flex-col gap-4 border-t py-8 text-sm text-foreground-muted sm:flex-row sm:items-center sm:justify-between">
          <a href="mailto:zakaria@zakariakortam.com" className="transition-colors hover:text-foreground">
            zakaria@zakariakortam.com
          </a>
          <div className="flex gap-6">
            {links.map((l) => (
              <a
                key={l.name}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-foreground"
              >
                {l.name}
              </a>
            ))}
          </div>
        </div>
      </Container>
    </footer>
  )
}
