'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Netlist, SimResult } from '@/vendor/spicepp/sim/types'
import { Stage, mono, useClock, useLive } from './shared'

/**
 * A series RLC step response solved by the real SPICE++ engine (vendored, unmodified) in this
 * browser tab. Drag a value and the circuit is re-simulated on the next frame.
 */

type Sim = { t: number[]; vin: number[]; vout: number[]; i: number[]; ms: number; points: number; size: number }

const TSTOP = 0.005
const STEP = 5 // volts

// Log-scaled sliders: position 0..1000 -> value.
const scale = (min: number, max: number) => ({
  to: (p: number) => min * Math.pow(max / min, p / 1000),
  from: (v: number) => (1000 * Math.log(v / min)) / Math.log(max / min),
})
const R = scale(2, 400)
const L = scale(1e-3, 50e-3)
const C = scale(0.1e-6, 10e-6)

const fmt = (v: number, unit: string) => {
  const a = Math.abs(v) * 1.0005
  const [m, s] = a >= 1e3 ? [1e-3, 'k'] : a >= 1 ? [1, ''] : a >= 1e-3 ? [1e3, 'm'] : a >= 1e-6 ? [1e6, 'µ'] : [1e9, 'n']
  const n = v * m
  return `${n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)} ${s}${unit}`
}

function netlist(r: number, l: number, c: number): Netlist {
  return {
    nodes: ['in', 'a', 'out'],
    errors: [],
    elements: [
      { type: 'V', name: 'V1', n1: 'in', n2: '0', dc: 0, tran: { kind: 'pulse', v1: 0, v2: STEP, td: 0.0002, tr: 1e-6, tf: 1e-6, pw: 0.0026, per: 0.01 } },
      { type: 'R', name: 'R1', n1: 'in', n2: 'a', value: r },
      { type: 'L', name: 'L1', n1: 'a', n2: 'out', value: l },
      { type: 'C', name: 'C1', n1: 'out', n2: '0', value: c },
    ],
    analyses: [{ kind: 'tran', tstep: 4e-6, tstop: TSTOP, tstart: 0, uic: false }],
  }
}

// Schematic loop the current dots travel along (source on the left, clockwise).
const LOOP = 'M48 150 V54 H318 V196 H48 Z'

export function SpiceLive() {
  const { ref, live, reduced } = useLive<HTMLDivElement>()
  const engine = useRef<typeof import('@/vendor/spicepp/sim/engine') | null>(null)
  const [pos, setPos] = useState({ r: R.from(20), l: L.from(10e-3), c: C.from(1e-6) })
  const [sim, setSim] = useState<Sim | null>(null)
  const pending = useRef(0)

  const r = R.to(pos.r)
  const l = L.to(pos.l)
  const c = C.to(pos.c)

  const run = useCallback(() => {
    const eng = engine.current
    if (!eng) return
    const t0 = performance.now()
    const res: SimResult = eng.simulate(netlist(r, l, c))[0]
    const ms = performance.now() - t0
    if (!res?.converged) return
    setSim({
      t: res.sweep,
      vin: res.signals['V(in)'],
      vout: res.signals['V(out)'],
      i: res.signals['I(L1)'],
      ms,
      points: res.stats?.points ?? res.sweep.length,
      size: res.stats?.matrixSize ?? 0,
    })
  }, [r, l, c])

  // Load the engine once the demo is near, then solve.
  useEffect(() => {
    if (!live || engine.current) return
    let gone = false
    import('@/vendor/spicepp/sim/engine').then((m) => {
      if (gone) return
      engine.current = m
      run()
    })
    return () => {
      gone = true
    }
  }, [live, run])

  // Re-solve on the next frame after any change.
  useEffect(() => {
    if (!engine.current) return
    cancelAnimationFrame(pending.current)
    pending.current = requestAnimationFrame(run)
    return () => cancelAnimationFrame(pending.current)
  }, [run])

  // Scope geometry.
  const W = 600
  const H = 300
  const scope = useMemo(() => {
    if (!sim) return null
    const top = Math.max(STEP * 1.15, ...sim.vout) * 1.05
    const bot = Math.min(-0.5, ...sim.vout) * 1.05
    const x = (t: number) => (t / TSTOP) * W
    const y = (v: number) => H - ((v - bot) / (top - bot)) * H
    const path = (vs: number[]) => {
      let d = ''
      const n = vs.length
      const stride = Math.max(1, Math.floor(n / 900))
      for (let k = 0; k < n; k += stride) d += `${k ? 'L' : 'M'}${x(sim.t[k]).toFixed(1)} ${y(vs[k]).toFixed(1)}`
      return d
    }
    const peak = Math.max(...sim.vout)
    const iMax = Math.max(1e-9, ...sim.i.map(Math.abs))
    return { out: path(sim.vout), inp: path(sim.vin), y0: y(0), yS: y(STEP), peak, iMax, x, y }
  }, [sim])

  // Physics readouts.
  const zeta = (r / 2) * Math.sqrt(c / l)
  const f0 = 1 / (2 * Math.PI * Math.sqrt(l * c))
  const regime = zeta < 0.98 ? 'Underdamped, it rings' : zeta > 1.02 ? 'Overdamped, it creeps' : 'Critically damped'
  const overshoot = scope ? Math.max(0, ((scope.peak - STEP) / STEP) * 100) : 0

  // Playback: a playhead sweeps the trace; dots move with the inductor current at that instant.
  const loopRef = useRef<SVGPathElement>(null)
  const dotsRef = useRef<SVGGElement>(null)
  const headRef = useRef<SVGGElement>(null)
  const readRef = useRef<HTMLSpanElement>(null)
  const travel = useRef(0)
  useClock(live && !reduced && !!sim, (t, dt) => {
    if (!sim || !scope || !loopRef.current || !dotsRef.current || !headRef.current) return
    const phase = (t % 4.2) / 4.2
    const k = Math.min(sim.t.length - 1, Math.floor(phase * sim.t.length))
    const i = sim.i[k]
    travel.current += (i / scope.iMax) * 140 * dt
    const len = loopRef.current.getTotalLength()
    const dots = dotsRef.current.children
    for (let d = 0; d < dots.length; d++) {
      const s = (((travel.current + (d * len) / dots.length) % len) + len) % len
      const p = loopRef.current.getPointAtLength(s)
      ;(dots[d] as SVGCircleElement).setAttribute('cx', p.x.toFixed(1))
      ;(dots[d] as SVGCircleElement).setAttribute('cy', p.y.toFixed(1))
      ;(dots[d] as SVGCircleElement).setAttribute('opacity', String(0.25 + 0.75 * Math.min(1, Math.abs(i) / scope.iMax)))
    }
    headRef.current.setAttribute('transform', `translate(${scope.x(sim.t[k]).toFixed(1)} 0)`)
    const dot = headRef.current.querySelector('circle')
    dot?.setAttribute('cy', scope.y(sim.vout[k]).toFixed(1))
    if (readRef.current) readRef.current.textContent = `${(sim.t[k] * 1e3).toFixed(2)} ms   ${sim.vout[k].toFixed(2)} V`
  })

  return (
    <div ref={ref}>
      <Stage
        caption={
          <>
            <span>
              {sim
                ? `Solved ${sim.points.toLocaleString()} time points on a ${sim.size} by ${sim.size} matrix in ${sim.ms.toFixed(1)} ms, in this tab.`
                : 'Loading the SPICE++ engine.'}
            </span>
            <span>The real SPICE++ engine, unmodified.</span>
          </>
        }
      >
        <div className="spice-grid">
          {/* Schematic */}
          <svg viewBox="0 0 410 250" className="spice-sch" role="img" aria-label={`Series circuit: a 5 volt step source, a ${fmt(r, 'Ω')} resistor, a ${fmt(l, 'H')} inductor and a ${fmt(c, 'F')} capacitor`}>
            <path ref={loopRef} d={LOOP} fill="none" stroke="none" />
            <g fill="none" stroke="rgba(243,237,232,.7)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
              <path d="M48 54 H88 M136 54 H170 M250 54 H318 V112 M318 138 V196 H48 V164 M48 136 V54" />
              {/* resistor */}
              <path d="M88 54 l5 -9 l8 18 l8 -18 l8 18 l8 -18 l8 18 l5 -9" stroke="#E0707F" />
              {/* inductor */}
              <path d="M170 54 c0 -16 20 -16 20 0 c0 -16 20 -16 20 0 c0 -16 20 -16 20 0 c0 -16 20 -16 20 0" stroke="#E0707F" />
              {/* capacitor */}
              <path d="M300 112 H336 M300 138 H336" stroke="#E0707F" strokeWidth="3" />
              {/* source */}
              <circle cx="48" cy="150" r="14" />
              <path d="M42 150 h4 v-6 h4 v12 h4" />
              {/* ground */}
              <path d="M168 196 v12 M156 208 h24 M161 214 h14 M166 220 h4" />
            </g>
            <g ref={dotsRef} fill="#F3EDE8">
              {Array.from({ length: 14 }).map((_, d) => (
                <circle key={d} r="2.6" cx="-10" cy="-10" />
              ))}
            </g>
            <g className={mono.className} fill="rgba(243,237,232,.86)" fontSize="13">
              <text x="112" y="32" textAnchor="middle">R {fmt(r, 'Ω')}</text>
              <text x="210" y="32" textAnchor="middle">L {fmt(l, 'H')}</text>
              <text x="344" y="130" textAnchor="start" dominantBaseline="middle">C</text>
              <text x="344" y="148" textAnchor="start" fontSize="11" fill="rgba(243,237,232,.6)">{fmt(c, 'F')}</text>
              <text x="12" y="182" fontSize="11" fill="rgba(243,237,232,.6)">5 V step</text>
              <text x="326" y="48" fontSize="11" fill="rgba(243,237,232,.6)">out</text>
            </g>
          </svg>

          {/* Scope */}
          <div className="spice-scope">
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="spice-plot" aria-hidden="true">
              <g stroke="rgba(243,237,232,.08)" strokeWidth="1" vectorEffect="non-scaling-stroke">
                {Array.from({ length: 11 }).map((_, k) => (
                  <line key={`v${k}`} x1={(k * W) / 10} x2={(k * W) / 10} y1="0" y2={H} vectorEffect="non-scaling-stroke" />
                ))}
                {Array.from({ length: 7 }).map((_, k) => (
                  <line key={`h${k}`} y1={(k * H) / 6} y2={(k * H) / 6} x1="0" x2={W} vectorEffect="non-scaling-stroke" />
                ))}
              </g>
              {scope && (
                <>
                  <line x1="0" x2={W} y1={scope.yS} y2={scope.yS} stroke="rgba(243,237,232,.22)" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
                  <path d={scope.inp} fill="none" stroke="rgba(243,237,232,.45)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                  <path d={scope.out} fill="none" stroke="#E0707F" strokeWidth="2.25" vectorEffect="non-scaling-stroke" className="spice-trace" />
                  <g ref={headRef}>
                    <line y1="0" y2={H} stroke="rgba(243,237,232,.35)" vectorEffect="non-scaling-stroke" />
                    <circle r="5" cx="0" cy="-20" fill="#F3EDE8" />
                  </g>
                </>
              )}
            </svg>
            <div className={`spice-read ${mono.className}`}>
              <span>
                <i style={{ background: '#E0707F' }} /> V(out)
              </span>
              <span>
                <i style={{ background: 'rgba(243,237,232,.45)' }} /> V(in)
              </span>
              <span ref={readRef} className="ml-auto tnum" />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="spice-ctl">
          {(
            [
              ['r', 'Resistance', fmt(r, 'Ω'), R],
              ['l', 'Inductance', fmt(l, 'H'), L],
              ['c', 'Capacitance', fmt(c, 'F'), C],
            ] as const
          ).map(([key, label, val]) => (
            <label key={key} className="spice-knob">
              <span className="flex items-baseline justify-between">
                <span className="demo-label">{label}</span>
                <span className={`${mono.className} tnum text-[14px]`}>{val}</span>
              </span>
              <input
                type="range"
                min={0}
                max={1000}
                step={1}
                value={pos[key]}
                onChange={(e) => setPos((p) => ({ ...p, [key]: +e.target.value }))}
                className="demo-range"
                aria-label={label}
                aria-valuetext={val}
              />
            </label>
          ))}
          <div className="spice-facts">
            <div>
              <span className="demo-label">Response</span>
              <span>{regime}</span>
            </div>
            <div>
              <span className="demo-label">Overshoot</span>
              <span className={`${mono.className} tnum`}>{overshoot.toFixed(0)}%</span>
            </div>
            <div>
              <span className="demo-label">Natural frequency</span>
              <span className={`${mono.className} tnum`}>{fmt(f0, 'Hz')}</span>
            </div>
          </div>
        </div>
      </Stage>
    </div>
  )
}
