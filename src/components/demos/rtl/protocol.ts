/** Messages between the RTL demo and its Icarus worker. Plain data only. */

export type Wave = { times: number[]; values: string[]; width: number } // times in ns

export type CompileError = { file: string; line: number; message: string }

export type RunResult =
  | {
      kind: 'ran'
      passed: boolean
      /** The first failure Icarus reported, when there was one. */
      failure: { message: string; atNs?: number; file?: string; line?: number } | null
      /** The structured check record behind that failure (rtlpp_check.svh), when there was one. */
      check: { expr: string; got: string; expected: string; atNs: number; line: number } | null
      endNs: number
      waves: Partial<Record<string, Wave>>
      timings: { compileMs: number; runMs: number }
    }
  | { kind: 'compile'; errors: CompileError[]; raw: string }
  | { kind: 'stopped'; reason: string }

export type ToWorker = { type: 'prepare' } | { type: 'run'; id: number; code: string }

export type FromWorker =
  | { type: 'ready'; ms: number; bytes: number }
  | { type: 'failed'; message: string }
  | { type: 'started'; id: number }
  | { type: 'result'; id: number; result: RunResult }
