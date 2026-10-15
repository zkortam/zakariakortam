'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Stage, mono, useClock, useLive } from './shared'
import { CIRCUITS, RECT_F, RLC_STEP, fmt, toPos, toValue, type CircuitId } from './spice/circuits'
import type { SpiceJob, SpiceOut } from './spice/spice.worker'

/**
 * Three circuits solved by the real SPICE++ engine (vendored, unmodified) in a worker in this tab:
 * a series RLC step response, an RC low pass swept in frequency, and a half-wave rectifier. Drag a
 * value and the circuit is solved again; the plot, the readouts and the telemetry are the engine's.
 */

const W = 600
const H = 300
const ACCENT = '#E0707F'
const DIM = 'rgba(243,237,232,.45)'

type Sim = SpiceOut & { cid: CircuitId }

function useSpice(start: boolean, onResult: (r: SpiceOut) => void) {
  const worker = useRef<Worker | null>(null)
  const busy = useRef(false)
  const queued = useRef<SpiceJob | null>(null)
  const cb = useRef(onResult)
  cb.current = onResult
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!start || worker.current) return
    const w = new Worker(new URL('./spice/spice.worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    w.onmessage = (e: MessageEvent<SpiceOut>) => {
      busy.current = false
      cb.current(e.data)
      const next = queued.current
      if (next) {
        queued.current = null
        busy.current = true
        w.postMessage(next)
      }
    }
    setReady(true)
    return () => {
      w.terminate()
      worker.current = null
    }
  }, [start])

  // Only the newest request waits; anything older is dropped, so dragging never builds a backlog.
  const solve = (job: SpiceJob) => {
    const w = worker.current
    if (!w) return
    if (busy.current) queued.current = job
    else {
      busy.current = true
      w.postMessage(job)
    }
  }
  return { ready, solve }
}

const interp = (xs: number[], ys: number[], x: number) => {
  if (x <= xs[0]) return ys[0]
  for (let k = 1; k < xs.length; k++) {
    if (xs[k] >= x) {
      const f = (x - xs[k - 1]) / (xs[k] - xs[k - 1])
      return ys[k - 1] + f * (ys[k] - ys[k - 1])
    }
  }
  return ys[ys.length - 1]
}

export function SpiceLive() {
  const { ref, live, near, reduced } = useLive<HTMLDivElement>()
  const [cid, setCid] = useState<CircuitId>('rlc')
  const [pos, setPos] = useState(() =>
    Object.fromEntries(CIRCUITS.map((c) => [c.id, Object.fromEntries(c.knobs.map((k) => [k.key, toPos(k, k.def)]))])) as Record<CircuitId, Record<string, number>>,
  )
  const [sim, setSim] = useState<Sim | null>(null)
  const latest = useRef(0)
  const jobCid = useRef(new Map<number, CircuitId>())

  const circuit = CIRCUITS.find((c) => c.id === cid)!
  const vals = useMemo(() => Object.fromEntries(circuit.knobs.map((k) => [k.key, toValue(k, pos[cid][k.key])])), [circuit, pos, cid])

  const spice = useSpice(near, (r) => {
    const c = jobCid.current.get(r.id)
    jobCid.current.delete(r.id)
    if (!c || !r.ok) return
    setSim({ ...r, cid: c })
  })

  useEffect(() => {
    if (!spice.ready) return
    const id = ++latest.current
    jobCid.current.set(id, cid)
    spice.solve({ id, netlist: circuit.netlist(vals), want: circuit.want })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spice.ready, circuit, vals])

  const current = sim && sim.cid === cid ? sim : null
  const ac = circuit.analysis === 'ac'

  // Plot geometry and the measurements read off the solved data.
  const plot = useMemo(() => {
    if (!current) return null
    const xs = current.x
    if (current.analysis === 'ac') {
      const db = current.y['V(out)']
      const lo = Math.max(-100, Math.min(-40, Math.floor(Math.min(...db) / 20) * 20))
      const hi = 6
      const X = (f: number) => (Math.log10(f) / 7) * W
      const Y = (d: number) => H - ((Math.max(lo, Math.min(hi, d)) - lo) / (hi - lo)) * H
      let d = ''
      xs.forEach((f, k) => (d += `${k ? 'L' : 'M'}${X(f).toFixed(1)} ${Y(db[k]).toFixed(1)}`))
      // −3 dB crossing, interpolated between the two solved frequencies around it (in log f).
      let fc = NaN
      for (let k = 1; k < db.length; k++) {
        if (db[k - 1] >= -3 && db[k] < -3) {
          const f = (-3 - db[k - 1]) / (db[k] - db[k - 1])
          fc = Math.pow(10, Math.log10(xs[k - 1]) + f * (Math.log10(xs[k]) - Math.log10(xs[k - 1])))
          break
        }
      }
      const at = (f: number) => interp(xs.map(Math.log10), db, Math.log10(f))
      const f1 = Math.min(10 * fc, 1e6)
      const slope = at(f1 * 10) - at(f1)
      return { kind: 'ac' as const, paths: [{ d, color: ACCENT, w: 2.25 }], X, Y, fc, slope, at, xs, db, lo }
    }
    const tstop = xs[xs.length - 1]
    const X = (t: number) => (t / tstop) * W
    const vin = current.y['V(in)']
    const vout = current.y['V(out)']
    let top: number
    let bot: number
    if (current.cid === 'rlc') {
      top = Math.max(RLC_STEP * 1.15, ...vout) * 1.05
      bot = Math.min(-0.5, ...vout) * 1.05
    } else {
      const a = Math.max(...vin.map(Math.abs)) * 1.12
      top = a
      bot = -a
    }
    const Y = (v: number) => H - ((v - bot) / (top - bot)) * H
    const path = (vs: number[]) => {
      let d = ''
      const stride = Math.max(1, Math.floor(vs.length / 900))
      for (let k = 0; k < vs.length; k += stride) d += `${k ? 'L' : 'M'}${X(xs[k]).toFixed(1)} ${Y(vs[k]).toFixed(1)}`
      return d
    }
    const iSig = current.y[current.cid === 'rlc' ? 'I(L1)' : 'I(D1)']
    const iMax = Math.max(1e-9, ...iSig.map(Math.abs))
    const peak = Math.max(...vout)
    const lastCycle = xs.findIndex((t) => t >= tstop - 1 / RECT_F)
    const tail = vout.slice(Math.max(0, lastCycle))
    return {
      kind: 'tran' as const,
      paths: [
        { d: path(vin), color: DIM, w: 1.5 },
        { d: path(vout), color: ACCENT, w: 2.25 },
      ],
      X,
      Y,
      zero: Y(0),
      step: Y(RLC_STEP),
      xs,
      vout,
      iSig,
      iMax,
      peak,
      ripple: Math.max(...tail) - Math.min(...tail),
      drop: Math.max(...vin) - peak,
    }
  }, [current])

  // Readout and playhead. Transient circuits play through the solve; a pointer on the plot holds it.
  const loopRef = useRef<SVGPathElement>(null)
  const dotsRef = useRef<SVGGElement>(null)
  const headRef = useRef<SVGGElement>(null)
  const readRef = useRef<HTMLSpanElement>(null)
  const travel = useRef(0)
  const scrub = useRef<number | null>(null)

  const place = (frac: number, dt: number) => {
    if (!plot || !headRef.current) return
    if (plot.kind === 'ac') {
      const f = Math.pow(10, frac * 7)
      const d = plot.at(f)
      headRef.current.setAttribute('transform', `translate(${(frac * W).toFixed(1)} 0)`)
      headRef.current.querySelector('circle')?.setAttribute('cy', plot.Y(d).toFixed(1))
      if (readRef.current) readRef.current.textContent = `${fmt(f, 'Hz')}   ${d.toFixed(1).replace('-', '−')} dB`
      return
    }
    const n = plot.xs.length
    const k = Math.min(n - 1, Math.max(0, Math.floor(frac * n)))
    headRef.current.setAttribute('transform', `translate(${plot.X(plot.xs[k]).toFixed(1)} 0)`)
    headRef.current.querySelector('circle')?.setAttribute('cy', plot.Y(plot.vout[k]).toFixed(1))
    if (readRef.current) readRef.current.textContent = `${(plot.xs[k] * 1e3).toFixed(2)} ms   ${plot.vout[k].toFixed(2).replace('-', '−')} V`
    // Charge carriers move with the current at that instant.
    const loop = loopRef.current
    const dots = dotsRef.current?.children
    if (!loop || !dots) return
    const i = plot.iSig[k]
    travel.current += (i / plot.iMax) * 140 * dt
    const len = loop.getTotalLength()
    for (let d = 0; d < dots.length; d++) {
      const s = (((travel.current + (d * len) / dots.length) % len) + len) % len
      const p = loop.getPointAtLength(s)
      const el = dots[d] as SVGCircleElement
      el.setAttribute('cx', p.x.toFixed(1))
      el.setAttribute('cy', p.y.toFixed(1))
      el.setAttribute('opacity', String(0.2 + 0.8 * Math.min(1, Math.abs(i) / plot.iMax)))
    }
  }

  useClock(live && !reduced && !!plot && plot.kind === 'tran', (t, dt) => {
    place(scrub.current ?? (t % 4.2) / 4.2, scrub.current === null ? dt : 0)
  })

  // Static placements: AC at the cutoff, reduced motion at the end of the run.
  useEffect(() => {
    if (!plot) return
    if (plot.kind === 'ac') place(scrub.current ?? (Number.isFinite(plot.fc) ? Math.log10(plot.fc) / 7 : 0.5), 0)
    else if (reduced) place(scrub.current ?? 0.999, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plot, reduced])

  const onScrub = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    scrub.current = Math.max(0, Math.min(0.999, (e.clientX - r.left) / r.width))
    if (plot?.kind === 'ac' || reduced) place(scrub.current, 0)
  }
  const endScrub = () => {
    scrub.current = null
    if (plot?.kind === 'ac') place(Number.isFinite(plot.fc) ? Math.log10(plot.fc) / 7 : 0.5, 0)
  }

  // Facts read from the solve (and, where noted, the textbook formula next to it).
  const facts: [string, string][] = []
  if (cid === 'rlc') {
    const { r, l, c } = vals
    const zeta = (r / 2) * Math.sqrt(c / l)
    const over = plot?.kind === 'tran' ? Math.max(0, ((plot.peak - RLC_STEP) / RLC_STEP) * 100) : 0
    facts.push(['Response', zeta < 0.98 ? 'Underdamped, it rings' : zeta > 1.02 ? 'Overdamped, it creeps' : 'Critically damped'])
    facts.push(['Overshoot', `${over.toFixed(0)}%`])
    facts.push(['Natural frequency', fmt(1 / (2 * Math.PI * Math.sqrt(l * c)), 'Hz')])
  } else if (cid === 'rc') {
    const fc = plot?.kind === 'ac' ? plot.fc : NaN
    facts.push(['Cutoff, measured at −3 dB', Number.isFinite(fc) ? fmt(fc, 'Hz') : '…'])
    facts.push(['Cutoff, 1 / 2πRC', fmt(1 / (2 * Math.PI * vals.r * vals.c), 'Hz')])
    facts.push(['Roll off above it', plot?.kind === 'ac' ? `${plot.slope.toFixed(1).replace('-', '−')} dB per decade` : '…'])
  } else if (plot?.kind === 'tran') {
    facts.push(['Peak output', fmt(plot.peak, 'V')])
    facts.push(['Ripple', fmt(plot.ripple, 'V')])
    facts.push(['Below the input peak', fmt(plot.drop, 'V')])
  }

  const knobText = (key: string, unit: string) => fmt(vals[key], unit)

  return (
    <div ref={ref}>
      <Stage
        caption={
          <>
            <span>
              {current
                ? `Solved ${current.points.toLocaleString()} ${ac ? 'frequencies' : 'time points'} on a ${current.size} by ${current.size} matrix in ${current.ms.toFixed(1)} ms, in this tab.`
                : 'Loading the SPICE++ engine.'}
            </span>
            <span>The real SPICE++ engine, unmodified.</span>
          </>
        }
      >
        <div className="spice-top" role="tablist" aria-label="Circuit">
          {CIRCUITS.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={c.id === cid} className="seg" onClick={() => setCid(c.id)}>
              {c.name}
            </button>
          ))}
        </div>

        <div className="spice-grid">
          <Schematic cid={cid} vals={vals} loopRef={loopRef} dotsRef={dotsRef} />

          <div className="spice-scope">
            <div
              className="spice-plotbox"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId)
                onScrub(e)
              }}
              onPointerMove={(e) => (e.pointerType === 'mouse' || scrub.current !== null) && onScrub(e)}
              onPointerUp={(e) => e.pointerType !== 'mouse' && endScrub()}
              onPointerCancel={endScrub}
              onPointerLeave={(e) => e.pointerType === 'mouse' && endScrub()}
            >
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="spice-plot" aria-hidden="true">
                {plot?.kind === 'ac' ? (
                  <g stroke="rgba(243,237,232,.06)" vectorEffect="non-scaling-stroke">
                    {[0, -20, -40, -60, -80].filter((d) => d > plot.lo).map((d) => (
                      <line key={d} x1="0" x2={W} y1={plot.Y(d)} y2={plot.Y(d)} vectorEffect="non-scaling-stroke" />
                    ))}
                    <line x1="0" x2={W} y1={plot.Y(-3)} y2={plot.Y(-3)} stroke="rgba(243,237,232,.22)" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
                  </g>
                ) : plot ? (
                  <g vectorEffect="non-scaling-stroke">
                    <line x1="0" x2={W} y1={plot.zero} y2={plot.zero} stroke="rgba(243,237,232,.1)" vectorEffect="non-scaling-stroke" />
                    {cid === 'rlc' && <line x1="0" x2={W} y1={plot.step} y2={plot.step} stroke="rgba(243,237,232,.22)" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />}
                  </g>
                ) : null}
                {plot?.paths.map((p, k) => <path key={k} d={p.d} fill="none" stroke={p.color} strokeWidth={p.w} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />)}
                {plot && (
                  <g ref={headRef}>
                    <line y1="0" y2={H} stroke="rgba(243,237,232,.3)" vectorEffect="non-scaling-stroke" />
                    <circle r="5" cx="0" cy="-20" fill="#F3EDE8" />
                  </g>
                )}
              </svg>
              {plot?.kind === 'ac' && (
                <div className={`spice-axis ${mono.className}`} aria-hidden="true">
                  {[
                    [1, '10 Hz'],
                    [3, '1 kHz'],
                    [5, '100 kHz'],
                  ].map(([k, s]) => (
                    <span key={s} className="ax-x" style={{ left: `${((k as number) / 7) * 100}%` }}>
                      {s}
                    </span>
                  ))}
                  {[0, -20, -40, -60, -80].filter((d) => d > plot.lo).map((d) => (
                    <span key={d} className="ax-y" style={{ top: `${(plot.Y(d) / H) * 100}%` }}>
                      {d === 0 ? '0 dB' : `−${-d}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className={`spice-read ${mono.className}`}>
              {ac ? (
                <span>
                  <i style={{ background: ACCENT }} /> |V(out) / V(in)|
                </span>
              ) : (
                <>
                  <span>
                    <i style={{ background: ACCENT }} /> V(out)
                  </span>
                  <span>
                    <i style={{ background: DIM }} /> V(in)
                  </span>
                </>
              )}
              <span ref={readRef} className="ml-auto tnum" aria-live="off" />
            </div>
          </div>
        </div>

        <div className="spice-ctl" style={{ ['--n' as string]: circuit.knobs.length }}>
          {circuit.knobs.map((k) => (
            <label key={`${cid}-${k.key}`} className="spice-knob">
              <span className="flex items-baseline justify-between gap-3">
                <span className="demo-label">{k.label}</span>
                <span className={`${mono.className} tnum text-[14px]`}>{knobText(k.key, k.unit)}</span>
              </span>
              <input
                type="range"
                min={0}
                max={1000}
                step={1}
                value={pos[cid][k.key]}
                onChange={(e) => setPos((p) => ({ ...p, [cid]: { ...p[cid], [k.key]: +e.target.value } }))}
                className="demo-range"
                aria-label={k.label}
                aria-valuetext={knobText(k.key, k.unit)}
              />
            </label>
          ))}
          <div className="spice-facts">
            {facts.map(([label, v]) => (
              <div key={label}>
                <span className="demo-label">{label}</span>
                <span className={/^[\d−.…]/.test(v) ? `${mono.className} tnum` : ''}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </Stage>
    </div>
  )
}

/** Hand-drawn schematics, one per circuit. Component colours match the trace they drive. */
function Schematic({
  cid,
  vals,
  loopRef,
  dotsRef,
}: {
  cid: CircuitId
  vals: Record<string, number>
  loopRef: React.RefObject<SVGPathElement>
  dotsRef: React.RefObject<SVGGElement>
}) {
  const label =
    cid === 'rlc'
      ? `Series circuit: a 5 volt step source, a ${fmt(vals.r, 'Ω')} resistor, a ${fmt(vals.l, 'H')} inductor and a ${fmt(vals.c, 'F')} capacitor`
      : cid === 'rc'
        ? `Low pass filter: a sine source through a ${fmt(vals.r, 'Ω')} resistor into a ${fmt(vals.c, 'F')} capacitor to ground, output across the capacitor`
        : `Half wave rectifier: a ${fmt(vals.a, 'V')}, 60 hertz sine source, a 1N4001 diode, a ${fmt(vals.c, 'F')} smoothing capacitor and a ${fmt(vals.r, 'Ω')} load`
  const loop = cid === 'rlc' ? 'M48 150 V54 H318 V196 H48 Z' : cid === 'rect' ? 'M48 150 V54 H220 V196 H48 Z' : ''
  return (
    <svg viewBox="0 0 410 250" className="spice-sch" role="img" aria-label={label}>
      <path ref={loopRef} d={loop || 'M0 0'} fill="none" stroke="none" />
      <g fill="none" stroke="rgba(243,237,232,.7)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        {cid === 'rlc' && (
          <>
            <path d="M48 54 H88 M136 54 H170 M250 54 H318 V112 M318 138 V196 H48 V164 M48 136 V54" />
            <path d="M88 54 l5 -9 l8 18 l8 -18 l8 18 l8 -18 l8 18 l5 -9" stroke={ACCENT} />
            <path d="M170 54 c0 -16 20 -16 20 0 c0 -16 20 -16 20 0 c0 -16 20 -16 20 0 c0 -16 20 -16 20 0" stroke={ACCENT} />
            <path d="M300 112 H336 M300 138 H336" stroke={ACCENT} strokeWidth="3" />
            <path d="M42 150 h4 v-6 h4 v12 h4" />
          </>
        )}
        {cid === 'rc' && (
          <>
            <path d="M48 136 V54 H110 M160 54 H330 M250 54 V112 M250 138 V196 H48 V164" />
            <path d="M110 54 l5 -9 l8 18 l8 -18 l8 18 l8 -18 l8 18 l5 -9" stroke={ACCENT} />
            <path d="M232 112 H268 M232 138 H268" stroke={ACCENT} strokeWidth="3" />
            <path d="M40 150 c3 -8 5 -8 8 0 s5 8 8 0" />
            <circle cx="334" cy="54" r="4" />
          </>
        )}
        {cid === 'rect' && (
          <>
            <path d="M48 136 V54 H112 M136 54 H320 V86 M320 136 V196 H48 V164 M220 54 V112 M220 138 V196" />
            <path d="M112 42 L112 66 L136 54 Z M136 42 V66" stroke={ACCENT} strokeLinejoin="miter" />
            <path d="M202 112 H238 M202 138 H238" stroke={ACCENT} strokeWidth="3" />
            <path d="M320 86 l-9 5 l18 8 l-18 8 l18 8 l-18 8 l18 8 l-9 5" stroke={ACCENT} />
            <path d="M40 150 c3 -8 5 -8 8 0 s5 8 8 0" />
          </>
        )}
        <circle cx="48" cy="150" r="14" />
        <path d="M168 196 v12 M156 208 h24 M161 214 h14 M166 220 h4" />
      </g>
      <g ref={dotsRef} fill="#F3EDE8">
        {loop &&
          Array.from({ length: 14 }).map((_, d) => (
            <circle key={`${cid}-${d}`} r="2.6" cx="-10" cy="-10" />
          ))}
      </g>
      <g className={mono.className} fill="rgba(243,237,232,.86)" fontSize="13">
        {cid === 'rlc' && (
          <>
            <text x="112" y="32" textAnchor="middle">R {fmt(vals.r, 'Ω')}</text>
            <text x="210" y="32" textAnchor="middle">L {fmt(vals.l, 'H')}</text>
            <text x="344" y="130" dominantBaseline="middle">C</text>
            <text x="344" y="148" fontSize="11" fill="rgba(243,237,232,.6)">{fmt(vals.c, 'F')}</text>
            <text x="70" y="154" fontSize="11" fill="rgba(243,237,232,.6)">5 V step</text>
            <text x="326" y="48" fontSize="11" fill="rgba(243,237,232,.6)">out</text>
          </>
        )}
        {cid === 'rc' && (
          <>
            <text x="135" y="32" textAnchor="middle">R {fmt(vals.r, 'Ω')}</text>
            <text x="278" y="122">C</text>
            <text x="278" y="140" fontSize="11" fill="rgba(243,237,232,.6)">{fmt(vals.c, 'F')}</text>
            <text x="70" y="154" fontSize="11" fill="rgba(243,237,232,.6)">1 V swept</text>
            <text x="346" y="58" fontSize="11" fill="rgba(243,237,232,.6)">out</text>
          </>
        )}
        {cid === 'rect' && (
          <>
            <text x="124" y="30" textAnchor="middle">D 1N4001</text>
            <text x="246" y="122">C</text>
            <text x="246" y="140" fontSize="11" fill="rgba(243,237,232,.6)">{fmt(vals.c, 'F')}</text>
            <text x="338" y="108">R</text>
            <text x="338" y="126" fontSize="11" fill="rgba(243,237,232,.6)">{fmt(vals.r, 'Ω')}</text>
            <text x="70" y="154" fontSize="11" fill="rgba(243,237,232,.6)">{fmt(vals.a, 'V')}, 60 Hz</text>
            <text x="326" y="48" fontSize="11" fill="rgba(243,237,232,.6)">out</text>
          </>
        )}
      </g>
    </svg>
  )
}
