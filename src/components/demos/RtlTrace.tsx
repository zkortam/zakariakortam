'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Stage, mono, useClock, useLive } from './shared'
import { Editor, type LineMark } from './rtl/Editor'
import { Waves } from './rtl/Waves'
import { useIcarus } from './rtl/useIcarus'
import type { RunResult } from './rtl/protocol'
import { BUG_LINE, COUNTER_BUGGY, COUNTER_FILE, COUNTER_FIXED, TB_COUNTER, TB_FILE } from './rtl/sources'

/**
 * The RTL++ debugging story on its own counter, run for real: Icarus Verilog (WebAssembly, in a
 * worker) compiles counter.sv against tb_counter in this tab, and the waveforms and the verdict come
 * from its VCD and its output. The story plays first: the test fails, the why chain walks the wrong
 * value back to the line that set it, the fix lands and the rerun passes. Then the code is yours.
 */

type Phase = 'run' | 'fail' | 'why1' | 'why2' | 'why3' | 'fix' | 'rerun' | 'pass'
const SCRIPT: [Phase, number][] = [
  ['run', 2.4],
  ['fail', 1.2],
  ['why1', 1.8],
  ['why2', 1.8],
  ['why3', 1.8],
  ['fix', 1.6],
  ['rerun', 2.4],
  ['pass', 0.01],
]
const ORDER = SCRIPT.map(([p]) => p)
const TOTAL = SCRIPT.reduce((a, [, d]) => a + d, 0)
const RST_LINE = 6

const WHY = [
  { id: 'why1', head: 'count 0, expected 9, at 95 ns', body: 'Set by line 16, because count was 8 and 8 == MAX - 1.' },
  { id: 'why2', head: 'count 1 to 8, over 8 edges', body: 'Line 16 on every edge from 15 ns to 85 ns, en high, rst low.' },
  { id: 'why3', head: 'rst 0 at 15 ns', body: 'Line 7. A primary input, set by the testbench, so not the cause.' },
] as const

const EXPECTS = [
  'count steps from 0 to 9 and wraps to 0, for 25 cycles',
  'wrap is high exactly when count is 9',
  'count holds while en is low',
  'rst clears count',
]

const ns = (t: number) => `${Number.isInteger(t) ? t : t.toFixed(1)} ns`
const dec = (bits: string) => (/^[01]+$/.test(bits) ? String(parseInt(bits, 2)) : bits)

type Run = { status: 'idle' | 'running' | 'done'; code: string; result?: RunResult }

export function RtlTrace() {
  const { ref, live, near, reduced } = useLive<HTMLDivElement>()
  const engine = useIcarus(near)
  const [story, setStory] = useState<{ bug: RunResult; fix: RunResult } | null>(null)
  const [mode, setMode] = useState<'story' | 'edit'>('story')
  const [storyT, setStoryT] = useState(0)
  const [code, setCode] = useState(COUNTER_BUGGY)
  const [tab, setTab] = useState<'dut' | 'tb'>('dut')
  const [run, setRun] = useState<Run>({ status: 'idle', code: '' })
  const [lastRan, setLastRan] = useState<{ result: RunResult; code: string } | null>(null)
  const [drawn, setDrawn] = useState(1)
  const [mac, setMac] = useState(false)

  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)), [])

  // Run the story's two versions for real as soon as the engine is in.
  const ready = engine.state.kind === 'ready'
  const runCode = engine.run
  useEffect(() => {
    if (!ready || story) return
    let gone = false
    ;(async () => {
      const bug = await runCode(COUNTER_BUGGY)
      const fix = await runCode(COUNTER_FIXED)
      if (!gone) setStory({ bug, fix })
    })()
    return () => {
      gone = true
    }
  }, [ready, story, runCode])

  // Story clock: plays once while on screen; reduced motion lands on the last frame.
  const storyEnd = reduced ? TOTAL : storyT
  useClock(live && mode === 'story' && !!story && !reduced && storyT < TOTAL, (_, dt) => setStoryT((s) => Math.min(TOTAL, s + dt)))
  // Draw each new run across the waves.
  useClock(live && mode === 'edit' && drawn < 1, (_, dt) => setDrawn((d) => Math.min(1, d + dt / 1.1)))

  let acc = 0
  let phase: Phase = 'pass'
  let local = 1
  for (const [p, d] of SCRIPT) {
    if (storyEnd < acc + d) {
      phase = p
      local = (storyEnd - acc) / d
      break
    }
    acc += d
  }
  const reached = (p: Phase) => ORDER.indexOf(phase) >= ORDER.indexOf(p)
  const storyCode = reached('fix') ? COUNTER_FIXED : COUNTER_BUGGY

  const engage = useCallback(() => {
    if (mode === 'edit') return
    setCode(storyCode)
    setMode('edit')
    setRun({ status: 'idle', code: '' })
  }, [mode, storyCode])

  const execute = useCallback(async () => {
    const src = mode === 'story' ? storyCode : code
    if (mode === 'story') {
      setCode(src)
      setMode('edit')
    }
    setTab('dut')
    setRun({ status: 'running', code: src })
    const result = await runCode(src)
    setRun({ status: 'done', code: src, result })
    if (result.kind === 'ran') {
      setLastRan({ result, code: src })
      setDrawn(reduced ? 1 : 0)
    }
  }, [mode, storyCode, code, runCode, reduced])

  const replay = () => {
    setCode(COUNTER_BUGGY)
    setRun({ status: 'idle', code: '' })
    setLastRan(null)
    setTab('dut')
    setStoryT(0)
    setMode('story')
  }

  // What the waves show.
  const view = useMemo(() => {
    if (mode === 'story') {
      if (!story) return null
      const r = reached('rerun') ? story.fix : story.bug
      const d = phase === 'run' || phase === 'rerun' ? local : 1
      return { result: r, drawn: d, dim: false }
    }
    if (lastRan) return { result: lastRan.result, drawn, dim: lastRan.code !== code || run.status !== 'done' || run.result?.kind !== 'ran' }
    return story ? { result: story.fix, drawn: 1, dim: true } : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, story, phase, local, run, lastRan, drawn, code])

  const shown = view?.result.kind === 'ran' ? view.result : null
  const storyFailed = mode === 'story' && reached('fail') && !reached('rerun')
  const verdict: 'pass' | 'fail' | null =
    !shown || (mode === 'story' && (phase === 'run' || phase === 'rerun')) ? null : shown.passed ? 'pass' : 'fail'

  // Line marks in the editor.
  const marks: Record<number, LineMark> = {}
  if (mode === 'story' && tab === 'dut') {
    if (reached('fix')) marks[BUG_LINE] = 'good'
    else if (phase === 'why3') marks[RST_LINE] = 'bad'
    else if (reached('why1')) marks[BUG_LINE] = 'bad'
  }
  const res = mode === 'edit' && run.status === 'done' ? run.result : undefined
  if (res?.kind === 'compile') {
    const own = res.errors.filter((e) => e.file === (tab === 'dut' ? COUNTER_FILE : TB_FILE))
    if (own[0]) marks[own[0].line - 1] = 'bad'
  }

  // Status line.
  let status = ''
  let tone: '' | 'ok' | 'bad' = ''
  let note = ''
  if (engine.state.kind === 'failed' && !story) {
    status = 'Could not load Icarus Verilog'
    tone = 'bad'
  } else if (!story && mode === 'story') {
    status = 'Loading Icarus Verilog, 3.3 MB'
  } else if (mode === 'story') {
    const failure = story?.bug.kind === 'ran' ? story.bug.failure : null
    if (phase === 'run' || phase === 'rerun') status = 'Running'
    else if (phase === 'pass' && story?.fix.kind === 'ran') {
      status = `Passed at ${ns(story.fix.endNs)}`
      tone = 'ok'
    } else if (storyFailed && failure) {
      status = `Failed at ${ns(failure.atNs ?? 0)}`
      tone = 'bad'
      note = failure.message
    }
  } else if (run.status === 'running') status = 'Compiling and running'
  else if (run.status === 'done' && run.result) {
    const r = run.result
    if (r.kind === 'ran' && r.passed) {
      status = `Passed at ${ns(r.endNs)}`
      tone = 'ok'
    } else if (r.kind === 'ran') {
      status = r.failure?.atNs !== undefined ? `Failed at ${ns(r.failure.atNs)}` : 'Failed'
      tone = 'bad'
      note = r.failure?.message ?? ''
    } else if (r.kind === 'compile') {
      status = 'Did not compile'
      tone = 'bad'
    } else {
      status = 'Stopped'
      tone = 'bad'
    }
    if (run.code !== code) note = 'Edited since this run'
  } else status = code === COUNTER_BUGGY || code === COUNTER_FIXED ? 'Ready' : 'Edited, not run yet'

  const busy = run.status === 'running'
  const wrong = shown && !shown.passed && shown.check && (mode === 'edit' || reached('fail')) ? { name: shown.check.expr, atNs: shown.check.atNs } : null

  return (
    <div ref={ref}>
      <Stage
        caption={
          <>
            <span>Icarus Verilog, compiled to WebAssembly, runs counter.sv against tb_counter in this tab.</span>
            <span>The why chain replays RTL++&rsquo;s trace of the original bug.</span>
          </>
        }
      >
        <div className="rtl-top">
          <span className={mono.className}>tb_counter</span>
          <span className={`rtl-status ${tone}`} role="status" aria-live="polite">
            {status}
          </span>
          {note && <span className="rtl-note">{note}</span>}
          <span className="rtl-actions">
            {engine.state.kind === 'failed' && !story ? (
              <button type="button" className="demo-btn" onClick={engine.retry}>
                Try again
              </button>
            ) : (
              <>
                {(mode === 'edit' || phase === 'pass') && (
                  <button type="button" className="demo-btn ghost" onClick={replay}>
                    Replay
                  </button>
                )}
                <button type="button" className="demo-btn" onClick={execute} disabled={busy} aria-keyshortcuts={mac ? 'Meta+Enter' : 'Control+Enter'}>
                  Run test
                </button>
              </>
            )}
          </span>
        </div>

        <div className="rtl-grid">
          <div className="rtl-src">
            <div className="rtl-tabs" role="tablist" aria-label="Files">
              {(
                [
                  ['dut', COUNTER_FILE],
                  ['tb', TB_FILE],
                ] as const
              ).map(([k, name]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={tab === k}
                  className={`rtl-tab ${mono.className}`}
                  onClick={() => setTab(k)}
                >
                  {name}
                  {k === 'tb' && <span className="rtl-ro">read only</span>}
                </button>
              ))}
              <span className={`rtl-hint ${mono.className}`} aria-hidden="true">
                {mac ? '⌘' : 'Ctrl'} Enter runs
              </span>
            </div>
            <Editor
              className={mono.className}
              value={tab === 'dut' ? (mode === 'story' ? storyCode : code) : TB_COUNTER}
              readOnly={tab === 'tb'}
              onChange={tab === 'dut' ? setCode : undefined}
              onEngage={tab === 'dut' ? engage : undefined}
              onRun={execute}
              marks={marks}
              label={tab === 'dut' ? 'counter.sv, editable' : 'tb_counter.sv, read only'}
            />
          </div>

          <div className="rtl-why" aria-live={mode === 'edit' ? 'polite' : 'off'}>
            {mode === 'story' ? (
              <>
                <p className="demo-label">{reached('fix') ? 'Fix' : 'Why is count 0 at 100 ns?'}</p>
                {reached('fix') ? (
                  <>
                    <div className="rtl-card show ok">
                      <p className={mono.className}>count == MAX - 1 → count == MAX</p>
                      <p>The counter wrapped one cycle early. Compare against MAX and run again.</p>
                    </div>
                    {phase === 'pass' && <p className="rtl-turn">Your turn. Change counter.sv, then run the test.</p>}
                  </>
                ) : (
                  WHY.map((w) => (
                    <div key={w.id} className={`rtl-card ${reached(w.id) ? 'show' : ''} ${phase === w.id ? 'on' : ''}`}>
                      <p className={mono.className}>{w.head}</p>
                      <p>{w.body}</p>
                    </div>
                  ))
                )}
              </>
            ) : (
              <>
                <p className="demo-label">{run.status === 'idle' ? 'Your run' : run.status === 'running' ? 'Running in Icarus Verilog' : 'Result'}</p>
                {res && <ResultCard r={res} />}
                {run.status === 'running' && (
                  <div className="rtl-card show">
                    <p className={mono.className}>iverilog -g2012, then vvp</p>
                    <p>Compiling counter.sv with tb_counter and simulating it.</p>
                  </div>
                )}
                <div className="rtl-expects">
                  <p className="demo-label">tb_counter checks that</p>
                  <ul>
                    {EXPECTS.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>

        <div className={`rtl-wave ${view?.dim ? 'dim' : ''}`}>
          {shown ? (
            <Waves waves={shown.waves} endNs={shown.endNs} drawn={view!.drawn} verdict={verdict} wrong={wrong} />
          ) : (
            <div className="rtl-wait">
              {engine.state.kind === 'failed' ? <p>{engine.state.message}</p> : <p className="demo-pulse">Fetching Icarus Verilog and checking every file against its pinned SHA-256</p>}
            </div>
          )}
        </div>
      </Stage>
    </div>
  )
}

function ResultCard({ r }: { r: RunResult }) {
  if (r.kind === 'ran' && r.passed)
    return (
      <div className="rtl-card show ok">
        <p className={mono.className}>PASS at {ns(r.endNs)}</p>
        <p>
          Compiled in {Math.max(1, Math.round(r.timings.compileMs))} ms and simulated in {Math.max(1, Math.round(r.timings.runMs))} ms, in this tab.
        </p>
      </div>
    )
  if (r.kind === 'ran') {
    const c = r.check
    return (
      <div className="rtl-card show on">
        <p className={mono.className}>{r.failure?.message ?? 'Failed'}</p>
        <p>
          {r.failure?.line ? `${r.failure.file ?? TB_FILE} line ${r.failure.line}` : 'tb_counter'}
          {r.failure?.atNs !== undefined ? `, at ${ns(r.failure.atNs)}` : ''}.
          {c ? ` The check saw ${c.expr} = ${dec(c.got)}, expected ${dec(c.expected)}.` : ''}
        </p>
      </div>
    )
  }
  if (r.kind === 'compile') {
    const own = r.errors.filter((e) => e.file === COUNTER_FILE)
    const list = (own.length ? own : r.errors).slice(0, 3)
    return (
      <div className="rtl-card show on">
        <p className={mono.className}>{own.length ? 'counter.sv did not compile' : 'The design did not compile'}</p>
        {list.length ? (
          <ul className={`rtl-errs ${mono.className}`}>
            {list.map((e, i) => (
              <li key={i}>
                {e.file === COUNTER_FILE ? '' : `${e.file} `}line {e.line}: {e.message}
              </li>
            ))}
          </ul>
        ) : (
          <pre className={`rtl-errs ${mono.className}`}>{r.raw}</pre>
        )}
      </div>
    )
  }
  return (
    <div className="rtl-card show on">
      <p className={mono.className}>Stopped</p>
      <p>The simulation was stopped because {r.reason}.</p>
    </div>
  )
}

