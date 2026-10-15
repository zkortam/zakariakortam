'use client'

import { useEffect } from 'react'
import { QUALITY_RANK, setQuality, type Quality } from '@/lib/quality'

type PressureState = 'nominal' | 'fair' | 'serious' | 'critical'
type PressureRecord = { state: PressureState }
type PressureObserverCtor = new (cb: (records: PressureRecord[]) => void) => {
  observe: (source: 'cpu', opts?: { sampleInterval?: number }) => Promise<void>
  disconnect: () => void
}

const LEVELS: Quality[] = ['low', 'medium', 'high']
const minQ = (...qs: Quality[]) => LEVELS[Math.min(...qs.map((q) => QUALITY_RANK[q]))]

// Down fast, up slow: a pressure reading must hold for DOWN_MS before quality drops, and the machine must
// stay calm for UP_MS before it climbs back. The frame-time and data signals only ever step down.
const DOWN_MS = 2000
const UP_MS = 20000

/** Decides the global quality level and writes it to <html data-quality>. Renders nothing. */
export function QualityLevel() {
  useEffect(() => {
    const html = document.documentElement
    const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number }

    // Testing hook: ?quality=low|medium|high pins the level for this page view.
    const forced = new URLSearchParams(location.search).get('quality')
    if (forced === 'low' || forced === 'medium' || forced === 'high') {
      setQuality(forced)
      return
    }

    const reducedData = window.matchMedia('(prefers-reduced-data: reduce)')
    const dataCap = (): Quality => (nav.connection?.saveData || reducedData.matches ? 'low' : 'high')
    const deviceCap: Quality = nav.deviceMemory !== undefined && nav.deviceMemory <= 2 ? 'medium' : 'high'
    const frameCap = (): Quality => (html.classList.contains('lite-2') ? 'low' : html.classList.contains('lite') ? 'medium' : 'high')

    let pressure: Quality = 'high'
    let candidate: Quality = 'high'
    let candidateTimer = 0

    const apply = () => setQuality(minQ(dataCap(), deviceCap, frameCap(), pressure))
    apply()

    const fromState = (s: PressureState): Quality => (s === 'critical' ? 'low' : s === 'serious' ? 'medium' : 'high')
    const onPressure = (records: PressureRecord[]) => {
      const last = records[records.length - 1]
      if (!last) return
      const next = fromState(last.state)
      if (next === candidate) return
      candidate = next
      clearTimeout(candidateTimer)
      if (next === pressure) return
      const wait = QUALITY_RANK[next] < QUALITY_RANK[pressure] ? DOWN_MS : UP_MS
      candidateTimer = window.setTimeout(() => {
        pressure = candidate
        apply()
      }, wait)
    }

    let observer: InstanceType<PressureObserverCtor> | null = null
    const PO = (window as unknown as { PressureObserver?: PressureObserverCtor }).PressureObserver
    if (PO) {
      try {
        observer = new PO(onPressure)
        observer.observe('cpu', { sampleInterval: 1000 }).catch(() => {
          observer = null
        })
      } catch {
        observer = null
      }
    }

    // The watchdog in SmoothScroll adds html.lite then html.lite-2; follow it.
    const mo = new MutationObserver(apply)
    mo.observe(html, { attributes: true, attributeFilter: ['class'] })
    reducedData.addEventListener?.('change', apply)

    return () => {
      clearTimeout(candidateTimer)
      observer?.disconnect()
      mo.disconnect()
      reducedData.removeEventListener?.('change', apply)
    }
  }, [])

  return null
}
