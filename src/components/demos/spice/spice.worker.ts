/// <reference lib="webworker" />
/** The vendored SPICE++ engine in a worker, so a slow solve never blocks a drag. */
import { simulate } from '@/vendor/spicepp/sim/engine'
import type { Netlist } from '@/vendor/spicepp/sim/types'

export type SpiceJob = { id: number; netlist: Netlist; want: string[] }
export type SpiceOut = {
  id: number
  ok: boolean
  error?: string
  analysis: 'tran' | 'ac'
  /** Time in seconds, or frequency in hertz. */
  x: number[]
  /** Transient: the signal values. AC: magnitude in dB. */
  y: Record<string, number[]>
  ms: number
  points: number
  size: number
}

self.onmessage = (e: MessageEvent<SpiceJob>) => {
  const { id, netlist, want } = e.data
  const kind = netlist.analyses[0].kind === 'ac' ? 'ac' : 'tran'
  const t0 = performance.now()
  let out: SpiceOut
  try {
    const res = simulate(netlist)[0]
    const ms = performance.now() - t0
    const y: Record<string, number[]> = {}
    for (const w of want) {
      if (kind === 'ac') {
        const c = res.csignals?.[w]
        if (c) y[w] = c.map((z) => 20 * Math.log10(Math.max(1e-300, Math.hypot(z.re, z.im))))
      } else if (res.signals[w]) y[w] = res.signals[w]
    }
    out = { id, ok: !!res.converged, analysis: kind, x: res.sweep, y, ms, points: res.stats?.points ?? res.sweep.length, size: res.stats?.matrixSize ?? 0 }
    if (!res.converged) out.error = res.errors?.[0]?.message ?? 'The solve did not converge.'
  } catch (err) {
    out = { id, ok: false, error: err instanceof Error ? err.message : String(err), analysis: kind, x: [], y: {}, ms: performance.now() - t0, points: 0, size: 0 }
  }
  ;(self as unknown as DedicatedWorkerGlobalScope).postMessage(out)
}
