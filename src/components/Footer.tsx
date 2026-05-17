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
    <footer className="hairline">
      <div className="mx-auto w-full max-w-content px-6 py-14 sm:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/"
              className="text-lg font-semibold tracking-tight transition-colors hover:text-accent"
            >
              Zakaria Kortam
            </Link>
            <p className="mt-1.5 text-sm text-foreground-subtle">
              AI Engineer · San Jose, California
            </p>
          </div>

          <div className="flex items-center gap-3">
            {socials.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.name}
                className="focus-ring flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.07] text-foreground-subtle transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/30 hover:text-accent"
              >
                <s.icon className="h-[18px] w-[18px]" />
              </a>
            ))}
          </div>
        </div>

        <div className="mt-10 border-t border-white/[0.06] pt-6 text-xs text-foreground-subtle">
          © {new Date().getFullYear()} Zakaria Kortam — Built with Next.js
        </div>
      </div>
    </footer>
  )
}
