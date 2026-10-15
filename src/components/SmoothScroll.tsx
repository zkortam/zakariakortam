'use client'

import { useEffect } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { setLenis } from '@/lib/lenis'
import { getQuality, onQuality } from '@/lib/quality'

/** Lenis on fine pointers, plus a frame-time watchdog that steps quality down on weak machines. */
export function SmoothScroll() {
  useEffect(() => {
    const html = document.documentElement
    const save = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    const motionOK = window.matchMedia('(prefers-reduced-motion: no-preference)').matches
    const fine = window.matchMedia('(pointer: fine)').matches

    let lenis: Lenis | null = null
    const mount = () => {
      if (lenis || !motionOK || !fine || save || html.classList.contains('lite') || getQuality() === 'low') return
      lenis = new Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false, autoRaf: true })
      setLenis(lenis)
    }
    mount()
    // data-quality="low" (see lib/quality) turns smooth scroll off; it comes back if the machine recovers.
    const offQuality = onQuality((q) => {
      if (q !== 'low') return mount()
      lenis?.destroy()
      lenis = null
      setLenis(null)
    })

    if (!motionOK) {
      return () => {
        offQuality()
        lenis?.destroy()
        setLenis(null)
      }
    }

    const t0 = performance.now()
    let lastScroll = -Infinity
    let raf = 0
    let running = false
    let last = 0
    let frames: number[] = []

    // Single long frames are loading hitches (image decode, route render), not a slow machine: they are
    // skipped, and a step down needs two slow windows in a row, so one bad moment never costs the session.
    let strikes = 0
    const tick = (t: number) => {
      if (last) {
        const dt = t - last
        if (dt < 100 && performance.now() - t0 > 1200) frames.push(dt)
      }
      last = t
      if (frames.length >= 60) {
        const mean = frames.reduce((a, b) => a + b, 0) / frames.length
        frames = []
        const limit = html.classList.contains('lite') ? 28 : 22
        strikes = mean > limit ? strikes + 1 : 0
        if (strikes >= 2 && html.classList.contains('lite')) {
          strikes = 0
          html.classList.add('lite-2')
        } else if (strikes >= 2) {
          strikes = 0
          html.classList.add('lite')
          if (lenis) {
            lenis.destroy()
            lenis = null
            setLenis(null)
          }
        }
      }
      const now = performance.now()
      if (now - t0 < 6000 || now - lastScroll < 1000) {
        raf = requestAnimationFrame(tick)
      } else {
        running = false
        last = 0
        frames = []
      }
    }
    const start = () => {
      if (running) return
      running = true
      raf = requestAnimationFrame(tick)
    }
    const onScroll = () => {
      lastScroll = performance.now()
      start()
    }
    start()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      offQuality()
      lenis?.destroy()
      setLenis(null)
    }
  }, [])

  return null
}
