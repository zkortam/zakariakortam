'use client'

import { useEffect, useRef } from 'react'

const TZ = 'America/Los_Angeles'
const SWEEP_IN = 1600

/** Milliseconds since midnight in San Jose. */
function sinceMidnight(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(now)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return ((get('hour') * 60 + get('minute')) * 60 + get('second')) * 1000 + now.getMilliseconds()
}

const TICKS = Array.from({ length: 60 }, (_, i) => i)

/**
 * The time in San Jose on an analog face, like an always-on display: hands sweep round from twelve as it
 * arrives, then the second hand glides. Pauses itself when the tab is hidden.
 */
export function IdleClock() {
  const h = useRef<SVGGElement>(null)
  const m = useRef<SVGGElement>(null)
  const s = useRef<SVGGElement>(null)

  useEffect(() => {
    const low = document.documentElement.dataset.quality === 'low'
    const t0 = performance.now()
    // San Jose's offset, read once; Intl on every frame is wasted work.
    const start = new Date()
    const shift = sinceMidnight(start) - start.getTime()
    let raf = 0
    let iv = 0
    const ease = (p: number) => 1 - Math.pow(1 - p, 4)
    const draw = () => {
      const ms = (((Date.now() + shift) % 86400000) + 86400000) % 86400000
      // Seconds tick on a low-power device and glide everywhere else.
      const sec = low ? Math.floor(ms / 1000) % 60 : (ms / 1000) % 60
      const min = (ms / 60000) % 60
      const hr = (ms / 3600000) % 12
      const p = Math.min(1, (performance.now() - t0) / SWEEP_IN)
      const k = ease(p)
      h.current?.setAttribute('transform', `rotate(${hr * 30 * k})`)
      m.current?.setAttribute('transform', `rotate(${min * 6 * k})`)
      s.current?.setAttribute('transform', `rotate(${sec * 6 * k})`)
      return p < 1
    }
    const loop = () => {
      const sweeping = draw()
      if (low && !sweeping) {
        iv = window.setInterval(draw, 1000)
        return
      }
      raf = requestAnimationFrame(loop)
    }
    const onVis = () => {
      cancelAnimationFrame(raf)
      clearInterval(iv)
      if (!document.hidden) loop()
    }
    loop()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(iv)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return (
    <svg className="idle-clock" viewBox="-100 -100 200 200" aria-hidden="true">
      <g className="ic-ticks">
        {TICKS.map((i) => (
          <line key={i} x1="0" y1={i % 5 ? -93 : -90} x2="0" y2="-97" transform={`rotate(${i * 6})`} className={i % 5 ? '' : 'ic-hour'} />
        ))}
      </g>
      <g ref={h}>
        <line x1="0" y1="0" x2="0" y2="-12" className="ic-stem" />
        <line x1="0" y1="-12" x2="0" y2="-50" className="ic-hand" />
      </g>
      <g ref={m}>
        <line x1="0" y1="0" x2="0" y2="-12" className="ic-stem" />
        <line x1="0" y1="-12" x2="0" y2="-80" className="ic-hand" />
      </g>
      <circle r="4.2" className="ic-cap" />
      <g ref={s} className="ic-sec">
        <line x1="0" y1="16" x2="0" y2="-88" />
        <circle r="2.6" />
      </g>
      <circle r="1.1" className="ic-pin" />
    </svg>
  )
}
