'use client'

import { Caveat } from 'next/font/google'
import { useState } from 'react'
import { Stage, mono, useClock, useLive } from './shared'

const hand = Caveat({ subsets: ['latin'], weight: ['500', '600'], display: 'swap' })

/**
 * Helio's two-line beat, slowed down so you can watch it: each step's claim is checked first
 * (verify before speech), then the ink is written while the line is spoken, word by word.
 */

const BEATS = [
  { ink: '3(x − 2) = 2x + 5', say: 'Let’s solve this one together.', claim: 'Reading the problem', ok: 'Problem parsed' },
  { ink: '3x − 6 = 2x + 5', say: 'First, multiply the 3 into the brackets.', claim: '3(x − 2) = 3x − 6', ok: '3(x − 2) = 3x − 6' },
  { ink: 'x − 6 = 5', say: 'Now take 2x away from both sides.', claim: '3x − 2x = x', ok: '3x − 2x = x' },
  { ink: 'x = 11', say: 'Add 6 to both sides. So x is 11.', claim: '5 + 6 = 11', ok: '5 + 6 = 11, and 3(11 − 2) = 27 = 2(11) + 5' },
] as const

const BEAT = 3.4 // seconds per beat
const CHECK = 0.16 // share of a beat spent verifying before anything is said
const TOTAL = BEAT * BEATS.length + 2.2

export function HelioBoard() {
  const { ref, live, reduced } = useLive<HTMLDivElement>()
  const [t, setT] = useState(0)
  useClock(live && !reduced, (time) => setT(time % TOTAL))
  const now = reduced ? TOTAL - 0.01 : t

  const b = Math.min(BEATS.length - 1, Math.floor(now / BEAT))
  const local = Math.min(1, (now - b * BEAT) / BEAT)
  const finished = now >= BEAT * BEATS.length
  const speaking = !finished && local > CHECK
  const say = BEATS[b].say.split(' ')
  const spoken = finished ? say.length : Math.floor(Math.max(0, (local - CHECK) / 0.62) * say.length)
  const ink = (i: number) => (i < b || finished ? 1 : i === b ? Math.min(1, Math.max(0, (local - CHECK) / 0.55)) : 0)
  const circled = finished || (b === BEATS.length - 1 && local > 0.8)

  return (
    <div ref={ref}>
      <Stage
        caption={
          <>
            <span>Each step is checked before the tutor says it, then written while it is spoken.</span>
            <span>Slowed down so you can watch the beat.</span>
          </>
        }
      >
        <div className="hb-wrap">
          <div className="hb-board">
            <div className="hb-head">
              <span>Grade 8 math</span>
              <span className={`hb-check ${mono.className} ${speaking || finished ? 'ok' : ''}`}>
                <span className="hb-tick" aria-hidden="true">{speaking || finished ? '✓' : '…'}</span>
                {finished ? 'Answer checked by substitution' : speaking ? BEATS[b].ok : `Checking ${BEATS[b].claim}`}
              </span>
            </div>
            <div className={`hb-lines ${hand.className}`}>
              {BEATS.map((beat, i) => {
                const p = ink(i)
                const last = i === BEATS.length - 1
                return (
                  <div key={i} className={`hb-line ${last ? 'ans' : ''}`} aria-hidden={p === 0}>
                    <span className="hb-ink" style={{ clipPath: `inset(-20% ${(1 - p) * 100}% -20% 0)` }}>
                      {beat.ink}
                    </span>
                    {last && (
                      <svg className="hb-circle" viewBox="0 0 200 80" aria-hidden="true">
                        <path
                          d="M18 42 C 18 14, 182 10, 186 38 C 190 66, 30 74, 16 46 C 10 34, 40 18, 70 16"
                          pathLength={1}
                          style={{ strokeDashoffset: circled ? 0 : 1 }}
                        />
                      </svg>
                    )}
                    {p > 0 && p < 1 && <span className="hb-pen" style={{ left: `${p * 100}%` }} />}
                  </div>
                )
              })}
            </div>
            <div className="hb-foot">
              <p className="hb-say">
                {say.map((w, i) => (
                  <span key={`${b}-${i}`} className={i < spoken ? 'on' : ''}>
                    {w}{' '}
                  </span>
                ))}
              </p>
              <span className={`hb-voice ${speaking ? 'live' : ''}`} aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <i key={i} style={{ animationDelay: `${i * 90}ms` }} />
                ))}
                Speaking
              </span>
            </div>
          </div>
        </div>
      </Stage>
    </div>
  )
}
