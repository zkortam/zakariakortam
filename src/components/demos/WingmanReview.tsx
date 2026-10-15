'use client'

import { useState } from 'react'
import { Stage, mono, useClock, useLive } from './shared'

/**
 * Wingman's control point: every proposed tool call gets ALLOW, RETHINK or ESCALATE before the
 * host runs it. Then the evidence side: a fix ships only if the same assertion fails before the
 * change and passes after it. Example session; the verdicts and the repair rule are Wingman's.
 */

const CALLS = [
  {
    ask: 'Book me the morning flight. Nothing after noon.',
    call: 'book_flight({ "depart": "14:05", "seat": "aisle" })',
    verdict: 'RETHINK',
    why: 'Drops a constraint the user stated: nothing after noon.',
  },
  {
    ask: 'Clean up the test rows in customers.',
    call: 'delete_rows({ "table": "customers", "where": null })',
    verdict: 'ESCALATE',
    why: 'Destructive and unfiltered. A human approves this, not the agent.',
  },
  {
    ask: 'What is our refund window?',
    call: 'search_docs({ "query": "refund policy" })',
    verdict: 'ALLOW',
    why: 'Read only, matches the request.',
  },
] as const

const STEP = 2.6
const REPAIR = 5
const TOTAL = CALLS.length * STEP + REPAIR

export function WingmanReview() {
  const { ref, live, reduced } = useLive<HTMLDivElement>()
  const [t, setT] = useState(0)
  useClock(live && !reduced, (time) => setT(time % TOTAL))
  const now = reduced ? TOTAL - 0.01 : t

  const shown = Math.min(CALLS.length, Math.floor(now / STEP) + 1)
  const local = (now % STEP) / STEP
  const inRepair = now >= CALLS.length * STEP
  const r = inRepair ? (now - CALLS.length * STEP) / REPAIR : 0

  const repair = [
    { k: 'Friction', v: 'User restated “nothing after noon” twice', on: r > 0.05 },
    { k: 'Assertion', v: 'book_flight.depart ≤ 12:00', on: r > 0.22 },
    { k: 'Before', v: 'FAIL on the recorded session', on: r > 0.38, bad: true },
    { k: 'Change', v: 'Policy v13: carry stated time limits into tool args', on: r > 0.54 },
    { k: 'After', v: 'PASS on the same replay, model only, no tools run', on: r > 0.7, good: true },
    { k: 'Rollout', v: 'Signed, applied to one user, revertible', on: r > 0.86 },
  ]

  return (
    <div ref={ref}>
      <Stage
        caption={
          <>
            <span>Example session. ALLOW, RETHINK and ESCALATE are Wingman&apos;s real verdicts, returned before the host executes anything.</span>
            <span>Nothing ships without fail before, pass after.</span>
          </>
        }
      >
        <div className={`wm-grid ${mono.className}`}>
          <div className="wm-term">
            <p className="wm-bar">agent host · wingman review</p>
            <div className="wm-body">
              {CALLS.slice(0, inRepair ? CALLS.length : shown).map((c, i) => {
                const current = !inRepair && i === shown - 1
                const verdictOn = !current || local > 0.45
                return (
                  <div key={i} className="wm-call">
                    <p className="wm-user">› {c.ask}</p>
                    <p className="wm-prop">
                      <span className="wm-k">proposed</span> {c.call}
                    </p>
                    <p className={`wm-verdict ${verdictOn ? 'in' : ''}`}>
                      <span className={`wm-chip ${c.verdict.toLowerCase()}`}>{c.verdict}</span>
                      <span className="wm-why">{c.why}</span>
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="wm-proof">
            <p className="demo-label">Verified repair</p>
            {repair.map((s) => (
              <div key={s.k} className={`wm-step ${s.on ? 'in' : ''} ${s.bad ? 'bad' : ''} ${s.good ? 'good' : ''}`}>
                <span className="wm-k">{s.k}</span>
                <span>{s.v}</span>
              </div>
            ))}
          </div>
        </div>
      </Stage>
    </div>
  )
}
