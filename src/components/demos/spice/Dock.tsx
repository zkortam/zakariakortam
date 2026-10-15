'use client'

/**
 * The waveform dock, ported from zkortam/spiceplusplus src/components/Waveforms/WaveformDock.tsx
 * (commit 81224b0): the analysis tabs, the probe strip with its colour-keyed chips, the AC marker
 * chip and the probe suggestions, the stacked magnitude and phase panels on one x axis, the
 * transient plot with voltages left and currents right, and the operating point table. The plot
 * itself is the app's own drawLinePlot (src/vendor/spicepp/waveforms/plot.ts, unmodified). Left
 * out: pan and zoom, A/B cursors, FFT view, the logic analyzer and .step families.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { TOKENS } from '@/vendor/spicepp/styles/tokens'
import { drawLinePlot, measureGutter, mergeGutters, formatTick, snapToSample, type PlotSeries, type PlotOpts, type PlotGeometry, type PlotGutter, type PlotRect } from '@/vendor/spicepp/waveforms/plot'
import type { SimResult, Complex } from '@/vendor/spicepp/sim/types'
import type { SchematicDoc } from '@/vendor/spicepp/schematic/types'
import { suggestProbes, type ProbeSuggestion } from '@/vendor/spicepp/schematic/probe_suggestions'
import { Icon } from './ui'

const traceColor = (i: number) => TOKENS.traces[i % TOKENS.traces.length]

function parseProbe(p: string): { kind: 'V' | 'I' | 'VD'; a: string; b?: string } | null {
  let m = p.match(/^V\(([^,)]+),([^,)]+)\)$/i)
  if (m) return { kind: 'VD', a: m[1].trim(), b: m[2].trim() }
  m = p.match(/^V\(([^,)]+)\)$/i)
  if (m) return { kind: 'V', a: m[1].trim() }
  m = p.match(/^I\(([^,)]+)\)$/i)
  if (m) return { kind: 'I', a: m[1].trim() }
  return null
}
function evalReal(p: string, sig: Record<string, number[]>): number[] | null {
  const q = parseProbe(p)
  if (!q) return null
  if (q.kind === 'V') return sig[`V(${q.a})`] ?? null
  if (q.kind === 'I') return sig[`I(${q.a})`] ?? null
  const a = sig[`V(${q.a})`],
    b = sig[`V(${q.b})`]
  if (!a || !b) return null
  return a.map((v, i) => v - (b[i] ?? 0))
}
function evalComplex(p: string, csig: Record<string, Complex[]>): Complex[] | null {
  const q = parseProbe(p)
  if (!q) return null
  if (q.kind === 'V') return csig[`V(${q.a})`] ?? null
  if (q.kind === 'I') return csig[`I(${q.a})`] ?? null
  const a = csig[`V(${q.a})`],
    b = csig[`V(${q.b})`]
  if (!a || !b) return null
  return a.map((v, i) => ({ re: v.re - (b[i]?.re ?? 0), im: v.im - (b[i]?.im ?? 0) }))
}
function yLabelFor(names: string[]): string {
  if (names.length === 0) return ''
  if (names.every((n) => /^V\(/i.test(n))) return 'voltage (V)'
  if (names.every((n) => /^I\(/i.test(n))) return 'current (A)'
  return ''
}
const isCurrent = (n: string) => /^I\(/i.test(n)

type Built =
  | { mode: 'xy'; x: number[]; left: PlotSeries[]; right: PlotSeries[]; xLabel: string; yLabel: string; yLabelR?: string }
  | { mode: 'bode'; x: number[]; mag: PlotSeries[]; phase: PlotSeries[]; xLabel: string }

/** The probes a fresh run plots, chosen as the app's store does after the first Run. */
export function seedProbes(doc: SchematicDoc, results: SimResult[]): string[] {
  const plot = results.find((r) => r.analysis.kind !== 'op' && r.converged)
  if (!plot) return []
  const sug = suggestProbes(doc, plot, 8).filter((x) => /^V\(/i.test(x.expr) && !x.expr.includes(':'))
  const out = sug.find((x) => x.kind === 'output') ?? sug.find((x) => x.kind !== 'input') ?? sug[0]
  const inp = sug.find((x) => x.kind === 'input' && x.expr !== out?.expr)
  return [out, inp].filter((x): x is NonNullable<typeof x> => !!x).map((x) => x.expr)
}

export function Dock({
  doc,
  results,
  activeIndex,
  onActive,
  probes,
  setProbes,
  error,
  pending,
  full,
  onFull,
  fontsTick,
}: {
  doc: SchematicDoc
  results: SimResult[] | null
  activeIndex: number
  onActive: (i: number) => void
  probes: string[]
  setProbes: (p: string[]) => void
  error: string | null
  pending: boolean
  full: boolean
  onFull: () => void
  fontsTick: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const geomRef = useRef<PlotGeometry | null>(null)
  const cursorPx = useRef<number | null>(null)
  const scrubbing = useRef(false)
  const [acMarkerHz, setAcMarkerHz] = useState<number | null>(1000)
  const [acEditing, setAcEditing] = useState(false)

  const active = results && activeIndex >= 0 && activeIndex < results.length ? results[activeIndex] : undefined
  const isTable = !!active && (active.analysis.kind === 'op' || (active.analysis.kind !== 'tran' && active.analysis.kind !== 'ac' && active.sweep.length <= 1))
  const single = !!results && results.length === 1

  const suggestions: ProbeSuggestion[] = useMemo(() => {
    if (!active || isTable) return []
    const all = suggestProbes(doc, active, 6)
    const probeSet = new Set(probes)
    return all.filter((s) => !probeSet.has(s.expr))
  }, [doc, active, probes, isTable])

  const built = useMemo<Built | null>(() => {
    if (!active || isTable) return null
    if (active.complex && active.csignals) {
      const csig = active.csignals
      const mag: PlotSeries[] = [],
        phase: PlotSeries[] = []
      probes.forEach((nm, i) => {
        const z = evalComplex(nm, csig)
        if (!z) return
        const c = traceColor(i)
        const dB = z.map((v) => 20 * Math.log10(Math.max(1e-300, Math.hypot(v.re, v.im))))
        const peakDb = Math.max(...dB)
        const deg = z.map((v, k) => (dB[k] < Math.max(-250, peakDb - 160) ? NaN : (Math.atan2(v.im, v.re) * 180) / Math.PI))
        mag.push({ name: nm, color: c, y: dB })
        phase.push({ name: nm, color: c, y: deg })
      })
      return { mode: 'bode', x: active.sweep, mag, phase, xLabel: `${active.sweepName || 'frequency'} (${active.sweepUnit || 'Hz'})` }
    }
    const sig = active.signals
    const left: PlotSeries[] = []
    const right: PlotSeries[] = []
    probes.forEach((nm, i) => {
      const y = evalReal(nm, sig)
      if (!y) return
      ;(isCurrent(nm) ? right : left).push({ name: nm, color: traceColor(i), y })
    })
    const onlyCurrents = left.length === 0 && right.length > 0
    const usedLeft = onlyCurrents ? right : left
    const usedRight = onlyCurrents ? [] : right
    return {
      mode: 'xy',
      x: active.sweep,
      left: usedLeft,
      right: usedRight,
      xLabel: active.sweepName + (active.sweepUnit ? ` (${active.sweepUnit})` : ''),
      yLabel: yLabelFor(usedLeft.map((s) => s.name)),
      yLabelR: usedRight.length ? yLabelFor(usedRight.map((s) => s.name)) : undefined,
    }
  }, [active, isTable, probes])

  const traceCount = built ? (built.mode === 'bode' ? built.mag.length : built.left.length + built.right.length) : 0
  const emptyState = useMemo((): { title: string; hint?: string } | undefined => {
    if (traceCount > 0) return undefined
    return suggestions.length > 0 ? { title: 'No traces yet', hint: 'Pick a suggested signal above to plot it.' } : { title: 'No traces yet' }
  }, [traceCount, suggestions.length])

  const draw = useCallback(() => {
    const canvas = canvasRef.current,
      wrap = wrapRef.current
    if (!canvas || !wrap) return
    const dpr = window.devicePixelRatio || 1
    const w = wrap.clientWidth,
      h = wrap.clientHeight
    if (w <= 0 || h <= 0) return
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const onD = (g: PlotGeometry) => {
      geomRef.current = g
    }
    if (!built) {
      drawLinePlot(ctx, { x: 0, y: 0, w, h }, { x: [0, 1], series: [{ name: '', color: TOKENS.ink.tertiary, y: [0, 1] }], xLabel: '', yLabel: '', loading: true, onDomain: onD })
      return
    }
    const shared: Partial<PlotOpts> = { cursor: cursorPx.current, legend: true, axisTitles: true }
    if (built.mode === 'bode') {
      const half = Math.round(h / 2)
      const topRect: PlotRect = { x: 0, y: 0, w, h: half }
      const botRect: PlotRect = { x: 0, y: half, w, h: h - half }
      const magOpts: PlotOpts = { x: built.x, series: built.mag, xLabel: built.xLabel, yLabel: 'magnitude (dB)', xLog: true, dbFloor: -250, empty: emptyState, ...shared }
      const phOpts: PlotOpts = { x: built.x, series: built.phase, xLabel: built.xLabel, yLabel: 'phase (deg)', xLog: true, empty: emptyState, ...shared }
      if (built.mag.length === 0) {
        drawLinePlot(ctx, { x: 0, y: 0, w, h }, magOpts)
        return
      }
      const g: PlotGutter = mergeGutters(measureGutter(ctx, topRect, { ...magOpts, showXAxis: false }), measureGutter(ctx, botRect, phOpts))
      drawLinePlot(ctx, topRect, { ...magOpts, gutter: g, showXAxis: false, onDomain: onD })
      drawLinePlot(ctx, botRect, { ...phOpts, gutter: g, readout: 'series', onDomain: onD })
    } else {
      drawLinePlot(ctx, { x: 0, y: 0, w, h }, { x: built.x, series: built.left, seriesR: built.right, xLabel: built.xLabel, yLabel: built.yLabel, yLabelR: built.yLabelR, empty: emptyState, onDomain: onD, ...shared })
    }
  }, [built, emptyState])

  const raf = useRef(0)
  const requestDraw = useCallback(() => {
    if (raf.current) return
    raf.current = requestAnimationFrame(() => {
      raf.current = 0
      draw()
    })
  }, [draw])
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  useEffect(() => {
    draw()
  }, [draw, fontsTick, full])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => requestDraw())
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [requestDraw, isTable])

  // The marker reads the frequency under the cursor, the way the app's marker chip reads a set one.
  const markFromCursor = () => {
    const g = geomRef.current
    if (!g || !g.xLog || cursorPx.current == null || active?.analysis.kind !== 'ac') return
    const t = Math.max(0, Math.min(1, (cursorPx.current - g.plotX) / g.plotW))
    const l0 = Math.log10(g.xMin),
      l1 = Math.log10(g.xMax)
    // Snapped to the solved frequency the plot's own readout shows, so the chip and the box agree.
    const k = snapToSample(active.sweep, Math.pow(10, l0 + t * (l1 - l0)))
    if (k >= 0) setAcMarkerHz(active.sweep[k])
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' && !scrubbing.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    cursorPx.current = e.clientX - rect.left
    markFromCursor()
    requestDraw()
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const g = geomRef.current
    if (!g) return
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const step = (g.plotW / 100) * (e.shiftKey ? 10 : 1) * (e.key === 'ArrowLeft' ? -1 : 1)
      const from = cursorPx.current ?? g.plotX + g.plotW / 2
      cursorPx.current = Math.max(g.plotX, Math.min(g.plotX + g.plotW, from + step))
      markFromCursor()
      requestDraw()
    } else if (e.key === 'Escape') {
      cursorPx.current = null
      requestDraw()
    }
  }

  const marker = (() => {
    if (!active?.complex || !active.csignals || acMarkerHz == null) return null
    const csig = active.csignals
    const sw = active.sweep
    const interp = (z: Complex[]): Complex | null => {
      if (!z || z.length < 2) return null
      if (acMarkerHz <= sw[0]) return z[0]
      if (acMarkerHz >= sw[sw.length - 1]) return z[z.length - 1]
      let lo = 0,
        hi = sw.length - 1
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1
        if (sw[m] <= acMarkerHz) lo = m
        else hi = m
      }
      const t = (acMarkerHz - sw[lo]) / (sw[hi] - sw[lo] || 1)
      return { re: z[lo].re + t * (z[hi].re - z[lo].re), im: z[lo].im + t * (z[hi].im - z[lo].im) }
    }
    const first = probes[0]
    const z = first ? interp(evalComplex(first, csig) ?? []) : null
    const mag = z ? 20 * Math.log10(Math.max(1e-300, Math.hypot(z.re, z.im))) : null
    const ph = z ? (Math.atan2(z.im, z.re) * 180) / Math.PI : null
    const commit = (s: string) => {
      const v = parseFloat(s)
      if (isFinite(v) && v > 0) setAcMarkerHz(v)
      setAcEditing(false)
    }
    if (acEditing) {
      return (
        <span className="sp-chip sp-marker" data-editing="">
          <span className="sp-t3">@</span>
          <input
            autoFocus
            aria-label="Marker frequency in hertz"
            defaultValue={String(Number(acMarkerHz.toPrecision(4)))}
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit(e.currentTarget.value)
              else if (e.key === 'Escape') setAcEditing(false)
            }}
            onBlur={(e) => commit(e.target.value)}
          />
          <span className="sp-t3">Hz</span>
        </span>
      )
    }
    return (
      <button type="button" className="sp-chip sp-marker" onClick={() => setAcEditing(true)} title="Click to edit marker frequency">
        <span className="sp-t3">@</span>
        <span>{formatTick(acMarkerHz, 'Hz')}</span>
        {mag != null && ph != null && first && (
          <span className="sp-t1">
            <span className="sp-ml1">{formatTick(mag, 'dB')}</span>
            <span className="sp-dotsep">·</span>
            <span>{formatTick(ph, '°')}</span>
          </span>
        )}
      </button>
    )
  })()

  return (
    <section className="sp-dock" aria-label="Simulation results" data-full={full ? '' : undefined}>
      <div className="sp-dock-head">
        <div className="sp-tabs" role={single ? undefined : 'tablist'} aria-label={single ? undefined : 'Analyses'}>
          {!results ? (
            <span className="sp-dock-title sp-t2">{pending ? 'Simulating…' : 'No results'}</span>
          ) : single ? (
            <span className="sp-dock-title">{results[0].title}</span>
          ) : (
            results.map((r, i) => (
              <button key={i} type="button" role="tab" aria-selected={i === activeIndex} className="sp-tab" onClick={() => onActive(i)}>
                {r.title}
              </button>
            ))
          )}
        </div>
        <button type="button" className="sp-iconbtn" onClick={onFull} aria-label={full ? 'Exit fullscreen' : 'Fullscreen'}>
          <Icon name={full ? 'collapse' : 'expand'} size={15} />
        </button>
      </div>

      {error && (
        <div role="alert" className="sp-banner">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {(probes.length > 0 || marker) && !isTable && (
        <div className="sp-strip" role="toolbar" aria-label="Plotted signals">
          {probes.map((p, i) => (
            <span key={p} className="sp-chip sp-probe" title={p}>
              <span className="sp-key" style={{ background: traceColor(i) }} />
              <span className="sp-trunc">{p}</span>
              <button type="button" aria-label={`Remove ${p}`} onClick={() => setProbes(probes.filter((x) => x !== p))}>
                <Icon name="close" size={10} />
              </button>
            </span>
          ))}
          {marker}
          {probes.length > 1 && (
            <button type="button" className="sp-clear" onClick={() => setProbes([])}>
              clear
            </button>
          )}
        </div>
      )}
      {suggestions.length > 0 && !isTable && (
        <div className="sp-strip" aria-label="Suggested signals">
          {suggestions.map((s) => (
            <button key={s.expr} type="button" className="sp-chip sp-suggest" onClick={() => setProbes([...probes, s.expr])} title={s.why}>
              <Icon name="plus" size={10} />
              <span className="sp-trunc">{s.label}</span>
            </button>
          ))}
        </div>
      )}

      {isTable && active ? (
        <div className="sp-table-wrap">
          <table className="sp-table">
            <tbody>
              {Object.entries(active.signals)
                .filter(([name]) => name !== 'V(0)')
                .map(([name, vals]) => (
                  <tr key={name}>
                    <td className="sp-t2">{name}</td>
                    <td>{formatTick(vals?.[0] ?? NaN, active.units?.[name] || '')}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          ref={wrapRef}
          className="sp-plot"
          tabIndex={0}
          role="img"
          aria-label={
            built
              ? `${active?.title ?? ''} of ${probes.join(', ') || 'no signals'}. Hover or use the arrow keys to read values${active?.analysis.kind === 'ac' ? ' into the marker chip' : ''}.`
              : 'Waiting for the simulation'
          }
          onKeyDown={onKey}
          onPointerDown={(e) => {
            if (e.pointerType === 'mouse') return
            scrubbing.current = true
            onMove(e)
          }}
          onPointerMove={onMove}
          onPointerUp={() => {
            scrubbing.current = false
          }}
          onPointerCancel={() => {
            scrubbing.current = false
          }}
          onPointerLeave={(e) => {
            if (e.pointerType !== 'mouse') return
            cursorPx.current = null
            requestDraw()
          }}
          onBlur={() => {
            cursorPx.current = null
            requestDraw()
          }}
        >
          <canvas ref={canvasRef} />
        </div>
      )}
    </section>
  )
}
