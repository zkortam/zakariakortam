'use client'

import { useRef, useState } from 'react'
import { EMAIL } from '@/lib/site'
import { Icon } from './Icon'

export function CopyPill() {
  const [done, setDone] = useState(false)
  const timer = useRef<number>(0)

  async function copy() {
    try {
      await navigator.clipboard.writeText(EMAIL)
    } catch {
      const link = document.querySelector('[data-email]')
      if (link) {
        const range = document.createRange()
        range.selectNodeContents(link)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    }
    setDone(true)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setDone(false), 1800)
  }

  return (
    <>
      <button type="button" onClick={copy} className={`pill pill-icon glass-dark ${done ? 'on' : ''}`} aria-label="Copy email" title="Copy email">
        <Icon name="copy" size={20} className="pi-a" />
        <Icon name="check" size={20} className="pi-b" />
      </button>
      <span className="sr-only" aria-live="polite">
        {done ? 'Copied' : ''}
      </span>
    </>
  )
}
