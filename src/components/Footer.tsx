import Link from 'next/link'
import { Linkedin, Twitter, Instagram, Github } from 'lucide-react'
import { Container } from './Container'

const socials = [
  { name: 'LinkedIn', href: 'https://linkedin.com/in/zkortam', icon: Linkedin },
  { name: 'X', href: 'https://x.com/zakariakortam', icon: Twitter },
  { name: 'Instagram', href: 'https://instagram.com/zkortam', icon: Instagram },
  { name: 'GitHub', href: 'https://github.com/zkortam', icon: Github },
]

export function Footer() {
  return (
    <footer className="border-t border-white/8">
      <Container>
        <div className="flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/" className="text-sm font-semibold tracking-tight">
              Zakaria Kortam
            </Link>
            <p className="mt-1 text-sm text-foreground-subtle">
              AI Engineer · San Jose, California
            </p>
          </div>

          <div className="flex items-center gap-5">
            {socials.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.name}
                className="focus-ring rounded text-foreground-subtle transition-colors hover:text-foreground"
              >
                <s.icon className="h-[18px] w-[18px]" />
              </a>
            ))}
          </div>
        </div>

        <div className="border-t border-white/8 py-6 text-xs text-foreground-subtle">
          © {new Date().getFullYear()} Zakaria Kortam
        </div>
      </Container>
    </footer>
  )
}
