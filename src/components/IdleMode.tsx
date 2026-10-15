'use client'

import { useEffect, useRef, useState } from 'react'
import { Wordmark } from './Wordmark'
import { LocalTime } from './LocalTime'
import { LOCATION } from '@/lib/site'

const DEFAULT_S = 60
const EXIT_MS = 480

type Phase = 'off' | 'enter' | 'on' | 'exit'

/** Anything that means "someone is here, or something is meant to be watched": idle must not start. */
function busy(lastTarget: Element | null): boolean {
  const html = document.documentElement
  if (document.hidden || html.dataset.route) return true
  if (document.fullscreenElement || (document as Document & { pictureInPictureElement?: Element }).pictureInPictureElement) return true
  if (document.querySelector('.cmdk.open, .menu.open, dialog[open]')) return true
  const sel = window.getSelection()
  if (sel && !sel.isCollapsed) return true
  // Focus left behind in a closed (aria-hidden) panel is not typing.
  const a = document.activeElement?.closest('[aria-hidden="true"]') ? null : (document.activeElement as HTMLElement | null)
  if (a && (a.isContentEditable || a.matches('input, textarea, select, [role="combobox"], [role="textbox"]'))) return true
  if (a?.closest('.demo, [data-demo]')) return true
  const vh = window.innerHeight
  const inView = (el: Element) => {
    const r = el.getBoundingClientRect()
    return r.bottom > 0 && r.top < vh && r.width > 0
  }
  for (const v of Array.from(document.querySelectorAll('video'))) {
    if (!v.paused && !v.ended && !v.muted && inView(v)) return true
    if (!v.paused && !v.ended && v.controls && inView(v)) return true
  }
  // Escape hatch for other components: any visible [data-no-idle] holds idle off.
  for (const el of Array.from(document.querySelectorAll('[data-no-idle]'))) if (inView(el)) return true
  // A demo the visitor was just using, still on screen.
  const demo = lastTarget?.closest('.demo, [data-demo]')
  if (demo && demo.isConnected && inView(demo)) return true
  return false
}

/**
 * After a minute untouched, the page eases into the lit room: drifting oxblood light, the wordmark, and the
 * time in San Jose. Any input brings the page straight back, exactly where it was.
 */
export function IdleMode() {
  const [phase, setPhase] = useState<Phase>('off')
  const phaseRef = useRef<Phase>('off')
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const motionOK = window.matchMedia('(prefers-reduced-motion: no-preference)')
    const q = Number(new URLSearchParams(location.search).get('idle'))
    const delay = (q >= 3 && q <= 600 ? q : DEFAULT_S) * 1000

    let timer = 0
    let exitT = 0
    let swallowUntil = 0
    let lastTarget: Element | null = null

    const set = (p: Phase) => {
      phaseRef.current = p
      setPhase(p)
    }
    const arm = () => {
      clearTimeout(timer)
      if (document.hidden || !motionOK.matches) return
      timer = window.setTimeout(tryEnter, delay)
    }
    const tryEnter = () => {
      if (phaseRef.current !== 'off') return
      if (busy(lastTarget)) return arm()
      set('enter')
      document.documentElement.dataset.idle = 'on'
    }
    const exit = () => {
      clearTimeout(exitT)
      set('exit')
      swallowUntil = performance.now() + EXIT_MS
      delete document.documentElement.dataset.idle
      exitT = window.setTimeout(() => {
        set('off')
        arm()
      }, EXIT_MS)
    }
    // Layout changes under a resting mouse can fire synthetic moves; only real travel counts as presence.
    let px = -1
    let py = -1
    const moved = (e: Event) => {
      if (!(e instanceof MouseEvent)) return true
      const far = px < 0 || Math.abs(e.clientX - px) + Math.abs(e.clientY - py) > 3
      px = e.clientX
      py = e.clientY
      return far
    }
    const activity = (e: Event) => {
      const passive = e.type === 'pointermove' || e.type === 'scroll'
      if (e.type === 'pointermove' && !moved(e)) return
      if (e.target instanceof Element) lastTarget = e.target
      const p = phaseRef.current
      if (p === 'enter' || p === 'on') {
        // The waking input only wakes; it must not scroll, click, or type into the page underneath.
        if (!passive) {
          if (e.cancelable) e.preventDefault()
          e.stopPropagation()
        }
        exit()
        return
      }
      if (p === 'exit') {
        if (!passive && performance.now() < swallowUntil) {
          if (e.cancelable) e.preventDefault()
          e.stopPropagation()
        }
        return
      }
      arm()
    }

    const opts: AddEventListenerOptions = { capture: true, passive: false }
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'touchmove', 'click', 'scroll']
    events.forEach((t) => window.addEventListener(t, activity, opts))

    const onVis = () => {
      if (document.hidden) {
        clearTimeout(timer)
        root.current?.classList.add('paused')
      } else {
        root.current?.classList.remove('paused')
        if (phaseRef.current === 'off') arm()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    const onMotion = () => {
      if (!motionOK.matches && phaseRef.current !== 'off') exit()
      arm()
    }
    motionOK.addEventListener?.('change', onMotion)
    arm()

    return () => {
      clearTimeout(timer)
      clearTimeout(exitT)
      events.forEach((t) => window.removeEventListener(t, activity, opts))
      document.removeEventListener('visibilitychange', onVis)
      motionOK.removeEventListener?.('change', onMotion)
      delete document.documentElement.dataset.idle
    }
  }, [])

  // Mount hidden, then fade in on the next frames so the transition runs.
  useEffect(() => {
    if (phase !== 'enter') return
    let r2 = 0
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        if (phaseRef.current !== 'enter') return
        phaseRef.current = 'on'
        setPhase('on')
      })
    })
    return () => {
      cancelAnimationFrame(r1)
      cancelAnimationFrame(r2)
    }
  }, [phase])

  if (phase === 'off') return null
  return (
    <div
      ref={root}
      className={`idle ${phase === 'on' ? 'on' : ''} ${phase === 'exit' ? 'out' : ''}`}
      aria-hidden="true"
      data-lenis-prevent=""
      data-tone="dark"
    >
      <div className="idle-light">
        <i className="idle-pool" />
        <i className="idle-bloom" />
      </div>
      <div className="idle-time grid-main">
        <p className="col-span-4 flex flex-col gap-[4px] text-body md:col-span-6">
          <span>{LOCATION}</span>
          <LocalTime />
        </p>
      </div>
      <div className="idle-wm grid-main">
        <Wordmark as="p" className="col-span-4 md:col-span-12" />
      </div>
    </div>
  )
}
