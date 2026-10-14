'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { EASE } from './Motion'

const EMAIL = 'zakaria@zakariakortam.com'

/** The america.gov prompt bar, used for the one thing this page is for. */
export function EmailPill() {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      window.location.href = `mailto:${EMAIL}`
    }
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, filter: 'blur(8px)', scale: 0.97 }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }}
      transition={{ duration: 1.1, delay: 0.5, ease: EASE }}
      className="glass-strong mx-auto flex w-full max-w-[40rem] items-center gap-2 rounded-full p-2 pl-6 sm:pl-8"
    >
      <span className="min-w-0 flex-1 truncate text-left text-[1.05rem] sm:text-[1.2rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={copied ? 'c' : 'e'}
            className="block truncate"
            initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
            transition={{ duration: 0.3 }}
          >
            {copied ? 'Copied to clipboard' : EMAIL}
          </motion.span>
        </AnimatePresence>
      </span>
      <button
        onClick={copy}
        className="focus-ring hidden h-11 rounded-full px-4 text-sm text-foreground-muted transition-colors hover:bg-white/5 hover:text-foreground sm:block"
      >
        Copy
      </button>
      <a
        href={`mailto:${EMAIL}`}
        aria-label="Send an email"
        className="focus-ring flex h-11 w-11 items-center justify-center rounded-full bg-accent-strong text-lg text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition-colors duration-300 hover:bg-accent sm:h-12 sm:w-12"
      >
        →
      </a>
    </motion.div>
  )
}
