'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Container } from './Container'
import { Mark } from './Mark'
import { EASE } from './Motion'

const navItems = [
  { name: 'Work', href: '/portfolio' },
  { name: 'About', href: '/about' },
]

export function Navigation() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    document.documentElement.style.overflow = open ? 'hidden' : ''
  }, [open])

  const isActive = (href: string) => pathname.startsWith(href)

  return (
    <>
      <motion.header
        initial={{ opacity: 0, filter: 'blur(8px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        transition={{ duration: 1, ease: EASE, delay: 0.2 }}
        className="fixed inset-x-0 top-0 z-50"
      >
        {/* Glass slides in once you leave the top of the page */}
        <motion.div
          aria-hidden="true"
          className="glass-strong absolute inset-x-0 top-0 h-full !rounded-none !border-x-0 !border-t-0"
          initial={false}
          animate={{ opacity: scrolled ? 1 : 0, y: scrolled ? 0 : -12 }}
          transition={{ duration: 0.6, ease: EASE }}
        />
        <Container className="relative grid h-[72px] grid-cols-[1fr_auto] items-center sm:grid-cols-[1fr_auto_1fr]">
          <Link
            href="/"
            className="focus-ring group flex items-center gap-3 justify-self-start rounded-lg text-[0.95rem]"
          >
            <Mark className="transition-transform duration-500 group-hover:rotate-[-8deg]" />
            Zakaria Kortam
          </Link>

          <nav className="hidden items-center gap-8 text-[0.95rem] sm:flex">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="focus-ring group relative rounded py-1"
              >
                <span
                  className={`transition-colors duration-300 ${
                    isActive(item.href) ? 'text-foreground' : 'text-foreground-muted group-hover:text-foreground'
                  }`}
                >
                  {item.name}
                </span>
                <span
                  className={`absolute -bottom-0.5 left-0 h-px w-full origin-left bg-accent transition-transform duration-500 ${
                    isActive(item.href) ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                  }`}
                  style={{ transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)' }}
                />
              </Link>
            ))}
          </nav>

          <div className="hidden justify-self-end sm:block">
            <Link
              href="/contact"
              className="focus-ring group inline-flex items-center gap-2 rounded-full text-[0.95rem]"
            >
              Get in touch
              <span className="transition-transform duration-500 group-hover:translate-x-1">→</span>
            </Link>
          </div>

          <button
            onClick={() => setOpen((v) => !v)}
            className="focus-ring relative z-[70] justify-self-end rounded-full px-1 py-2 text-[0.95rem] sm:hidden"
            aria-expanded={open}
          >
            {open ? 'Close' : 'Menu'}
          </button>
        </Container>
      </motion.header>

      {/* Mobile menu: full screen glass, big serif links */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="fixed inset-0 z-[45] bg-black/70 backdrop-blur-2xl sm:hidden"
          >
            <nav className="flex h-full flex-col justify-center gap-2 px-5">
              {[{ name: 'Home', href: '/' }, ...navItems, { name: 'Contact', href: '/contact' }].map((item, i) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.8, delay: 0.05 + i * 0.06, ease: EASE }}
                >
                  <Link href={item.href} className="font-display text-6xl tracking-tight">
                    {item.name}
                  </Link>
                </motion.div>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
