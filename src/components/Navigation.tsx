'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Container } from './Container'

const items = [
  { name: 'Work', href: '/portfolio' },
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
]

export function Navigation() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${
        scrolled ? 'bg-black/80 backdrop-blur-md' : 'bg-transparent'
      }`}
    >
      <Container className="flex h-16 items-center justify-between text-[15px]">
        <Link href="/">Zakaria Kortam</Link>
        <nav className="flex gap-6 sm:gap-8">
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className={`transition-colors duration-300 ${
                pathname.startsWith(i.href) ? 'text-foreground' : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              {i.name}
            </Link>
          ))}
        </nav>
      </Container>
    </header>
  )
}
