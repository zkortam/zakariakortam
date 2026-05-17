'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

const navItems = [
  { name: 'Home', href: '/' },
  { name: 'About', href: '/about' },
  { name: 'Work', href: '/portfolio' },
  { name: 'Contact', href: '/contact' },
]

export function Navigation() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => setOpen(false), [pathname])

  return (
    <header className="fixed inset-x-0 top-4 z-50 px-4">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <Link
          href="/"
          className="glass focus-ring flex h-12 items-center rounded-full px-5 text-sm font-semibold tracking-tight transition-colors duration-base hover:text-foreground"
        >
          ZK
        </Link>

        {/* Desktop pill */}
        <nav className="glass hidden h-12 items-center rounded-full p-1 md:flex">
          {navItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className="focus-ring relative rounded-full px-4 py-2 text-sm font-medium"
              >
                <span
                  className={`relative z-10 transition-colors duration-base ${
                    active ? 'text-background' : 'text-foreground-muted hover:text-foreground'
                  }`}
                >
                  {item.name}
                </span>
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-foreground"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="glass focus-ring flex h-12 w-12 items-center justify-center rounded-full md:hidden"
          aria-label="Menu"
        >
          <div className="relative h-3.5 w-5">
            <motion.span
              className="absolute left-0 h-px w-5 bg-foreground"
              animate={open ? { top: 6, rotate: 45 } : { top: 2, rotate: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            />
            <motion.span
              className="absolute left-0 bottom-0 h-px w-5 bg-foreground"
              animate={open ? { bottom: 6, rotate: -45 } : { bottom: 2, rotate: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, y: -12, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -12, filter: 'blur(8px)' }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="glass-elevated mx-auto mt-3 max-w-3xl space-y-1 rounded-3xl p-3 md:hidden"
          >
            {navItems.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`focus-ring block rounded-2xl px-4 py-3 text-sm font-medium transition-colors duration-base ${
                    active
                      ? 'bg-foreground text-background'
                      : 'text-foreground-muted hover:bg-white/5 hover:text-foreground'
                  }`}
                >
                  {item.name}
                </Link>
              )
            })}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}
