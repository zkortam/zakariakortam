'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import type { Clip } from '@/lib/media'

const PHONE = '(max-width: 767px)'

/** Motion is off: reduced motion, Save-Data, or the site's own low-power mode. The poster stands in. */
export function videoOff() {
  const save = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    !!save ||
    document.documentElement.classList.contains('lite-2')
  )
}

/**
 * A muted product loop that plays only while on screen. It starts on its poster (the loop's first frame), never
 * autoplays under reduced motion or Save-Data, and pauses off screen. `data-hold` (set by the page transition) keeps
 * it still until the transition hands over.
 */
export function LoopVideo({
  clip,
  mobile,
  id,
  className = '',
  style,
  fill = false,
  alt = '',
  eager = false,
}: {
  clip: Clip
  /** Art-directed rendition for phones (< 768). */
  mobile?: Clip
  /** Shared by every copy of the same loop, so a transition can hand the playhead from one to the next. */
  id: string
  className?: string
  style?: CSSProperties
  /** Fill a positioned box (object-fit: cover) instead of sizing to the picture. */
  fill?: boolean
  alt?: string
  eager?: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = true
    v.defaultMuted = true
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    let visible = false
    const sync = () => {
      if (visible && !document.hidden && !videoOff() && !v.dataset.hold) {
        v.play().catch(() => undefined)
      } else if (!v.paused) {
        v.pause()
      }
    }
    if (videoOff()) v.preload = 'none'
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting
        sync()
      },
      { rootMargin: '120px 0px' },
    )
    io.observe(v)
    const onHold = new MutationObserver(sync)
    onHold.observe(v, { attributes: true, attributeFilter: ['data-hold'] })
    mq.addEventListener('change', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      io.disconnect()
      onHold.disconnect()
      mq.removeEventListener('change', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  // The poster is a real picture under the video (media-switched like the video), so the first paint, the
  // reduced-motion view and a transition clone all show the same frame the loop starts on.
  return (
    <span className={`loop ${fill ? 'loop-fill' : ''} ${className}`} style={style} data-loop-box="">
      <picture>
        {mobile && <source media={PHONE} srcSet={mobile.poster} width={mobile.w} height={mobile.h} />}
        <img src={clip.poster} width={clip.w} height={clip.h} alt={alt} className="loop-poster" decoding="async" loading={eager ? 'eager' : 'lazy'} />
      </picture>
      <video
        ref={ref}
        className="loop-video"
        data-loop={id}
        width={clip.w}
        height={clip.h}
        muted
        playsInline
        loop
        preload="metadata"
        disableRemotePlayback
        aria-hidden="true"
        tabIndex={-1}
      >
        {mobile && <source media={PHONE} src={mobile.webm} type="video/webm" />}
        {mobile && <source media={PHONE} src={mobile.mp4} type="video/mp4" />}
        <source src={clip.webm} type="video/webm" />
        <source src={clip.mp4} type="video/mp4" />
      </video>
    </span>
  )
}
