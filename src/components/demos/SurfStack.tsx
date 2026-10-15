'use client'

import { useState } from 'react'
import { Stage, mono, useClock, useLive } from './shared'

/**
 * Surf's shape, drawn from its repository: one Next.js codebase served to every client, on a
 * Postgres database where access is enforced by row-level security. Counts are measured from
 * the repo; requests travel the lines.
 */

const CLIENTS = [
  { k: 'Web', s: 'Browser and installable app' },
  { k: 'iOS', s: 'Capacitor shell' },
  { k: 'Android', s: 'Capacitor shell' },
  { k: 'Mac and Windows', s: 'Electron, Surf Messenger' },
]

const APP = [
  ['155', 'pages'],
  ['228', 'API routes'],
  ['17', 'edge functions'],
]
const DB = [
  ['1,935', 'migrations'],
  ['859', 'row-level security policies'],
]

export function SurfStack() {
  const { ref, live, reduced } = useLive<HTMLDivElement>()
  const [t, setT] = useState(0)
  useClock(live && !reduced, (time) => setT(time))

  // Four request pulses, staggered: client to app to database and back.
  const pulse = (i: number) => {
    const p = ((t * 0.42 + i * 0.25) % 1 + 1) % 1
    return p
  }

  // Geometry in a 1000 x 360 box (desktop); the mobile layout is a stack.
  const cx = (i: number) => 125 + i * 250
  return (
    <div ref={ref}>
      <Stage
        caption={
          <>
            <span>Counts measured from the Surf repository.</span>
            <span>24,249 tests and 115 end to end specs in the repo.</span>
          </>
        }
      >
        <div className="ss-wrap">
          <svg viewBox="0 0 1000 380" className="ss-svg" aria-hidden="true">
            {CLIENTS.map((_, i) => (
              <path key={i} id={`ss-l${i}`} d={`M${cx(i)} 92 C ${cx(i)} 150, 500 130, 500 186`} fill="none" stroke="rgba(243,237,232,.16)" strokeWidth="1.5" />
            ))}
            <path d="M500 250 V 292" stroke="rgba(243,237,232,.16)" strokeWidth="1.5" />
            {CLIENTS.map((_, i) => {
              const p = pulse(i)
              const down = p < 0.5
              const u = down ? p * 2 : (1 - p) * 2
              // point along cubic from client (u=0) to app (u=1)
              const x0 = cx(i), y0 = 92, x1 = cx(i), y1 = 150, x2 = 500, y2 = 130, x3 = 500, y3 = 186
              const a = 1 - u
              const x = a * a * a * x0 + 3 * a * a * u * x1 + 3 * a * u * u * x2 + u * u * u * x3
              const y = a * a * a * y0 + 3 * a * a * u * y1 + 3 * a * u * u * y2 + u * u * u * y3
              return <circle key={i} cx={x} cy={y} r="3.5" fill={down ? '#F3EDE8' : '#E0707F'} opacity={reduced ? 0 : 0.9} />
            })}
            {!reduced && (
              <circle cx="500" cy={250 + ((t * 0.9) % 1) * 42} r="3.5" fill="#E0707F" opacity={0.9} />
            )}
          </svg>

          <div className="ss-layer ss-clients">
            {CLIENTS.map((c) => (
              <div key={c.k} className="ss-node">
                <p>{c.k}</p>
                <p className="demo-label">{c.s}</p>
              </div>
            ))}
          </div>

          <div className="ss-layer ss-app">
            <div className="ss-core">
              <p>One Next.js codebase</p>
              <div className={`ss-nums ${mono.className}`}>
                {APP.map(([n, l]) => (
                  <span key={l}>
                    <b>{n}</b> {l}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="ss-layer ss-db">
            <div className="ss-core db">
              <p>Supabase Postgres</p>
              <div className={`ss-nums ${mono.className}`}>
                {DB.map(([n, l]) => (
                  <span key={l}>
                    <b>{n}</b> {l}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Stage>
    </div>
  )
}
