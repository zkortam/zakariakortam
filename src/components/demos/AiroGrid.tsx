'use client'

import { useMemo, useState } from 'react'
import { Stage, mono, useClock, useLive } from './shared'

/**
 * How AiroFind prices a whole window at once: its scraper reads Google Flights' 7 by 7 date
 * grid, so every departure and return pair around your dates is priced in a few page loads,
 * then the cheapest pair wins. Fares here are an example; the method is the real one.
 */

const DEP = ['Nov 7', 'Nov 8', 'Nov 9', 'Nov 10', 'Nov 11', 'Nov 12', 'Nov 13']
const RET = ['Nov 21', 'Nov 22', 'Nov 23', 'Nov 24', 'Nov 25', 'Nov 26', 'Nov 27']
const CYCLE = 9

/** Deterministic example fares: weekday dips, a cheap pocket mid-week, a little noise. */
function fare(d: number, r: number) {
  const dow = [1.0, 0.93, 0.86, 0.9, 1.04, 1.12, 1.08][d]
  const back = [1.06, 1.0, 0.9, 0.88, 0.95, 1.1, 1.14][r]
  const noise = ((d * 7 + r * 13) % 9) * 6
  return Math.round(310 * dow * back + noise)
}

export function AiroGrid() {
  const { ref, live, reduced } = useLive<HTMLDivElement>()
  const [t, setT] = useState(0)
  useClock(live && !reduced, (time) => setT(time % CYCLE))
  const now = reduced ? CYCLE : t

  const cells = useMemo(() => DEP.flatMap((_, d) => RET.map((_, r) => ({ d, r, p: fare(d, r) }))), [])
  const min = Math.min(...cells.map((c) => c.p))
  const max = Math.max(...cells.map((c) => c.p))
  const best = cells.find((c) => c.p === min)!

  // Cells fill in as the grid "loads", in a sweep from the top-left.
  const fill = Math.min(1, now / 3.2)
  const found = now > 3.6
  const fly = Math.min(1, Math.max(0, (now - 4) / 3))

  // Route arc SJC to JFK over a curved horizon.
  const A = { x: 70, y: 168 }
  const B = { x: 470, y: 132 }
  const ctrl = { x: 270, y: 10 }
  const at = (u: number) => ({
    x: (1 - u) * (1 - u) * A.x + 2 * (1 - u) * u * ctrl.x + u * u * B.x,
    y: (1 - u) * (1 - u) * A.y + 2 * (1 - u) * u * ctrl.y + u * u * B.y,
  })
  const plane = at(fly)
  const ahead = at(Math.min(1, fly + 0.01))
  const ang = (Math.atan2(ahead.y - plane.y, ahead.x - plane.x) * 180) / Math.PI

  return (
    <div ref={ref}>
      <Stage note="Example fares.">
        <div className="ag-grid">
          <svg viewBox="0 0 540 220" className="ag-sky" role="img" aria-label="Route from San Jose to New York">
            <defs>
              <linearGradient id="ag-horizon" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="rgba(243,237,232,.16)" />
                <stop offset="1" stopColor="rgba(243,237,232,0)" />
              </linearGradient>
            </defs>
            {Array.from({ length: 5 }).map((_, i) => (
              <ellipse key={i} cx="270" cy={420 + i * 6} rx={360 - i * 30} ry={240 - i * 12} fill="none" stroke="rgba(243,237,232,.08)" />
            ))}
            <path d="M-20 200 Q 270 150 560 200" fill="none" stroke="url(#ag-horizon)" strokeWidth="40" />
            <path d={`M${A.x} ${A.y} Q ${ctrl.x} ${ctrl.y} ${B.x} ${B.y}`} fill="none" stroke="rgba(243,237,232,.25)" strokeDasharray="3 6" />
            <path
              d={`M${A.x} ${A.y} Q ${ctrl.x} ${ctrl.y} ${B.x} ${B.y}`}
              fill="none"
              stroke="#E0707F"
              strokeWidth="2"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={1 - fly}
            />
            <circle cx={A.x} cy={A.y} r="4" fill="#F3EDE8" />
            <circle cx={B.x} cy={B.y} r="4" fill={fly >= 1 ? '#E0707F' : '#F3EDE8'} />
            <g className={mono.className} fontSize="12" fill="rgba(243,237,232,.75)">
              <text x={A.x} y={A.y + 22} textAnchor="middle">SJC</text>
              <text x={B.x} y={B.y + 22} textAnchor="middle">JFK</text>
            </g>
            {fly > 0 && fly < 1 && (
              <g transform={`translate(${plane.x} ${plane.y}) rotate(${ang})`}>
                <path d="M-9 -5 L9 0 L-9 5 L-5 0 Z" fill="#F3EDE8" />
              </g>
            )}
          </svg>

          <div>
            <div className="ag-table" role="table" aria-label="Round trip fares by departure and return date">
              <div className="ag-corner" />
              {RET.map((r) => (
                <div key={r} className={`ag-h ${mono.className}`} role="columnheader">
                  {r.replace('Nov ', '')}
                </div>
              ))}
              {DEP.map((d, di) => (
                <div key={d} className="contents" role="row">
                  <div className={`ag-h ${mono.className}`} role="rowheader">
                    {d.replace('Nov ', '')}
                  </div>
                  {RET.map((_, ri) => {
                    const c = cells[di * 7 + ri]
                    const order = (di + ri) / 12
                    const shown = fill >= order
                    const heat = (c.p - min) / (max - min)
                    const isBest = found && c === best
                    return (
                      <div
                        key={ri}
                        role="cell"
                        className={`ag-cell ${mono.className} ${shown ? 'in' : ''} ${isBest ? 'best' : ''}`}
                        style={{ ['--h' as string]: heat }}
                      >
                        {shown ? `$${c.p}` : ''}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
            <p className="ag-pick">
              <span className="demo-label">Cheapest pair</span>
              <span className={`${mono.className} tnum`}>
                {found ? `${DEP[best.d]} to ${RET[best.r]}, $${best.p}` : 'Reading the grid'}
              </span>
            </p>
          </div>
        </div>
      </Stage>
    </div>
  )
}
