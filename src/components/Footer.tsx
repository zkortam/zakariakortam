'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Container } from './Container'
import { BlurIn, Rule } from './Motion'

const links = [
  { name: 'Work', href: '/portfolio' },
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
  { name: 'LinkedIn', href: 'https://linkedin.com/in/zkortam' },
  { name: 'GitHub', href: 'https://github.com/zkortam' },
]

const fine = [
  { name: 'X', href: 'https://x.com/zakariakortam' },
  { name: 'Instagram', href: 'https://instagram.com/zkortam' },
  { name: 'zakaria@zakariakortam.com', href: 'mailto:zakaria@zakariakortam.com' },
]

/** america.gov footer: stacked serif links, then the name, huge, rising out of the floor. */
export function Footer() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] })
  const y = useTransform(scrollYProgress, [0, 1], ['40%', '0%'])
  const opacity = useTransform(scrollYProgress, [0, 0.8], [0, 1])

  return (
    <footer className="relative overflow-hidden pt-32 sm:pt-44">
      <Container>
        <nav className="flex flex-col items-center">
          {links.map((l, i) => {
            const external = l.href.startsWith('http')
            return (
              <BlurIn key={l.name} delay={i * 0.06}>
                <Link
                  href={l.href}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="focus-ring group relative block rounded font-display text-[clamp(2.4rem,5.4vw,4.6rem)] leading-[1.08] tracking-[-0.03em] text-foreground-muted transition-colors duration-500 hover:text-foreground"
                >
                  {l.name}
                  {external && (
                    <span className="absolute -right-6 top-2 text-base text-foreground-subtle opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                      ↗
                    </span>
                  )}
                </Link>
              </BlurIn>
            )
          })}
        </nav>
      </Container>

      <div ref={ref} className="relative mt-24 sm:mt-32">
        <motion.p
          aria-hidden="true"
          style={{ y, opacity }}
          className="select-none whitespace-nowrap text-center font-display leading-[0.8] tracking-[-0.055em]"
        >
          <span
            className="block bg-gradient-to-b from-foreground via-foreground/80 to-accent/40 bg-clip-text text-[23vw] text-transparent"
          >
            Kortam
          </span>
        </motion.p>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background to-transparent" />
      </div>

      <Container className="relative pb-28 sm:pb-10">
        <Rule />
        <div className="flex flex-col gap-3 pt-5 text-sm text-foreground-subtle sm:flex-row sm:items-center sm:justify-between">
          <span>San Jose, California</span>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {fine.map((f) => (
              <a key={f.name} href={f.href} className="transition-colors duration-300 hover:text-foreground">
                {f.name}
              </a>
            ))}
          </div>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </Container>
    </footer>
  )
}
