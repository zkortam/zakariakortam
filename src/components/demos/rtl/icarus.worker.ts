/// <reference lib="webworker" />
/**
 * Icarus Verilog (ivlpp, ivl, vvp compiled to WebAssembly) in a worker, driven exactly the way RTL++
 * drives it: the vendored engines/icarusWeb runner, the generated harness that dumps the testbench
 * to a VCD, displays stamped with their time, and rtlpp_check.svh for structured check records.
 *
 * The WebAssembly is GPL software and is never bundled with this site: it is fetched at run time from
 * the npm CDN, the same host and the same pinned files RTL++ uses, and every byte is checked against
 * the SHA-256 in the vendored asset manifest before it runs.
 */
import { prepareIcarus, runIcarusWeb, type IcarusAssets, type IcarusTool } from '@/vendor/rtlpp/engines/icarusWeb'
import { ENGINE_ASSETS } from '@/vendor/rtlpp/engines/assetManifest'
import { HARNESS_FILE, HARNESS_MODULE, VCD_FILE, harnessSource, parseIcarusOutput, stampDisplays } from '@/vendor/rtlpp/sim/testbench'
import { CHECK_HEADER, CHECK_SVH, parseChecks } from '@/vendor/rtlpp/sim/checks'
import { VcdParser } from '@/vendor/rtlpp/sim/vcd'
import { COUNTER_FILE, TB_COUNTER, TB_FILE, TB_NAME, WAVES } from './sources'
import type { CompileError, FromWorker, RunResult, ToWorker, Wave } from './protocol'

const PKG = '@veriflow/iverilog-wasm'
const pinned = ENGINE_ASSETS[PKG]
const BASE = `https://cdn.jsdelivr.net/npm/${PKG}@${pinned.version}/`
const MAX_VCD = 8 * 1024 * 1024
const MAX_MS = 6000

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')

async function verified(path: string): Promise<Uint8Array> {
  const pin = pinned.files[path]
  if (!pin) throw new Error(`No pinned file ${path}`)
  const res = await fetch(BASE + path, { mode: 'cors', credentials: 'omit' })
  if (!res.ok) throw new Error(`Could not fetch ${path} (${res.status})`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (hex(await crypto.subtle.digest('SHA-256', bytes)) !== pin[1]) throw new Error(`${path} does not match its pinned SHA-256`)
  return bytes
}

async function importText(source: string) {
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
  try {
    return await import(/* webpackIgnore: true */ url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

const assets: IcarusAssets = {
  loader: async (tool: IcarusTool) => new TextDecoder().decode(await verified(`dist/runtime/${tool}.mjs`)),
  wasm: (tool: IcarusTool) => verified(`dist/runtime/${tool}.wasm`),
  importText,
}

const bytesTotal = Object.values(pinned.files).reduce((a, [n]) => a + n, 0)
let warm: Promise<void> | null = null

/** Fetch, verify and compile the three tools once. */
function prepare() {
  if (!warm) {
    warm = prepareIcarus(assets)
    warm.catch(() => (warm = null))
  }
  return warm
}

const FS_PER_NS = 1e6

function compileErrors(text: string): CompileError[] {
  const out: CompileError[] = []
  for (const raw of text.split('\n')) {
    const m = /^\s*(?:\.\/)?([\w.]+):(\d+):\s*(?:error:\s*)?(.*)$/.exec(raw)
    if (!m || /^warning/i.test(m[3]) || /I give up/.test(raw)) continue
    out.push({ file: m[1], line: Number(m[2]), message: m[3].trim() || 'error' })
  }
  return out
}

async function run(code: string): Promise<RunResult> {
  await prepare()
  const parser = new VcdParser()
  let vcdBytes = 0
  const t0 = performance.now()
  const res = await runIcarusWeb(assets, {
    files: {
      [COUNTER_FILE]: code,
      [TB_FILE]: stampDisplays(TB_COUNTER),
      [CHECK_HEADER]: CHECK_SVH,
      [HARNESS_FILE]: harnessSource(TB_NAME),
    },
    sources: [COUNTER_FILE, TB_FILE, HARNESS_FILE],
    roots: [TB_NAME, HARNESS_MODULE],
    generation: '2012',
    streams: {
      [VCD_FILE]: (chunk) => {
        vcdBytes += chunk.length
        parser.push(chunk)
      },
    },
    shouldStop: () =>
      vcdBytes > MAX_VCD ? 'the waveform grew past 8 MB' : performance.now() - t0 > MAX_MS ? 'it ran for more than 6 seconds' : null,
  })
  if (res.stopped) return { kind: 'stopped', reason: res.stopped }
  const text = `${res.stdout}${res.stderr}`
  if (res.stage !== 'run') {
    const errors = compileErrors(res.stderr || res.stdout)
    return { kind: 'compile', errors, raw: (res.stderr || res.stdout).trim().split('\n').slice(0, 8).join('\n') }
  }
  const verdict = parseIcarusOutput(text, res.exitCode)
  const vcd = parser.finish()
  const waves: Partial<Record<string, Wave>> = {}
  for (const name of WAVES) {
    const s = vcd.signals.find((x) => x.path === `${TB_NAME}.${name}`)
    if (s) waves[name] = { times: s.times.map((t) => t / FS_PER_NS), values: s.values, width: s.width }
  }
  const endFs = verdict.endFs ?? vcd.endFs
  const rec = parseChecks(text)[0]
  const f = verdict.failure
  return {
    kind: 'ran',
    passed: !f,
    failure: f
      ? { message: f.message, ...(f.atFs !== undefined ? { atNs: f.atFs / FS_PER_NS } : {}), ...(f.source ? { file: f.source.file, line: f.source.line } : {}) }
      : null,
    check: rec ? { expr: rec.expr, got: rec.got, expected: rec.expected, atNs: rec.atFs / FS_PER_NS, line: rec.line } : null,
    endNs: endFs / FS_PER_NS,
    waves,
    timings: { compileMs: res.timings.preprocessMs + res.timings.compileMs, runMs: res.timings.runMs },
  }
}

const post = (m: FromWorker) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m)

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const m = e.data
  if (m.type === 'prepare') {
    const t0 = performance.now()
    try {
      await prepare()
      post({ type: 'ready', ms: performance.now() - t0, bytes: bytesTotal })
    } catch (err) {
      post({ type: 'failed', message: err instanceof Error ? err.message : String(err) })
    }
    return
  }
  try {
    await prepare()
    post({ type: 'started', id: m.id })
    post({ type: 'result', id: m.id, result: await run(m.code) })
  } catch (err) {
    post({ type: 'failed', message: err instanceof Error ? err.message : String(err) })
  }
}
