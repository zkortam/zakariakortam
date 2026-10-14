'use client'

import { useEffect } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { setLenis } from '@/lib/lenis'

/** Lenis on fine pointers, plus a frame-time watchdog that steps quality down on weak machines. */
export function SmoothScroll() {
  useEffect(() => {
    const html = document.documentElement
    const save = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    const motionOK = window.matchMedia('(prefers-reduced-motion: no-preference)').matches
    const fine = window.matchMedia('(pointer: fine)').matches

    let lenis: Lenis | null = null
    if (motionOK && fine && !save && !html.classList.contains('lite')) {
      lenis = new Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false, autoRaf: true })
      setLenis(lenis)
    }

    if (!motionOK) {
      return () => {
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

    const tick = (t: number) => {
      if (last) {
        const dt = t - last
        if (dt < 250) frames.push(dt)
      }
      last = t
      if (frames.length >= 60) {
        const mean = frames.reduce((a, b) => a + b, 0) / frames.length
        frames = []
        if (html.classList.contains('lite')) {
          if (mean > 28) html.classList.add('lite-2')
        } else if (mean > 22) {
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
      lenis?.destroy()
      setLenis(null)
    }
  }, [])

  return null
}
