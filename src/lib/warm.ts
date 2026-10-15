import { getImageProps } from 'next/image'
import { PLATES } from './media'

/**
 * The first pictures of each route, described exactly as the page renders them (same src, sizes, quality),
 * so a preload made on hover lands in the cache under the URL the page will ask for.
 * Mirrors PlateMedia, ProjectTile, HomeHero and the About portrait. If one of those changes its sizes,
 * a warm-up simply misses the cache and costs one extra request; nothing breaks.
 */
type Pic = { src: string; w: number; h: number; sizes: string; q: number; media?: string }

const PHONE_SIZES = '(min-width:1024px) 400px, 300px'
const CARD_SIZES = '(min-width:1024px) 71vw, 100vw'
const RESULTS_SIZES = '(min-width:1024px) 560px, 100vw'
const BOARD_SIZES = '(min-width:1024px) 120vw, 180vw'
const TILE_SIZES = '(min-width:1024px) 31vw, (min-width:768px) 48vw, 100vw'
const TILE_ORDER = ['helio', 'surf', 'surf-messenger']

const WIDE = '(min-width:1024px)'
const NARROW = '(max-width:1023.98px)'

function plate(id: string): Pic[] {
  const s = PLATES[id]
  if (!s) return []
  const p = s.primary
  switch (s.composition) {
    case 'card': {
      const m = s.mobile ?? p
      return [
        { src: p.src, w: p.w, h: p.h, sizes: CARD_SIZES, q: 82, media: WIDE },
        { src: p.src, w: p.w, h: p.h, sizes: '100vw', q: 82, media: '(min-width:768px) and (max-width:1023.98px)' },
        { src: m.src, w: m.w, h: m.h, sizes: '100vw', q: 82, media: '(max-width:767.98px)' },
      ]
    }
    case 'phone-left':
    case 'phone-right':
      return [{ src: p.src, w: p.w, h: p.h, sizes: PHONE_SIZES, q: 82 }]
    case 'bleed':
      return [
        { src: p.src, w: p.w, h: p.h, sizes: BOARD_SIZES, q: 75, media: WIDE },
        { src: p.src, w: p.w, h: p.h, sizes: '180vw', q: 75, media: NARROW },
      ]
    case 'results':
      return [{ src: p.src, w: p.w, h: p.h, sizes: RESULTS_SIZES, q: 82 }]
  }
  return []
}

export function picturesFor(path: string): Pic[] {
  if (path === '/') return [{ src: '/portrait/zakaria-plate.webp', w: 1485, h: 1485, sizes: '(min-width:2400px) and (min-height:1300px) 1200px, (min-width:768px) 640px, 560px', q: 90 }]
  if (path === '/about') {
    return [{ src: '/portrait/zakaria-paper.webp', w: 1485, h: 1485, sizes: '(min-width:1024px) 31vw, (min-width:768px) 40vw, 75vw', q: 90 }]
  }
  if (path === '/portfolio') {
    return TILE_ORDER.flatMap((id) => {
      const s = PLATES[id]
      if (!s) return []
      return [{ src: s.primary.src, w: s.primary.w, h: s.primary.h, sizes: TILE_SIZES, q: s.composition === 'bleed' ? 75 : 82 }]
    })
  }
  const m = /^\/portfolio\/([^/]+)\/?$/.exec(path)
  return m ? plate(m[1]) : []
}

const done = new Set<string>()

/** Preload the pictures a route opens on. Each route is warmed once per session. */
export function warm(path: string) {
  if (done.has(path)) return
  done.add(path)
  const save = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
  if (save) return
  for (const pic of picturesFor(path)) {
    if (pic.media && !window.matchMedia(pic.media).matches) continue
    const { props } = getImageProps({ src: pic.src, alt: '', width: pic.w, height: pic.h, sizes: pic.sizes, quality: pic.q })
    // A detached image fetches with the same candidate choice as the page will make, and unlike a
    // preload link it never warns when the visitor does not follow through.
    const img = new Image()
    img.decoding = 'async'
    if (props.sizes) img.sizes = props.sizes
    if (props.srcSet) img.srcset = props.srcSet
    img.src = props.src
  }
}
