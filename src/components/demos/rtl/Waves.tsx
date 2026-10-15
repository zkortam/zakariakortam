'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { mono } from '../shared'
import type { Wave } from './protocol'
import { WAVES } from './sources'

const COLORS: Record<string, string> = { clk: '#6E9BFF', rst: '#E8A35C', en: '#E0707F', count: '#5FD0E8', wrap: '#C9A7FF' }
const BAD = '#FF6B6B'

/** Value in effect at time t (ns): the last change at or before t. */
function at(w: Wave | undefined, t: number): string | null {
  if (!w || w.times.length === 0) return null
  let lo = 0
  let hi = w.times.length - 1
  if (t < w.times[0]) return null
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (w.times[mid] <= t) lo = mid
    else hi = mid - 1
  }
  return w.values[lo]
}

export function show(v: string | null, width: number) {
  if (v === null) return ''
  if (/[xz]/.test(v)) return width === 1 ? v : v.includes('z') && !v.includes('x') ? 'z' : 'x'
  return width === 1 ? v : String(parseInt(v, 2))
}

function niceStep(span: number, target: number) {
  const raw = span / target
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p
  return 10 * p
}

type Props = {
  waves: Partial<Record<string, Wave>>
  endNs: number
  /** Share of the run drawn so far, 0 to 1. */
  drawn: number
  verdict: 'pass' | 'fail' | null
  /** Highlight the value of this wave in effect at this time (a failed check). */
  wrong?: { name: string; atNs: number } | null
}

export function Waves({ waves, endNs, drawn, verdict, wrong }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(640)
  const [cursor, setCursor] = useState<number | null>(null)
  const scrubbing = useRef(false)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // A new run puts the cursor back at its end.
  useEffect(() => setCursor(null), [waves])

  const end = Math.max(1, endNs)
  const X0 = 58
  const X1 = W - 8
  const xs = (ns: number) => X0 + (Math.min(ns, end) / end) * (X1 - X0)
  const RH = 28
  const GAP = 10
  const y0 = (r: number) => 30 + r * (RH + GAP)
  const H = y0(WAVES.length) + 2
  const tNow = drawn * end
  const step = niceStep(end, W < 520 ? 4 : 7)
  const ticks: number[] = []
  for (let t = 0; t <= end + 1e-9; t += step) ticks.push(Math.round(t * 1000) / 1000)

  const cur = cursor ?? end
  const curShown = Math.min(cur, tNow)

  const paths = WAVES.map((name, r) => {
    const w = waves[name]
    if (!w || w.times.length === 0) return null
    const top = y0(r) + 5
    const bot = y0(r) + RH - 5
    const mid = (top + bot) / 2
    const segs = w.times.map((t, i) => ({ a: t, b: Math.min(w.times[i + 1] ?? end, end), v: w.values[i] })).filter((s) => s.b > s.a || s.a === end)
    if (w.width === 1) {
      // Dense clocks collapse into a band instead of thousands of sub-pixel edges.
      if (segs.length > (X1 - X0) / 2) return <rect key={name} x={X0} y={top} width={X1 - X0} height={bot - top} fill={COLORS[name]} opacity=".35" />
      let d = ''
      let unknown = ''
      for (const s of segs) {
        const known = s.v === '0' || s.v === '1'
        const y = s.v === '1' ? top : s.v === '0' ? bot : mid
        d += `${d ? 'V' : 'M' + xs(s.a) + ' '}${y} H${xs(s.b)} `
        if (!known) unknown += `M${xs(s.a)} ${mid} H${xs(s.b)} `
      }
      return (
        <g key={name}>
          <path d={d} stroke={COLORS[name]} />
          {unknown && <path d={unknown} stroke={BAD} />}
        </g>
      )
    }
    return (
      <g key={name}>
        {segs.map((s, i) => {
          const xa = xs(s.a)
          const xb = xs(s.b)
          const k = Math.min(4, (xb - xa) / 2)
          const isWrong = !!wrong && wrong.name === name && s.a <= wrong.atNs && (wrong.atNs < s.b || i === segs.length - 1)
          const label = show(s.v, w.width)
          const color = isWrong ? BAD : label === 'x' || label === 'z' ? BAD : COLORS[name]
          return (
            <g key={i}>
              <path
                d={`M${xa} ${mid} L${xa + k} ${top} H${xb - k} L${xb} ${mid} L${xb - k} ${bot} H${xa + k} Z`}
                stroke={color}
                fill={isWrong ? 'rgba(255,107,107,.16)' : 'transparent'}
              />
              {xb - xa > 9 + label.length * 7 && (
                <text x={(xa + xb) / 2} y={mid + 4} textAnchor="middle" fontSize="12" fill="#F3EDE8" stroke="none">
                  {label}
                </text>
              )}
            </g>
          )
        })}
      </g>
    )
  })

  const readout = WAVES.map((name) => {
    const w = waves[name]
    return { name, v: w ? show(at(w, curShown), w.width) : '' }
  })

  const fromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    const t = ((x - X0) / (X1 - X0)) * end
    setCursor(Math.max(0, Math.min(end, Math.round(t * 2) / 2)))
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const by = e.shiftKey ? step : Math.max(0.5, step / 8)
    const map: Record<string, number> = { ArrowLeft: cur - by, ArrowRight: cur + by, ArrowDown: cur - by, ArrowUp: cur + by, Home: 0, End: end }
    if (!(e.key in map)) return
    e.preventDefault()
    setCursor(Math.max(0, Math.min(end, Math.round(map[e.key] * 2) / 2)))
  }

  const fmtT = (t: number) => `${Number.isInteger(t) ? t : t.toFixed(1)} ns`
  const readText = `${fmtT(curShown)}, ${readout.map((r) => `${r.name} ${r.v || 'none'}`).join(', ')}`

  return (
    <div className="wv">
      <p className={`wv-read ${mono.className}`} aria-hidden="true">
        <span className="wv-t">{fmtT(curShown)}</span>
        {readout.map((r) => (
          <span key={r.name}>
            <span className="wv-k">{r.name}</span> {r.v || ' '}
          </span>
        ))}
      </p>
      <div
        ref={box}
        className="wv-plot"
        role="slider"
        tabIndex={0}
        aria-label="Time cursor on the waveforms"
        aria-valuemin={0}
        aria-valuemax={end}
        aria-valuenow={curShown}
        aria-valuetext={readText}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          scrubbing.current = true
          e.currentTarget.setPointerCapture?.(e.pointerId)
          fromPointer(e)
        }}
        onPointerMove={(e) => {
          if (scrubbing.current || e.pointerType === 'mouse') fromPointer(e)
        }}
        onPointerUp={() => (scrubbing.current = false)}
        onPointerCancel={() => (scrubbing.current = false)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className={mono.className} aria-hidden="true">
          <defs>
            <clipPath id="wv-clip">
              <rect x="0" y="0" width={Math.max(0, xs(Math.max(0, tNow)))} height={H} />
            </clipPath>
          </defs>
          <g fontSize="11" fill="rgba(243,237,232,.5)">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={xs(t)} x2={xs(t)} y1="22" y2={H} stroke="rgba(243,237,232,.06)" />
                <text x={xs(t)} y="13" textAnchor={t === 0 ? 'start' : xs(t) > X1 - 20 ? 'end' : 'middle'}>
                  {t} ns
                </text>
              </g>
            ))}
          </g>
          <g fontSize="13" fill="rgba(243,237,232,.8)">
            {WAVES.map((n, i) => (
              <text key={n} x="0" y={y0(i) + RH / 2 + 4}>
                {n}
              </text>
            ))}
          </g>
          <g clipPath="url(#wv-clip)" fill="none" strokeWidth="1.6" strokeLinejoin="round">
            {paths}
          </g>
          {drawn < 1 && <line x1={xs(tNow)} x2={xs(tNow)} y1="22" y2={H} stroke="rgba(243,237,232,.5)" />}
          {drawn >= 1 && verdict && (
            <line x1={xs(end) - 1} x2={xs(end) - 1} y1="22" y2={H} stroke={verdict === 'pass' ? '#5BD18B' : BAD} strokeWidth="2" />
          )}
          {drawn >= 1 && cursor !== null && (
            <line x1={xs(curShown)} x2={xs(curShown)} y1="22" y2={H} stroke="rgba(243,237,232,.75)" strokeDasharray="3 3" />
          )}
        </svg>
      </div>
    </div>
  )
}
