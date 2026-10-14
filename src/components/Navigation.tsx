'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Grid } from './Container'
import { EASE } from './Motion'

const items = [
  { name: 'Work', href: '/portfolio' },
  { name: 'About', href: '/about' },
]

/** NDS header: name at column 1, links at column 7, contact at the right edge. */
export function Navigation() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const link = (href: string) =>
    `transition-colors duration-300 ${
      pathname.startsWith(href) ? 'text-foreground' : 'text-foreground-muted hover:text-foreground'
    }`

  return (
    <motion.header
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, delay: 0.3, ease: EASE }}
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,backdrop-filter] duration-500 ${
        scrolled ? 'bg-black/75 backdrop-blur-xl' : ''
      }`}
    >
      <Grid className="h-16 items-center text-[15px]">
        <div className="flex items-center justify-between lg:col-span-6">
          <Link href="/">Zakaria Kortam</Link>
          <nav className="flex gap-6 lg:hidden">
            {[...items, { name: 'Contact', href: '/contact' }].map((i) => (
              <Link key={i.href} href={i.href} className={link(i.href)}>
                {i.name}
              </Link>
            ))}
          </nav>
        </div>
        <nav className="hidden items-center justify-between lg:col-span-6 lg:flex">
          <span className="flex gap-8">
            {items.map((i) => (
              <Link key={i.href} href={i.href} className={link(i.href)}>
                {i.name}
              </Link>
            ))}
          </span>
          <Link href="/contact" className={link('/contact')}>
            Contact
          </Link>
        </nav>
      </Grid>
    </motion.header>
  )
}
