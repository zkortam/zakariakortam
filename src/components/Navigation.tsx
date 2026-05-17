'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Container } from './Container'

const navItems = [
  { name: 'Work', href: '/portfolio' },
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
]

export function Navigation() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => setOpen(false), [pathname])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <header className="fixed inset-x-0 top-4 z-50">
      <Container>
        <div className="glass-nav flex h-14 items-center justify-between rounded-full pl-6 pr-3">
          <Link
            href="/"
            className="focus-ring rounded-full text-sm font-semibold tracking-tight"
          >
            Zakaria Kortam
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`focus-ring rounded-full px-4 py-2 text-sm font-medium transition-colors duration-300 ${
                  isActive(item.href)
                    ? 'bg-accent/15 text-accent'
                    : 'text-foreground-muted hover:text-foreground'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          <button
            onClick={() => setOpen((v) => !v)}
            className="focus-ring flex h-10 w-10 items-center justify-center rounded-full sm:hidden"
            aria-label="Menu"
            aria-expanded={open}
          >
            <div className="space-y-[5px]">
              <span
                className={`block h-px w-5 bg-foreground transition-transform duration-300 ${
                  open ? 'translate-y-[6px] rotate-45' : ''
                }`}
              />
              <span
                className={`block h-px w-5 bg-foreground transition-opacity duration-200 ${
                  open ? 'opacity-0' : ''
                }`}
              />
              <span
                className={`block h-px w-5 bg-foreground transition-transform duration-300 ${
                  open ? '-translate-y-[6px] -rotate-45' : ''
                }`}
              />
            </div>
          </button>
        </div>

        {open && (
          <nav className="glass mt-3 flex flex-col gap-1 rounded-3xl p-3 sm:hidden">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`focus-ring rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-accent/15 text-accent'
                    : 'text-foreground-muted'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        )}
      </Container>
    </header>
  )
}
