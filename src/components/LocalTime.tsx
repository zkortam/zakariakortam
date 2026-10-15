'use client'

import { useEffect, useState } from 'react'

const fmt = () =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' }).format(new Date())

/** Current time in San Jose, ticking on the minute. Renders nothing until mounted, so no hydration mismatch. */
export function LocalTime() {
  const [t, setT] = useState<string | null>(null)
  useEffect(() => {
    setT(fmt())
    let iv: number | undefined
    const toMinute = 60000 - (Date.now() % 60000)
    const first = window.setTimeout(() => {
      setT(fmt())
      iv = window.setInterval(() => setT(fmt()), 60000)
    }, toMinute)
    return () => {
      clearTimeout(first)
      if (iv) clearInterval(iv)
    }
  }, [])
  return <span className="tnum" style={{ visibility: t ? 'visible' : 'hidden' }}>{t ?? '0:00 PM'} here now</span>
}

/** Opens the command menu; shown only where there is a keyboard to use it. */
export function CommandHint() {
  return (
    <button type="button" className="cmd-hint flink" onClick={() => window.dispatchEvent(new Event('zk:command'))}>
      <kbd>⌘K</kbd> to jump anywhere
    </button>
  )
}
