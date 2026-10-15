'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Stage, mono, useClock, useLive } from './shared'

/**
 * The RTL++ debugging story on its own counter example: the test fails at 100 ns, the trace
 * walks the wrong value back to the line that set it, the fix lands, and the rerun passes.
 * The waveforms are computed from the RTL below, cycle by cycle.
 */

const MAX = 9
const T_END = 100 // ns
const PERIOD = 10

type Phase = 'run' | 'fail' | 'why1' | 'why2' | 'why3' | 'fix' | 'rerun' | 'pass'
const SCRIPT: [Phase, number][] = [
  ['run', 2.6],
  ['fail', 1.2],
  ['why1', 1.8],
  ['why2', 1.8],
  ['why3', 1.8],
  ['fix', 1.6],
  ['rerun', 2.6],
  ['pass', 2.4],
]
const TOTAL = SCRIPT.reduce((a, [, d]) => a + d, 0)

/** Simulate the counter: rst high until 15 ns, en from 15 ns, rising edges every 10 ns from 5 ns. */
function simulate(fixed: boolean) {
  const edges: { t: number; count: number }[] = [{ t: 0, count: 0 }]
  let count = 0
  for (let t = 5; t <= T_END; t += PERIOD) {
    const rst = t < 15
    const en = t >= 15
    if (rst) count = 0
    else if (en) count = (fixed ? count === MAX : count === MAX - 1) ? 0 : count + 1
    edges.push({ t, count })
  }
  return edges
}

const CODE = [
  ['c', '// Counts from 0 to MAX while en is high, then wraps to 0.'],
  ['k', 'module counter #('],
  ['', '    parameter int WIDTH = 8,'],
  ['', '    parameter int MAX = 9'],
  ['k', ') ('],
  ['', '    input  logic             clk,'],
  ['', '    input  logic             rst,'],
  ['', '    input  logic             en,'],
  ['', "    output logic [WIDTH-1:0] count = '0,"],
  ['', '    output logic             wrap'],
  ['k', ');'],
  ['k', '    always_ff @(posedge clk) begin'],
  ['', '        if (rst)'],
  ['', "            count <= '0;"],
  ['', '        else if (en)'],
  ['bug', "            count <= (count == MAX - 1) ? '0 : count + 1'b1;"],
  ['k', '    end'],
  ['', ''],
  ['', '    assign wrap = en && (count == MAX);'],
  ['k', 'endmodule'],
] as const
const BUG_LINE = 15
const RST_LINE = 6

const WHY = [
  { id: 'why1', head: 'count 0, expected 9, at 95 ns', body: 'Set by line 16, because count was 8 and 8 == MAX - 1.' },
  { id: 'why2', head: 'count 1 to 8, over 8 edges', body: 'Line 16 on every edge from 15 ns to 85 ns, en high, rst low.' },
  { id: 'why3', head: 'rst 0 at 15 ns', body: 'Line 7. A primary input, set by the testbench, so not the cause.' },
] as const

export function RtlTrace() {
  const { ref, live, reduced } = useLive<HTMLDivElement>()
  const [t, setT] = useState(reduced ? TOTAL - 0.1 : 0)
  useClock(live && !reduced, (time) => setT(time % TOTAL))

  // Where are we in the story?
  let acc = 0
  let phase: Phase = 'pass'
  let local = 1
  for (const [p, d] of SCRIPT) {
    if (t < acc + d) {
      phase = p
      local = (t - acc) / d
      break
    }
    acc += d
  }
  const order = SCRIPT.map(([p]) => p)
  const at = (p: Phase) => order.indexOf(phase) >= order.indexOf(p)
  const fixed = at('fix')
  const drawing = phase === 'run' ? local : phase === 'rerun' ? local : 1
  const edges = useMemo(() => simulate(fixed), [fixed])

  // Waveform geometry, drawn at the panel's real pixel width so text stays its true size.
  const waveBox = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(640)
  useEffect(() => {
    const el = waveBox.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(320, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const X0 = 64
  const xs = (ns: number) => X0 + (ns / T_END) * (W - X0 - 16)
  const tNow = drawing * T_END
  const rows = ['clk', 'rst', 'en', 'count'] as const
  const RH = 34
  const y0 = (r: number) => 28 + r * (RH + 10)

  let clkPath = `M${xs(0)} ${y0(0) + RH - 6}`
  for (let ns = 0; ns < T_END; ns += 5) {
    const hi = Math.floor(ns / 5) % 2 === 1
    clkPath += ` V${hi ? y0(0) + 6 : y0(0) + RH - 6} H${xs(ns + 5)}`
  }

  const failed = !fixed && at('fail')
  const passed = phase === 'pass'
  const highlight = fixed ? -1 : phase === 'why3' ? RST_LINE : at('why1') ? BUG_LINE : -1

  return (
    <div ref={ref}>
      <Stage
        caption={
          <>
            <span>The counter, the failing test, and the trace are the same ones RTL++ shows on its home page.</span>
            <span>Waveforms computed from the RTL, edge by edge.</span>
          </>
        }
      >
        <div className="rtl-top">
          <span className={mono.className}>tb_counter</span>
          <span className={`rtl-status ${passed ? 'ok' : failed ? 'bad' : ''}`}>
            {passed ? 'Passed, count reached 9' : failed ? 'Failed at 100 ns' : phase === 'rerun' ? 'Running' : 'Running'}
          </span>
          {failed && <span className="rtl-note">After 9 cycles count is 0, expected 9</span>}
        </div>

        <div className="rtl-grid">
          {/* Source */}
          <pre className={`rtl-code ${mono.className}`} aria-label="counter.sv">
            {CODE.map(([k, line], i) => {
              const text = i === BUG_LINE && fixed ? "            count <= (count == MAX) ? '0 : count + 1'b1;" : line
              return (
                <div key={i} className={`rtl-line ${k === 'c' ? 'cm' : ''} ${k === 'k' ? 'kw' : ''} ${highlight === i ? 'hl' : ''} ${i === BUG_LINE && fixed ? 'fixed' : ''}`}>
                  <span className="ln">{i + 1}</span>
                  <span>{text}</span>
                </div>
              )
            })}
          </pre>

          {/* Why chain */}
          <div className="rtl-why">
            <p className="demo-label">{fixed ? 'Fix' : 'Why is count 0 at 100 ns?'}</p>
            {fixed ? (
              <div className="rtl-card show ok">
                <p className={mono.className}>count == MAX - 1 → count == MAX</p>
                <p>The counter wrapped one cycle early. Compare against MAX and run again.</p>
              </div>
            ) : (
              WHY.map((w) => (
                <div key={w.id} className={`rtl-card ${at(w.id as Phase) ? 'show' : ''} ${phase === w.id ? 'on' : ''}`}>
                  <p className={mono.className}>{w.head}</p>
                  <p>{w.body}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Waves */}
        <div ref={waveBox} className="rtl-wave">
        <svg viewBox={`0 0 ${W} ${y0(4) + 8}`} width="100%" aria-label="Waveforms for clk, rst, en and count from 0 to 100 nanoseconds">
          <defs>
            <clipPath id="rtl-clip">
              <rect x="0" y="0" width={xs(tNow)} height="400" />
            </clipPath>
          </defs>
          <g className={mono.className} fontSize="11" fill="rgba(243,237,232,.55)">
            {[0, 20, 40, 60, 80, 100].map((ns) => (
              <text key={ns} x={xs(ns)} y="14" textAnchor="middle">
                {ns} ns
              </text>
            ))}
            {rows.map((r, i) => (
              <text key={r} x="0" y={y0(i) + RH / 2 + 4} fill="rgba(243,237,232,.8)" fontSize="13">
                {r}
              </text>
            ))}
          </g>
          <g clipPath="url(#rtl-clip)" fill="none" strokeWidth="1.75" strokeLinejoin="round">
            <path d={clkPath} stroke="#6E9BFF" />
            <path d={`M${xs(0)} ${y0(1) + 6} H${xs(15)} V${y0(1) + RH - 6} H${xs(T_END)}`} stroke="#E8A35C" />
            <path d={`M${xs(0)} ${y0(2) + RH - 6} H${xs(15)} V${y0(2) + 6} H${xs(T_END)}`} stroke="#E0707F" />
            {edges.map((e, i) => {
              const next = edges[i + 1]?.t ?? T_END
              if (next <= e.t) return null
              const xa = xs(e.t)
              const xb = xs(next)
              const top = y0(3) + 6
              const bot = y0(3) + RH - 6
              const wrong = !fixed && e.t >= 95
              return (
                <g key={i}>
                  <path
                    d={`M${xa} ${(top + bot) / 2} L${xa + 4} ${top} H${xb - 4} L${xb} ${(top + bot) / 2} L${xb - 4} ${bot} H${xa + 4} Z`}
                    stroke={wrong && at('fail') ? '#FF6B6B' : '#5FD0E8'}
                    fill={wrong && at('fail') ? 'rgba(255,107,107,.14)' : 'transparent'}
                  />
                  {xb - xa > 18 && (
                    <text x={(xa + xb) / 2} y={(top + bot) / 2 + 4} textAnchor="middle" fontSize="12" fill="#F3EDE8" stroke="none" className={mono.className}>
                      {e.count}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
          {(phase === 'run' || phase === 'rerun') && (
            <line x1={xs(tNow)} x2={xs(tNow)} y1="20" y2={y0(4)} stroke="rgba(243,237,232,.5)" />
          )}
          {at('fail') && !fixed && <line x1={xs(T_END) - 1} x2={xs(T_END) - 1} y1="20" y2={y0(4)} stroke="#FF6B6B" strokeWidth="2" />}
          {passed && <line x1={xs(T_END) - 1} x2={xs(T_END) - 1} y1="20" y2={y0(4)} stroke="#5BD18B" strokeWidth="2" />}
        </svg>
        </div>
      </Stage>
    </div>
  )
}
