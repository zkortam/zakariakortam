'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/*
 * Voice input: record from the microphone (MediaRecorder, in every current browser including iOS
 * Safari), stop on a tap or once the speaker has gone quiet, then transcribe on the server
 * (/api/transcribe, Whisper). The browser's own speech recognition was dropped: it is missing in
 * Firefox, always fails in Brave, and its errors were invisible.
 */

export type SpeechState = 'idle' | 'listening' | 'working'

const MAX_MS = 20_000
/** Quiet this long after speech has started ends the recording. */
const SILENCE_MS = 1400
/** Nothing heard at all for this long: give up. */
const NO_SPEECH_MS = 6000
/** RMS level (0..1) above which the input counts as speech. */
const SPEECH_LEVEL = 0.035

function pickType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported?.(t)) return t
  }
  return undefined
}

export function useSpeech(onFinal: (t: string) => void, onError: (msg: string) => void) {
  const [supported, setSupported] = useState(false)
  const [state, setState] = useState<SpeechState>('idle')
  const [level, setLevel] = useState(0)
  const cbs = useRef({ onFinal, onError })
  cbs.current = { onFinal, onError }
  const session = useRef<{ stop: (send: boolean) => void } | null>(null)

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined')
  }, [])
  useEffect(() => () => session.current?.stop(false), [])

  const stop = useCallback(() => session.current?.stop(true), [])
  const cancel = useCallback(() => session.current?.stop(false), [])

  const start = useCallback(async () => {
    if (session.current) return
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch (e) {
      const name = (e as { name?: string })?.name
      cbs.current.onError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Microphone access is blocked. Allow it in your browser to ask by voice.'
          : 'No microphone found.',
      )
      return
    }

    const mime = pickType()
    let rec: MediaRecorder
    try {
      rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
    } catch {
      stream.getTracks().forEach((t) => t.stop())
      cbs.current.onError('Voice input is not supported in this browser.')
      return
    }

    const chunks: Blob[] = []
    let send = true
    let heard = false
    const began = performance.now()
    let lastLoud = began
    let raf = 0

    // Level meter and end-of-speech detection.
    type AC = typeof AudioContext
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext) as AC | undefined
    const ctx = Ctx ? new Ctx() : null
    const analyser = ctx?.createAnalyser()
    if (ctx && analyser) {
      analyser.fftSize = 1024
      ctx.createMediaStreamSource(stream).connect(analyser)
    }
    const buf = new Float32Array(1024)
    const watch = () => {
      const now = performance.now()
      if (analyser) {
        analyser.getFloatTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
        const rms = Math.sqrt(sum / buf.length)
        setLevel(Math.min(1, rms * 8))
        if (rms > SPEECH_LEVEL) {
          heard = true
          lastLoud = now
        }
        if (heard && now - lastLoud > SILENCE_MS) return end(true)
        if (!heard && now - began > NO_SPEECH_MS) return end(false, 'I didn’t hear anything. Try again closer to the mic.')
      }
      if (now - began > MAX_MS) return end(true)
      raf = requestAnimationFrame(watch)
    }

    let ended = false
    const end = (keep: boolean, msg?: string) => {
      if (ended) return
      ended = true
      send = keep
      cancelAnimationFrame(raf)
      setLevel(0)
      if (msg) cbs.current.onError(msg)
      if (rec.state !== 'inactive') rec.stop()
      else finish()
    }

    const finish = async () => {
      stream.getTracks().forEach((t) => t.stop())
      ctx?.close().catch(() => {})
      session.current = null
      if (!send || !chunks.length) {
        setState('idle')
        return
      }
      setState('working')
      const type = (rec.mimeType || mime || 'audio/webm').split(';')[0]
      try {
        const r = await fetch('/api/transcribe', { method: 'POST', headers: { 'content-type': type }, body: new Blob(chunks, { type }) })
        const data = (await r.json().catch(() => ({}))) as { text?: string; error?: string }
        if (!r.ok) cbs.current.onError(data.error || 'I could not hear that. Try again or type it.')
        else if (data.text) cbs.current.onFinal(data.text)
        else cbs.current.onError('I didn’t catch that. Try again.')
      } catch {
        cbs.current.onError('I could not hear that. Try again or type it.')
      }
      setState('idle')
    }

    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onstop = () => void finish()
    session.current = { stop: (keep) => end(keep) }
    rec.start(250)
    setState('listening')
    raf = requestAnimationFrame(watch)
  }, [])

  return { supported, state, listening: state === 'listening', working: state === 'working', level, start, stop, cancel }
}
