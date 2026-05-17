import Link from 'next/link'
import { Linkedin, Twitter, Instagram, Github } from 'lucide-react'

const socials = [
  { name: 'LinkedIn', href: 'https://linkedin.com/in/zkortam', icon: Linkedin },
  { name: 'X', href: 'https://x.com/zakariakortam', icon: Twitter },
  { name: 'Instagram', href: 'https://instagram.com/zkortam', icon: Instagram },
  { name: 'GitHub', href: 'https://github.com/zkortam', icon: Github },
]

export function Footer() {
  return (
    <footer className="px-4 pb-6">
      <div className="glass mx-auto flex max-w-6xl flex-col gap-6 rounded-4xl px-8 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="text-base font-semibold tracking-tight">
            Zakaria Kortam
          </Link>
          <p className="mt-1 text-sm text-foreground-subtle">
            AI Engineer · San Jose, California
          </p>
        </div>

        <nav className="flex gap-6 text-sm text-foreground-muted">
          {['About', 'Portfolio', 'Contact'].map((i) => (
            <Link
              key={i}
              href={`/${i.toLowerCase()}`}
              className="transition-colors hover:text-foreground"
            >
              {i}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {socials.map((s) => (
            <a
              key={s.name}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.name}
              className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-white/8 text-foreground-muted transition-all duration-base hover:scale-110 hover:border-white/25 hover:text-foreground"
            >
              <s.icon className="h-4 w-4" />
            </a>
          ))}
        </div>
      </div>
      <p className="mt-6 text-center text-xs text-foreground-subtle">
        © {new Date().getFullYear()} Zakaria Kortam
      </p>
    </footer>
  )
}
