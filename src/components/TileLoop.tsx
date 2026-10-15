'use client'

import { useEffect, useRef } from 'react'
import type { Clip } from '@/lib/media'
import { videoOff } from './LoopVideo'

/**
 * The product loop over a tile's still. Nothing loads until it is wanted: on a mouse, when the pointer enters the
 * tile; on touch, when the tile is mostly on screen. It fades in over the still once it has a frame and pauses when
 * the pointer leaves or the tile scrolls away, so the still and the loop are always the same picture.
 */
export function TileLoop({ clip, className = '' }: { clip: Clip; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = ref.current
    const tile = v?.closest<HTMLElement>('.tile')
    if (!v || !tile || videoOff()) return
    v.muted = true
    let loaded = false
    const load = () => {
      if (loaded) return
      loaded = true
      v.innerHTML = `<source src="${clip.webm}" type="video/webm"><source src="${clip.mp4}" type="video/mp4">`
      v.load()
    }
    const play = () => {
      load()
      v.play().catch(() => undefined)
    }
    const pause = () => {
      if (!v.paused) v.pause()
    }
    const onPlaying = () => v.classList.add('on')
    v.addEventListener('playing', onPlaying)

    const mouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (mouse) {
      const enter = () => play()
      const leave = () => pause()
      tile.addEventListener('pointerenter', enter)
      tile.addEventListener('pointerleave', leave)
      tile.addEventListener('focus', enter)
      tile.addEventListener('blur', leave)
      return () => {
        v.removeEventListener('playing', onPlaying)
        tile.removeEventListener('pointerenter', enter)
        tile.removeEventListener('pointerleave', leave)
        tile.removeEventListener('focus', enter)
        tile.removeEventListener('blur', leave)
      }
    }
    const io = new IntersectionObserver(([e]) => (e.intersectionRatio >= 0.6 && !document.hidden ? play() : pause()), {
      threshold: [0, 0.6],
    })
    io.observe(tile)
    return () => {
      v.removeEventListener('playing', onPlaying)
      io.disconnect()
    }
  }, [clip])

  return <video ref={ref} className={`tile-loop ${className}`} muted playsInline loop preload="none" aria-hidden="true" tabIndex={-1} disableRemotePlayback />
}
