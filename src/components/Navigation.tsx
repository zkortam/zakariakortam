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
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setOpen(false), [pathname])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? 'border-b border-white/8 bg-background/80 backdrop-blur-xl'
          : 'border-b border-transparent'
      }`}
    >
      <Container>
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="focus-ring rounded text-sm font-semibold tracking-tight"
          >
            Zakaria Kortam
          </Link>

          <nav className="hidden items-center gap-8 sm:flex">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`focus-ring rounded text-sm transition-colors duration-200 ${
                  isActive(item.href)
                    ? 'text-foreground'
                    : 'text-foreground-muted hover:text-foreground'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          <button
            onClick={() => setOpen((v) => !v)}
            className="focus-ring -mr-2 flex h-9 w-9 items-center justify-center rounded sm:hidden"
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
          <nav className="flex flex-col gap-1 border-t border-white/8 py-3 sm:hidden">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`focus-ring rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive(item.href)
                    ? 'bg-white/5 text-foreground'
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
