'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useLive } from './shared'
import { CodeView } from './rtl/code'
import { FAIL, WaveView, WhyView, causeLine, type WaveRun } from './rtl/RunView'
import { useIcarus } from './rtl/useIcarus'
import type { RunResult } from './rtl/protocol'
import { COUNTER_FILE, COUNTER_RECORDED, WAVES } from './rtl/sources'
import { SHOWCASE } from '@/vendor/rtlpp/site/showcase.generated'
import { describeOutcome, formatTime } from '@/vendor/rtlpp/site/format'
import type { TestOutcome } from '@/vendor/rtlpp/site/outcome'
import './rtl.css'

/*
 * The RTL++ home page's ShowcaseRun (apps/rtlpp/src/app/(marketing)/_site/RunView.tsx), ported:
 * the workspace at the failure, recorded from the real engines, with the code, the Why chain and
 * the waveform drawn by RTL++'s own code. It opens on that still frame. counter.sv is editable, and
 * Run compiles and simulates it against tb_counter with Icarus Verilog (WebAssembly, in a worker),
 * then draws that run through the same WaveView. The recorded Why chain stays only while the run
 * is the recorded one (same file, same failure); RTL++ builds the chain from the Yosys netlist,
 * which this page does not run, so an edited design gets its verdict and waveform, never a chain.
 */

const OK = '#30d158' // --s-ok
const WARN = '#ffb340' // --s-warn
const ACCENT = '#0A70E0' // bg-accent: --c-accent, 10 112 224, in apps/rtlpp/src/app/theme.css

/** A run in this tab, worded the way the RTL++ Tests rail words it (describeOutcome). */
function outcomeOf(r: RunResult, engineDown: string | null): TestOutcome {
  if (r.kind === 'ran' && r.passed) return { status: 'unconfirmed', message: 'Icarus passed it. The netlist simulator does not run on this page.' }
  if (r.kind === 'ran')
    return { status: 'failed', message: r.failure?.message ?? 'The test failed', ...(r.failure?.atNs !== undefined ? { atFs: Math.round(r.failure.atNs * 1e6) } : {}) }
  if (r.kind === 'compile') {
    const e = r.errors.find((x) => x.file === COUNTER_FILE) ?? r.errors[0]
    return { status: 'error', message: e ? `${e.file} line ${e.line}: ${e.message}` : r.raw.split('\n')[0] || 'The design did not compile' }
  }
  if (engineDown) return { status: 'error', message: `Icarus Verilog did not load. ${engineDown}` }
  if (/seconds/.test(r.reason)) return { status: 'stopped', reason: 'time-limit' }
  if (/MB/.test(r.reason)) return { status: 'stopped', reason: 'data-limit' }
  return { status: 'error', message: r.reason }
}

const toneOf = (o: TestOutcome) => (o.status === 'passed' ? OK : o.status === 'failed' || o.status === 'error' ? FAIL : WARN)
const messageOf = (o: TestOutcome) => ('message' in o ? o.message : undefined)

/** The run's lanes, in the recorded run's order and units (femtoseconds), up to where it ended. */
function waveOf(r: Extract<RunResult, { kind: 'ran' }>): WaveRun {
  const endFs = Math.round((r.failure?.atNs ?? r.endNs) * 1e6)
  const lanes = WAVES.flatMap((name) => {
    const w = r.waves[name]
    if (!w) return []
    const times: number[] = []
    const values: string[] = []
    w.times.forEach((t, i) => {
      const fs = Math.round(t * 1e6)
      if (fs > endFs) return
      times.push(fs)
      values.push(w.values[i])
    })
    return [{ name, width: w.width, times, values }]
  })
  return { test: SHOWCASE.test, wave: { endFs, lanes } }
}

/** True when a run here is the recorded one: the recorded file, failing the same way at the same time. */
function isRecorded(code: string, r: RunResult) {
  return (
    code === COUNTER_RECORDED &&
    r.kind === 'ran' &&
    !r.passed &&
    r.failure?.message === SHOWCASE.failing.message &&
    r.failure?.atNs !== undefined &&
    Math.round(r.failure.atNs * 1e6) === SHOWCASE.failing.atFs
  )
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M7.5 4.8l12 7.2-12 7.2z" fill="currentColor" />
    </svg>
  )
}

type Live = { code: string; result: RunResult; outcome: TestOutcome }

export function RtlTrace() {
  const { ref, near } = useLive<HTMLDivElement>()
  const engine = useIcarus(near)
  const [code, setCode] = useState(COUNTER_RECORDED)
  const [live, setLive] = useState<Live | null>(null)
  const [running, setRunning] = useState(false)
  const [mac, setMac] = useState(false)

  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)), [])
  const shortcut = mac ? 'Meta+Enter' : 'Control+Enter'

  const engineDown = engine.state.kind === 'failed' ? engine.state.message : null
  const runCode = engine.run
  const execute = useCallback(async () => {
    if (running) return
    const src = code
    setRunning(true)
    const result = await runCode(src)
    setRunning(false)
    setLive({ code: src, result, outcome: outcomeOf(result, null) })
  }, [running, code, runCode])

  // A run that came back because the engine failed to load says so.
  const outcome: TestOutcome | null = live ? (live.result.kind === 'stopped' && engineDown ? outcomeOf(live.result, engineDown) : live.outcome) : null

  const reset = () => {
    setCode(COUNTER_RECORDED)
    setLive(null)
  }

  // What the frame shows: the recorded run until something has run here.
  const ranCode = live ? live.code : COUNTER_RECORDED
  const recorded = !live || isRecorded(live.code, live.result)
  const stale = code !== ranCode
  const wave: WaveRun | null = !live ? SHOWCASE : live.result.kind === 'ran' ? waveOf(live.result) : null
  const cause = recorded && !stale ? causeLine(SHOWCASE) : null

  const words = running ? 'Running' : outcome ? describeOutcome(outcome) : SHOWCASE.failing.outcome
  const tone = running ? undefined : outcome ? toneOf(outcome) : FAIL
  const message = running ? undefined : outcome ? messageOf(outcome) : SHOWCASE.failing.message
  const r = live?.result

  return (
    <div ref={ref} className="rp-wrap" data-no-swipe="">
      <figure className="rp" style={{ '--rp-accent': ACCENT } as CSSProperties}>
        <div className="rp-head">
          <p className="rp-head-text" role="status" aria-live="polite">
            <span className="rp-mono rp-white">{SHOWCASE.test}</span>
            <span className={running ? 'rp-t3 rp-running' : undefined} style={tone ? { color: tone } : undefined}>
              {words}
            </span>
            {message && <span className="rp-t2">{message}</span>}
            {stale && !running && <span className="rp-t3">Ran before the latest edit</span>}
          </p>
          <span className="rp-actions">
            {engineDown && (
              <button type="button" className="rp-btn rp-ghost" onClick={engine.retry}>
                Try again
              </button>
            )}
            {(code !== COUNTER_RECORDED || live) && (
              <button type="button" className="rp-btn rp-ghost" onClick={reset} disabled={running}>
                Reset
              </button>
            )}
            <button type="button" className="rp-btn rp-primary" onClick={execute} disabled={running} aria-keyshortcuts={shortcut}>
              <PlayIcon />
              Run
            </button>
          </span>
        </div>
        <div className="rp-grid">
          <CodeView
            src={code}
            file={SHOWCASE.file}
            marks={cause ? { [cause]: 'cause' } : {}}
            edit={{ onChange: setCode, onRun: execute, label: `${SHOWCASE.file}, editable. ${mac ? 'Command' : 'Control'} Enter runs ${SHOWCASE.test}.`, shortcut }}
          />
          {recorded ? (
            <WhyView />
          ) : (
            <div className="rp-why">
              {r?.kind === 'compile' ? (
                <ol className="rp-steps">
                  {(r.errors.length ? r.errors.slice(0, 4) : [{ file: '', line: 0, message: r.raw }]).map((e, i) => (
                    <li key={i} className="rp-step">
                      <p className="rp-step-line rp-wrap-text" style={{ color: 'rgba(255,255,255,0.62)' }}>
                        {e.file && (
                          <span className="rp-step-ln">
                            {e.file}:{e.line}
                          </span>
                        )}
                        {e.message}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                r?.kind === 'ran' && (
                  <>
                    <p className="rp-why-q">
                      Icarus Verilog compiled <span className="rp-mono rp-white">{COUNTER_FILE}</span> in {Math.max(1, Math.round(r.timings.compileMs))} ms and simulated{' '}
                      {formatTime(Math.round(r.endNs * 1e6))} in {Math.max(1, Math.round(r.timings.runMs))} ms, in this tab.
                    </p>
                    {!r.passed && (
                      <p className="rp-why-stop">
                        RTL++ traces why a value is wrong through the netlist Yosys builds from the design. Yosys does not run on this page, so this run has no chain of causes.
                      </p>
                    )}
                  </>
                )
              )}
            </div>
          )}
        </div>
        {wave && (
          <div className="rp-wave">
            <WaveView run={wave} failed={!(live?.result.kind === 'ran' && live.result.passed)} />
          </div>
        )}
      </figure>
      <p className="rp-cap">
        {!live
          ? `Recorded from a real run: the ${SHOWCASE.template.name} design with line ${SHOWCASE.change.line} changed to ${SHOWCASE.change.after.replace(/^.*<=\s*/, '').replace(/;$/, '')}. Edit ${COUNTER_FILE} and press Run to simulate it here with Icarus Verilog.`
          : recorded
            ? `Run just now in this tab by Icarus Verilog, compiled to WebAssembly. It failed the same way as the recorded run, so the chain of causes is the recorded one.`
            : `Run just now in this tab by Icarus Verilog, compiled to WebAssembly.`}
      </p>
    </div>
  )
}
