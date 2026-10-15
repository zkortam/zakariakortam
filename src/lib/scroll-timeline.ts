import { useEffect, useState } from 'react'

/** True where CSS scroll-driven animations run (Chromium 115+, Safari 26+): the compositor drives them. */
export function supportsScrollTimeline() {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('animation-timeline: view()')
}

/**
 * Whether the JS scroll path is needed. False on the server and on first render (the CSS path is already
 * live then, before any script), true only after mount in browsers without scroll-driven animations.
 */
export function useScrollFallback() {
  const [js, setJs] = useState(false)
  useEffect(() => {
    setJs(!supportsScrollTimeline())
  }, [])
  return js
}
