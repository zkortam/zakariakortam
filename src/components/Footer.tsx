import Link from 'next/link'
import { Linkedin, Twitter, Instagram, Github } from 'lucide-react'

const socialLinks = [
  {
    name: 'LinkedIn',
    href: 'https://linkedin.com/in/zkortam',
    icon: Linkedin,
  },
  {
    name: 'X (Twitter)',
    href: 'https://x.com/zakariakortam',
    icon: Twitter,
  },
  {
    name: 'Instagram',
    href: 'https://instagram.com/zkortam',
    icon: Instagram,
  },
  {
    name: 'GitHub',
    href: 'https://github.com/zkortam',
    icon: Github,
  },
]

export function Footer() {
  return (
    <footer className="border-t border-border-subtle bg-surface/30">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-8 md:grid-cols-3 items-center">
          {/* Branding */}
          <div className="space-y-2">
            <Link href="/" className="text-lg font-semibold hover:text-accent-blue transition-colors">
              Zakaria Kortam
            </Link>
            <p className="text-sm text-foreground-muted">
              AI Engineer & Product Engineer
            </p>
          </div>

          {/* Navigation Links */}
          <nav className="flex justify-center">
            <div className="flex space-x-6">
              {['About', 'Portfolio', 'Contact'].map((item) => (
                <Link
                  key={item}
                  href={`/${item.toLowerCase()}`}
                  className="text-sm text-foreground-muted hover:text-foreground transition-colors"
                >
                  {item}
                </Link>
              ))}
            </div>
          </nav>

          {/* Social Links */}
          <div className="flex justify-end space-x-4">
            {socialLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-foreground-muted hover:text-foreground transition-colors focus-ring rounded"
                aria-label={link.name}
              >
                <link.icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-8 border-t border-border-subtle">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
            <p className="text-sm text-foreground-subtle">
              © {new Date().getFullYear()} Zakaria Kortam. All rights reserved.
            </p>
            <p className="text-sm text-foreground-subtle">
              Based in San Jose, California
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
