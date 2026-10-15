'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// The Web Speech API is not in TypeScript's DOM lib; this is the slice we use.
type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}
type RecognitionCtor = new () => Recognition

function ctor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/**
 * Voice input where the browser supports it. `onText` receives the live transcript;
 * `onFinal` the finished phrase when the person stops talking.
 */
export function useSpeech(onText: (t: string) => void, onFinal: (t: string) => void) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const rec = useRef<Recognition | null>(null)
  const text = useRef('')
  const cbs = useRef({ onText, onFinal })
  cbs.current = { onText, onFinal }

  useEffect(() => setSupported(!!ctor()), [])
  useEffect(() => () => rec.current?.abort(), [])

  const stop = useCallback(() => rec.current?.stop(), [])

  const start = useCallback(() => {
    const C = ctor()
    if (!C || rec.current) return
    const r = new C()
    r.lang = navigator.language || 'en-US'
    r.interimResults = true
    r.continuous = false
    text.current = ''
    r.onresult = (e) => {
      let s = ''
      for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript
      text.current = s
      cbs.current.onText(s)
    }
    r.onerror = () => {}
    r.onend = () => {
      rec.current = null
      setListening(false)
      const t = text.current.trim()
      if (t) cbs.current.onFinal(t)
    }
    rec.current = r
    try {
      r.start()
      setListening(true)
    } catch {
      rec.current = null
    }
  }, [])

  return { supported, listening, start, stop }
}
