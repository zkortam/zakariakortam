/// <reference lib="webworker" />
/**
 * Runs a schematic the way SPICE++ runs one: buildNetlist turns the sheet and its directives into a
 * netlist, and the engine solves every enabled analysis. Both are vendored, unmodified, from
 * zkortam/spiceplusplus (src/vendor/spicepp). In a worker so a solve never blocks typing.
 */
import { buildNetlist } from '@/vendor/spicepp/schematic/netlist'
import { simulate } from '@/vendor/spicepp/sim/engine'
import type { SchematicDoc } from '@/vendor/spicepp/schematic/types'
import type { SimResult } from '@/vendor/spicepp/sim/types'

export type SpiceJob = { id: number; doc: SchematicDoc }
export type SpiceOut = { id: number; ok: boolean; error?: string; results: SimResult[]; ms: number }

self.onmessage = (e: MessageEvent<SpiceJob>) => {
  const { id, doc } = e.data
  const t0 = performance.now()
  let out: SpiceOut
  try {
    const nl = buildNetlist(doc)
    const bad = nl.errors.find((x) => x.severity === 'error')
    if (bad) out = { id, ok: false, error: bad.message, results: [], ms: performance.now() - t0 }
    else {
      const results = simulate(nl)
      const failed = results.filter((r) => !r.converged || r.errors.some((x) => x.severity === 'error'))
      out = {
        id,
        ok: failed.length < results.length,
        error: failed[0]?.errors.find((x) => x.severity === 'error')?.message,
        results,
        ms: performance.now() - t0,
      }
    }
  } catch (err) {
    out = { id, ok: false, error: err instanceof Error ? err.message : String(err), results: [], ms: performance.now() - t0 }
  }
  ;(self as unknown as DedicatedWorkerGlobalScope).postMessage(out)
}
