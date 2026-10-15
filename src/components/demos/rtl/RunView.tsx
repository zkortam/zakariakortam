/**
 * Ported from zkortam/spiceplusplus apps/rtlpp/src/app/(marketing)/_site/RunView.tsx (commit 81224b0):
 * the recorded run drawn the way the RTL++ workspace draws it. The waveform is laid out by the
 * workspace's own lane layout (layoutLogicLanes), and the Why chain is the recorded one. Tailwind
 * classes became rp- classes in ../rtl.css with the same values. The one change: WaveView takes any
 * { test, wave }, so a run made in this tab draws through the same code, without the failure tick
 * when it passed, and a tick label that would run off the right edge is left out.
 * (BuildView and FsmView are left out; this page does not show them.)
 */
import { layoutLogicLanes, type LogicCmd, type LogicLane } from '@/vendor/rtlpp/site/logicLanes'
import { formatTime } from '@/vendor/rtlpp/site/format'
import { SHOWCASE } from '@/vendor/rtlpp/site/showcase.generated'
import type { Showcase, ShowcaseStep } from '@/vendor/rtlpp/site/showcase'

export const FAIL = '#ff6961'

/* ---------------------------------------------------------------- waveform */

const W = 720
const GUTTER = 64
const RULER = 26
const LANE_H = 28
const LANE_GAP = 6

/** Round tick spacing for a span in femtoseconds: 1, 2 or 5 times a power of ten. */
function tickStep(span: number, target = 6): number {
  const raw = span / target
  const p = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? 10 * p
}

function Cmd({ c }: { c: LogicCmd }) {
  switch (c.kind) {
    case 'line':
      return <line x1={c.x0} y1={c.y0} x2={c.x1} y2={c.y1} stroke={c.color} strokeWidth={c.width} strokeDasharray={c.dash?.join(' ')} />
    case 'hatch':
    case 'dense':
      return <rect x={c.x} y={c.y} width={c.w} height={c.h} fill={c.color} opacity={c.alpha} />
    case 'text':
      return (
        <text x={c.x} y={c.y} dy="0.35em" textAnchor={c.align === 'center' ? 'middle' : 'start'} fill={c.color} fontSize={11} fontFamily="Inter, ui-sans-serif, sans-serif">
          {c.text}
        </text>
      )
    case 'cursor':
      return <line x1={c.x} y1={c.y0} x2={c.x} y2={c.y1} stroke={c.color} strokeWidth={1} />
  }
}

export type WaveRun = Pick<Showcase, 'test' | 'wave'>

/** `failed` false (a passing run made in this tab) leaves out the failure tick, which only a failure has. */
export function WaveView({ run = SHOWCASE, failed = true }: { run?: WaveRun; failed?: boolean }) {
  const { lanes: rec, endFs } = run.wave
  const lanes: LogicLane[] = rec.map((l) => ({
    name: l.name,
    width: l.width,
    radix: 'dec',
    events: l.times.map((t, i) => ({ t, v: l.values[i] })),
  }))
  const t1 = endFs + tickStep(endFs) / 2
  const height = RULER + lanes.length * (LANE_H + LANE_GAP)
  const rect = { x: GUTTER, y: RULER, w: W - GUTTER - 16, h: height - RULER }
  const layout = layoutLogicLanes(lanes, { rect, t0: 0, t1, gutter: { left: GUTTER, right: 16 }, cursors: { a: endFs, b: null } })
  const xOf = (t: number) => rect.x + (t / t1) * rect.w
  const step = tickStep(t1)
  const ticks: number[] = []
  for (let t = 0; t <= t1; t += step) ticks.push(t)
  const failX = xOf(endFs)
  const summary = rec.map((l) => `${l.name} ${lanes.find((x) => x.name === l.name)!.events.length} changes`).join(', ')
  return (
    <svg
      viewBox={`0 0 ${W} ${height + 4}`}
      className="rp-wave-svg"
      role="img"
      aria-label={`Waveform of ${run.test} from 0 to ${formatTime(endFs)}: ${summary}. The cursor is at ${failed ? 'the failure' : 'the end of the run'}, ${formatTime(endFs)}.`}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={xOf(t)} y1={RULER - 6} x2={xOf(t)} y2={height} stroke="rgba(255,255,255,0.05)" />
          {/* Added here: a label that would run off the right edge is left out (0.6 em per character). */}
          {xOf(t) + 4 + (t === 0 ? 1 : formatTime(t).length) * 10.5 * 0.6 <= W && <text x={xOf(t) + 4} y={RULER - 12} fill="rgba(255,255,255,0.42)" fontSize={10.5} fontFamily="Inter, ui-sans-serif, sans-serif">
            {t === 0 ? '0' : formatTime(t)}
          </text>}
        </g>
      ))}
      {failed && <line x1={failX} y1={RULER - 10} x2={failX} y2={RULER - 2} stroke={FAIL} strokeWidth={2} />}
      {layout.cmds.map((c, i) => (
        <Cmd key={i} c={c} />
      ))}
    </svg>
  )
}

/* ---------------------------------------------------------------- why */

function StepRow({ s, index, divergence }: { s: ShowcaseStep; index: number; divergence: number | null }) {
  const assign = s.lines.find((l) => l.diverges) ?? s.lines[s.lines.length - 1]
  const conditions = s.lines.filter((l) => l.note)
  const first = index === divergence
  return (
    <li className="rp-step" data-first={first ? '' : undefined}>
      <p className="rp-step-head">
        <span className="rp-mono rp-white">{s.signal}</span>
        <span className="rp-mono rp-num rp-white">{s.repeat ? `${s.repeat.fromValue} to ${s.value}` : s.value}</span>
        {s.expected !== undefined && s.diverges && (
          <span className="rp-t2">
            expected <span className="rp-mono rp-num">{s.expected}</span>
          </span>
        )}
        <span className="rp-t3">{s.repeat ? `over ${s.repeat.count} edges, ${formatTime(s.repeat.fromFs)} to ${formatTime(s.timeFs)}` : `at ${formatTime(s.timeFs)}`}</span>
      </p>
      {assign && (
        <p className="rp-step-line" style={{ color: first ? '#ffb4af' : 'rgba(255,255,255,0.62)' }}>
          <span className="rp-step-ln">{assign.line}</span>
          {assign.text}
        </p>
      )}
      {(conditions.length > 0 || s.inputs.length > 0) && (
        <p className="rp-step-cond">
          {[
            ...conditions.map((c) => `${c.text.replace(/^else\s+/, '')} was ${c.note}`),
            ...(s.inputs.length ? [s.inputs.map((i) => `${i.name} ${i.value}`).join(', ')] : []),
          ].join('; ')}
        </p>
      )}
    </li>
  )
}

export function WhyView({ run = SHOWCASE }: { run?: Showcase }) {
  const w = run.why
  return (
    <div className="rp-why">
      <p className="rp-why-q">
        Why is <span className="rp-mono rp-white">{w.signal}</span> {w.value} at {formatTime(w.atFs)}?
      </p>
      <ol className="rp-steps">
        {w.steps.map((s, i) => (
          <StepRow key={i} s={s} index={i} divergence={w.divergence} />
        ))}
      </ol>
      <p className="rp-why-stop">{w.stop}</p>
    </div>
  )
}

/** The causing line, the line the chain lands on first where value and expectation part. */
export function causeLine(run: Showcase = SHOWCASE): number | null {
  const d = run.why.divergence
  if (d === null) return null
  return run.why.steps[d].lines.find((l) => l.diverges)?.line ?? null
}
