'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ACTIVITY } from '@/lib/figures'

const PITCH = 12
const CELL = 10
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** One hue, light to dark, on paper. Level 0 is the empty day. */
const STEPS = [1, 10, 40, 100, 250]

function level(n: number) {
  let l = 0
  for (const s of STEPS) if (n >= s) l++
  return l
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
const nice = (s: string) => {
  const [, m, d] = s.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}`
}

/**
 * Every commit this year, one square per day, from the product repositories' history. Hover or tap a day for its
 * count; the summary row and a month table carry the same numbers for anyone not reading the squares.
 */
export function CommitHeat() {
  const { cells, cols, months, busiest, active, topMonth, byMonth } = useMemo(() => {
    const start = new Date(Date.UTC(ACTIVITY.year, 0, 1))
    const through = new Date(`${ACTIVITY.through}T00:00:00Z`)
    // The whole year is drawn; days still to come are the faintest step.
    const end = new Date(Date.UTC(ACTIVITY.year, 11, 31))
    const lead = start.getUTCDay()
    const cells: { x: number; y: number; date: string; n: number; l: number; later?: boolean }[] = []
    const months: { label: string; col: number }[] = []
    const byMonth = new Array(12).fill(0) as number[]
    let busiest = { date: '', n: 0 }
    let active = 0
    for (let d = new Date(start), i = lead; d <= end; d.setUTCDate(d.getUTCDate() + 1), i++) {
      const date = iso(d)
      const n = ACTIVITY.days[date] ?? 0
      const col = Math.floor(i / 7)
      if (d.getUTCDate() === 1) months.push({ label: MONTHS[d.getUTCMonth()], col })
      if (d > through) {
        cells.push({ x: col, y: i % 7, date, n: 0, l: 0, later: true })
        continue
      }
      cells.push({ x: col, y: i % 7, date, n, l: level(n) })
      byMonth[d.getUTCMonth()] += n
      if (n > busiest.n) busiest = { date, n }
      if (n) active++
    }
    const cols = Math.floor((lead + cells.length - 1) / 7) + 1
    const top = byMonth.indexOf(Math.max(...byMonth))
    return { cells, cols, months, busiest, active, topMonth: MONTHS[top], byMonth }
  }, [])

  const box = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  // On a phone the year is wider than the screen: open on the latest weeks.
  useEffect(() => {
    const el = scroller.current
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = el.scrollWidth
  }, [])
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null)

  const pick = (clientX: number, clientY: number) => {
    const el = box.current?.querySelector('svg')
    if (!el) return
    const r = el.getBoundingClientRect()
    const s = r.width / (cols * PITCH)
    const col = Math.floor((clientX - r.left) / s / PITCH)
    const row = Math.floor((clientY - r.top) / s / PITCH)
    const c = cells.find((k) => k.x === col && k.y === row)
    if (!c || c.later) return setTip(null)
    const host = box.current!.getBoundingClientRect()
    setTip({
      x: r.left - host.left + (col + 0.5) * PITCH * s,
      y: r.top - host.top + row * PITCH * s,
      text: `${nice(c.date)} · ${c.n ? `${c.n.toLocaleString('en-US')} commit${c.n === 1 ? '' : 's'}` : 'No commits'}`,
    })
  }

  return (
    <figure className="heat" data-reveal="">
      <div className="heat-scroll" ref={scroller}>
      <div className="heat-plot" ref={box} onPointerLeave={() => setTip(null)}>
        <div className="heat-months" aria-hidden="true">
          {months.map((m) => (
            <span key={m.label} style={{ left: `${(m.col / cols) * 100}%` }}>
              {m.label}
            </span>
          ))}
        </div>
        <svg
          viewBox={`0 0 ${cols * PITCH - (PITCH - CELL)} ${7 * PITCH - (PITCH - CELL)}`}
          role="img"
          aria-label={`Commits per day in ${ACTIVITY.year}: ${ACTIVITY.total.toLocaleString('en-US')} in total, busiest on ${nice(busiest.date)} with ${busiest.n}.`}
          onPointerMove={(e) => pick(e.clientX, e.clientY)}
          onPointerDown={(e) => pick(e.clientX, e.clientY)}
        >
          {cells.map((c) => (
            <rect key={c.date} x={c.x * PITCH} y={c.y * PITCH} width={CELL} height={CELL} rx={2.5} className={c.later ? 'hlx' : `hl${c.l}`} />
          ))}
        </svg>
        {tip && (
          <span className="heat-tip" style={{ left: tip.x, top: tip.y }}>
            {tip.text}
          </span>
        )}
      </div>
      </div>
      <figcaption className="heat-cap">
        <span className="heat-key" aria-hidden="true">
          Less
          {[0, 1, 2, 3, 4, 5].map((l) => (
            <i key={l} className={`hl${l}`} />
          ))}
          More
        </span>
        <span>
          Busiest day <b className="tnum">{nice(busiest.date)}</b>, {busiest.n.toLocaleString('en-US')} commits
        </span>
        <span>
          <b className="tnum">{active}</b> active days
        </span>
        <span>
          Busiest month <b>{topMonth}</b>
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>Commits per month in {ACTIVITY.year}</caption>
        <tbody>
          {byMonth.map((n, i) =>
            n ? (
              <tr key={i}>
                <th scope="row">{MONTHS[i]}</th>
                <td>{n}</td>
              </tr>
            ) : null,
          )}
        </tbody>
      </table>
    </figure>
  )
}
