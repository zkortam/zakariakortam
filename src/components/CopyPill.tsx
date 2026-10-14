'use client'

import { useRef, useState } from 'react'
import { EMAIL } from '@/lib/site'

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
      <button type="button" onClick={copy} className="pill glass-dark">
        <span className={`roll ${done ? 'on' : ''}`}>
          <span>
            <span>Copy email</span>
            <span aria-hidden="true">Copied</span>
          </span>
        </span>
      </button>
      <span className="sr-only" aria-live="polite">
        {done ? 'Copied' : ''}
      </span>
    </>
  )
}
