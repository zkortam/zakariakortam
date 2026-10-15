'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FromWorker, RunResult, ToWorker } from './protocol'

export type EngineState = { kind: 'off' } | { kind: 'loading' } | { kind: 'ready'; bytes: number } | { kind: 'failed'; message: string }

const HARD_LIMIT_MS = 10000

/**
 * Owns the Icarus worker: started once `start` turns true, restarted after a run that has to be
 * killed (a design that never yields to the simulator's output hook).
 */
export function useIcarus(start: boolean) {
  const worker = useRef<Worker | null>(null)
  const pending = useRef(new Map<number, (r: RunResult) => void>())
  const started = useRef(new Map<number, () => void>())
  const nextId = useRef(1)
  const [state, setState] = useState<EngineState>({ kind: 'off' })

  const boot = useCallback(() => {
    worker.current?.terminate()
    const w = new Worker(new URL('./icarus.worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    setState((s) => (s.kind === 'ready' ? s : { kind: 'loading' }))
    w.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data
      if (m.type === 'ready') setState({ kind: 'ready', bytes: m.bytes })
      else if (m.type === 'failed') {
        setState({ kind: 'failed', message: m.message })
        for (const [, done] of pending.current) done({ kind: 'stopped', reason: m.message })
        pending.current.clear()
      } else if (m.type === 'started') {
        started.current.get(m.id)?.()
        started.current.delete(m.id)
      } else {
        pending.current.get(m.id)?.(m.result)
        pending.current.delete(m.id)
      }
    }
    w.onerror = () => setState({ kind: 'failed', message: 'The simulator worker stopped.' })
    w.postMessage({ type: 'prepare' } satisfies ToWorker)
  }, [])

  useEffect(() => {
    if (start && !worker.current) boot()
  }, [start, boot])

  useEffect(
    () => () => {
      worker.current?.terminate()
      worker.current = null
    },
    [],
  )

  const run = useCallback(
    (code: string) =>
      new Promise<RunResult>((resolve) => {
        if (!worker.current) boot()
        const id = nextId.current++
        let timer = 0
        // The clock starts once the engine is loaded and the run has begun, not while it downloads.
        started.current.set(id, () => {
          timer = window.setTimeout(() => {
            if (!pending.current.has(id)) return
            pending.current.delete(id)
            boot()
            resolve({ kind: 'stopped', reason: 'it ran for more than 10 seconds' })
          }, HARD_LIMIT_MS)
        })
        pending.current.set(id, (r) => {
          window.clearTimeout(timer)
          resolve(r)
        })
        worker.current!.postMessage({ type: 'run', id, code } satisfies ToWorker)
      }),
    [boot],
  )

  const retry = useCallback(() => {
    setState({ kind: 'loading' })
    boot()
  }, [boot])

  return { state, run, retry }
}
