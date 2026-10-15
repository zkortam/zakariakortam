'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

/*
 * Pop a live demo (or any panel) into an always-on-top window with Document Picture-in-Picture, so it
 * keeps running while the visitor reads elsewhere or switches tabs. Chromium only: the affordance is not
 * rendered at all where the API is missing. The children are portaled into the PiP document (React
 * attaches its event listeners to portal containers, so the demo stays interactive) and come back when
 * the window closes. While popped, animation frames are served by the PiP window, because the opener's
 * requestAnimationFrame stops as soon as its tab is hidden.
 */

type PipApi = { requestWindow: (o?: { width?: number; height?: number }) => Promise<Window>; window: Window | null }
const pipApi = () => (typeof window !== 'undefined' ? (window as unknown as { documentPictureInPicture?: PipApi }).documentPictureInPicture : undefined)

let rafPatched: { orig: typeof requestAnimationFrame; cancel: typeof cancelAnimationFrame } | null = null
function routeFramesTo(pip: Window | null) {
  if (pip && !rafPatched) {
    rafPatched = { orig: window.requestAnimationFrame, cancel: window.cancelAnimationFrame }
    window.requestAnimationFrame = (cb) => pip.requestAnimationFrame(cb)
    window.cancelAnimationFrame = (id) => pip.cancelAnimationFrame(id)
  } else if (!pip && rafPatched) {
    window.requestAnimationFrame = rafPatched.orig
    window.cancelAnimationFrame = rafPatched.cancel
    rafPatched = null
  }
}

function copyStyles(to: Document) {
  to.documentElement.className = document.documentElement.className
  to.documentElement.lang = document.documentElement.lang
  for (const node of Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))) {
    if (node instanceof HTMLLinkElement) {
      const l = to.createElement('link')
      l.rel = 'stylesheet'
      l.href = node.href
      to.head.appendChild(l)
    } else {
      to.head.appendChild(to.importNode(node, true))
    }
  }
}

export function PopOut({
  children,
  title,
  width = 720,
  height = 520,
  className = '',
}: {
  children: ReactNode
  title: string
  width?: number
  height?: number
  className?: string
}) {
  const [supported, setSupported] = useState(false)
  const [pip, setPip] = useState<Window | null>(null)
  const pipRef = useRef<Window | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const [held, setHeld] = useState(0)

  useEffect(() => {
    setSupported(!!pipApi() && window.matchMedia('(hover: hover) and (pointer: fine)').matches)
  }, [])

  const close = useCallback(() => {
    routeFramesTo(null)
    pipRef.current = null
    setPip(null)
  }, [])

  const open = useCallback(async () => {
    const api = pipApi()
    if (!api) return
    if (api.window) api.window.close()
    try {
      setHeld(box.current?.offsetHeight ?? 0)
      const w = await api.requestWindow({ width, height })
      copyStyles(w.document)
      w.document.title = title
      w.document.body.className = 'pip-body'
      w.addEventListener('pagehide', close, { once: true })
      pipRef.current = w
      routeFramesTo(w)
      setPip(w)
    } catch {
      // Dismissed or blocked: nothing to undo.
    }
  }, [width, height, title, close])

  // Leaving the page brings the demo home and closes its window.
  useEffect(
    () => () => {
      const w = pipRef.current
      routeFramesTo(null)
      w?.close()
    },
    [],
  )

  return (
    <div ref={box} className={`popout ${className}`}>
      {supported && (
        <button
          type="button"
          className="popout-btn c3"
          onClick={pip ? () => pip.close() : open}
          aria-pressed={!!pip}
          aria-label={pip ? 'Bring back' : 'Pop out into its own window'}
          title={pip ? 'Bring back' : 'Pop out'}
        >
          <Icon name={pip ? 'popin' : 'popout'} size={20} />
        </button>
      )}
      {pip ? (
        <>
          <div className="popout-away c3" role="status" style={{ minHeight: Math.min(held, 640) || undefined }}>
            Running in its own window.
          </div>
          {createPortal(
            <div className="pip-root" data-tone="dark">
              {children}
            </div>,
            pip.document.body,
          )}
        </>
      ) : (
        children
      )}
    </div>
  )
}
