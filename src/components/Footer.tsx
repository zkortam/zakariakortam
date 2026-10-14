import Link from 'next/link'
import { Grid } from './Container'

const elsewhere = [
  { name: 'LinkedIn', href: 'https://linkedin.com/in/zkortam' },
  { name: 'GitHub', href: 'https://github.com/zkortam' },
  { name: 'X', href: 'https://x.com/zakariakortam' },
  { name: 'Instagram', href: 'https://instagram.com/zkortam' },
]

const pages = [
  { name: 'Work', href: '/portfolio' },
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
]

/** NDS footer: the name large on the left, three short columns on the right. */
export function Footer() {
  return (
    <footer className="mt-40 sm:mt-56">
      <Grid className="gap-y-12 border-t pb-10 pt-10 text-[15px]">
        <p className="font-display text-[clamp(3rem,7vw,6.5rem)] leading-[0.9] tracking-[-0.04em] lg:col-span-6">
          Zakaria
          <br />
          Kortam
        </p>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-6">
          <div className="text-foreground-muted">
            San Jose,
            <br />
            California
          </div>
          <ul className="space-y-1">
            {pages.map((l) => (
              <li key={l.name}>
                <Link href={l.href} className="text-foreground-muted transition-colors hover:text-foreground">
                  {l.name}
                </Link>
              </li>
            ))}
          </ul>
          <ul className="space-y-1">
            {elsewhere.map((l) => (
              <li key={l.name}>
                <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-foreground-muted transition-colors hover:text-foreground">
                  {l.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-between text-sm text-foreground-subtle lg:col-span-12">
          <a href="mailto:zakaria@zakariakortam.com" className="transition-colors hover:text-foreground">
            zakaria@zakariakortam.com
          </a>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </Grid>
    </footer>
  )
}
