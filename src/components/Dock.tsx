'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { EASE } from './Motion'

const EMAIL = 'zakaria@zakariakortam.com'

/**
 * Floating glass pill, after america.gov's "Ask anything" bar. Shows once you
 * scroll past the first screen and steps aside near the footer.
 */
export function Dock() {
  const pathname = usePathname()
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      const nearEnd = y + window.innerHeight > document.documentElement.scrollHeight - 900
      setShow(y > window.innerHeight * 0.6 && !nearEnd)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [pathname])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      window.location.href = `mailto:${EMAIL}`
    }
  }

  if (pathname.startsWith('/contact')) return null

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24, filter: 'blur(8px)', scale: 0.96 }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }}
          exit={{ opacity: 0, y: 24, filter: 'blur(8px)', scale: 0.96 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4"
        >
          <div className="glass-strong flex w-full max-w-[34rem] items-center gap-2 rounded-full py-2 pl-6 pr-2">
            <button
              onClick={copy}
              className="focus-ring min-w-0 flex-1 truncate rounded text-left text-[0.95rem] text-foreground-muted transition-colors duration-300 hover:text-foreground"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={copied ? 'c' : 'e'}
                  className="block"
                  initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
                  transition={{ duration: 0.3 }}
                >
                  {copied ? 'Copied to clipboard' : EMAIL}
                </motion.span>
              </AnimatePresence>
            </button>
            <Link
              href="/contact"
              aria-label="Contact"
              className="focus-ring group flex h-10 items-center gap-2 rounded-full bg-accent-strong px-4 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition-colors duration-300 hover:bg-accent"
            >
              Say hello
              <span className="transition-transform duration-500 group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
