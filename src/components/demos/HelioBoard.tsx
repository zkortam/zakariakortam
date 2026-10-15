'use client'

import { Caveat } from 'next/font/google'
import { useId, useMemo, useState, type FormEvent } from 'react'
import { Stage, mono, useClock, useLive } from './shared'
import { AlgebraError, solve, type Solution } from './helio/algebra'

const hand = Caveat({ subsets: ['latin'], weight: ['500', '600'], display: 'swap' })

/**
 * Helio's two-line beat on an equation the visitor types: an exact rational engine plans the steps,
 * each step's claim is checked first (verify before speech), then the ink is written while the line
 * is spoken, word by word. The answer is circled and checked by substitution into the original.
 */

const DEFAULT = '3(x − 2) = 2x + 5'
const EXAMPLES = ['4(x + 3) = 2x − 6', 'x/2 + 1 = 5', '5 − 2x = 3(x + 5)']
const BEAT = 3.2 // seconds per beat
const CHECK = 0.16 // share of a beat spent verifying before anything is said

export function HelioBoard() {
  const { ref, live, reduced } = useLive<HTMLDivElement>()
  const errId = useId()
  const [text, setText] = useState(DEFAULT)
  const [sol, setSol] = useState<Solution>(() => solve(DEFAULT))
  const [err, setErr] = useState<string | null>(null)
  const [t, setT] = useState(0)

  const n = sol.beats.length
  const end = BEAT * n
  useClock(live && !reduced && t < end + 1, (_, dt) => setT((v) => Math.min(end + 1, v + dt)))
  const now = reduced || !Number.isFinite(t) ? end + 1 : Math.max(0, t)

  const submit = (value: string) => {
    try {
      const s = solve(value)
      setSol(s)
      setErr(null)
      setT(0)
    } catch (e) {
      setErr(e instanceof AlgebraError ? e.message : 'That does not read as an equation yet.')
    }
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit(text)
  }

  const b = Math.max(0, Math.min(n - 1, Math.floor(now / BEAT)))
  const local = Math.min(1, (now - b * BEAT) / BEAT)
  const finished = now >= end
  const beat = sol.beats[b]
  const speaking = !finished && local > CHECK
  const words = beat.say.split(' ')
  const spoken = finished ? words.length : Math.floor(Math.max(0, (local - CHECK) / 0.62) * words.length)
  const ink = (i: number) => (i < b || finished ? 1 : i === b ? Math.min(1, Math.max(0, (local - CHECK) / 0.55)) : 0)
  const circled = finished || (b === n - 1 && local > 0.8)
  const unverified = sol.beats.slice(0, b + 1).some((x) => !x.verified)

  const fit = useMemo(() => {
    const chars = Math.max(10, ...sol.beats.map((x) => x.ink.length))
    const scale = n <= 4 ? 1 : n <= 5 ? 0.86 : 0.74
    return { ['--chars' as string]: chars, ['--scale' as string]: scale }
  }, [sol, n])

  let pill = `Checking ${beat.claim}`
  if (unverified) pill = 'Could not verify this step, so it is not spoken'
  else if (finished) pill = sol.kind === 'one' ? `Checked: ${sol.check}` : sol.check
  else if (speaking) pill = beat.ok

  return (
    <div ref={ref}>
      <Stage
        caption={
          <>
            <span>Every step is planned and checked with exact fractions before the tutor says it.</span>
            <span>Slowed down so you can watch the beat.</span>
          </>
        }
      >
        <div className="hb-wrap">
          <form className="hb-form" onSubmit={onSubmit} noValidate>
            <label className="demo-label" htmlFor={`${errId}-in`}>
              Your equation
            </label>
            <div className="hb-row">
              <input
                id={`${errId}-in`}
                className={`hb-in ${mono.className}`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={60}
                inputMode="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="go"
                aria-invalid={!!err}
                aria-describedby={err ? errId : undefined}
                placeholder="4(x + 3) = 2x − 6"
              />
              <button type="submit" className="demo-btn">
                Solve
              </button>
            </div>
            <p className="hb-err" id={errId} role="status" aria-live="polite">
              {err ?? ''}
            </p>
            <div className="hb-try">
              <span className="demo-label">Try</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  className={`hb-ex ${mono.className}`}
                  onClick={() => {
                    setText(ex)
                    submit(ex)
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </form>

          <div className="hb-board">
            <div className="hb-head">
              <span>Grade 8 math</span>
              <span className={`hb-check ${mono.className} ${unverified ? 'no' : speaking || finished ? 'ok' : ''}`} aria-live="polite">
                <span className="hb-tick" aria-hidden="true">
                  {unverified ? '×' : speaking || finished ? '✓' : '…'}
                </span>
                <span className="hb-pill">{pill}</span>
              </span>
            </div>
            <div className={`hb-lines ${hand.className}`} style={fit} role="img" aria-label={`${sol.beats.map((x) => x.ink).join(', then ')}. Answer: ${sol.answer}.`}>
              {sol.beats.map((x, i) => {
                const p = ink(i)
                const last = i === n - 1
                return (
                  <div key={`${sol.beats[0].ink}-${i}`} className={`hb-line ${last ? 'ans' : ''}`}>
                    <span className="hb-ink" style={{ clipPath: `inset(-20% ${(1 - p) * 100}% -20% 0)` }}>
                      {x.ink}
                    </span>
                    {last && (
                      <svg className="hb-circle" viewBox="0 0 200 80" preserveAspectRatio="none" aria-hidden="true">
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
              <p className="hb-say" aria-live="off">
                {words.map((w, i) => (
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
