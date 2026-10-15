'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

/** Surf's versions, dated from its own About page. Pictures are its public site at the time, from the Internet Archive. */
const VERSIONS: { when: string; v: string; line: string; img?: string; cap?: string }[] = [
  { when: 'Sep 2021', v: 'Day one', line: 'Work on Surf begins.' },
  { when: 'Dec 2022', v: '1.0', line: 'Beta on phones in December, on the web in January.' },
  { when: 'Jul 2023', v: '2.0', line: 'Rebuilt for mobile web, then desktop in October.', img: '/work/surf-history/v2-2023.webp', cap: 'surfsocial.org, December 2023' },
  { when: 'Nov 2024', v: '3.0', line: 'A new web app, with a waitlist for what came next.', img: '/work/surf-history/v3-2024.webp', cap: 'surfsocial.org, December 2024' },
  { when: 'Apr 2026', v: '4.0 preview', line: 'Rebuilt from scratch on Next.js and Supabase.', img: '/work/surf-history/v4-preview-2026.webp', cap: 'surfplatforms.org, April 2026' },
  { when: 'Sep 2026', v: '4.0', line: 'Feeds, shorts, messaging, live, on web, iOS, and Android.', img: '/work/derived/surf-desktop.webp', cap: 'The live site today' },
]

/**
 * Four versions in five years, as a track you swipe or scroll sideways. The rail fills as you go; on a keyboard the
 * arrow buttons step one version at a time.
 */
export function SurfHistory() {
  const track = useRef<HTMLOListElement>(null)
  const [p, setP] = useState(0)

  useEffect(() => {
    const el = track.current
    if (!el) return
    const on = () => setP(el.scrollLeft / Math.max(1, el.scrollWidth - el.clientWidth))
    on()
    el.addEventListener('scroll', on, { passive: true })
    return () => el.removeEventListener('scroll', on)
  }, [])

  const step = (dir: 1 | -1) => {
    const el = track.current
    const card = el?.querySelector('li')
    if (!el || !card) return
    el.scrollBy({ left: dir * (card.getBoundingClientRect().width + 16), behavior: 'smooth' })
  }

  return (
    <div className="hist">
      <div className="grid-main">
        <div className="col-span-full flex items-end justify-between gap-[24px]">
          <h2 className="oc text-statement" data-rise="">
            Four versions, five years
          </h2>
          <div className="hist-btns" data-reveal="">
            <button type="button" onClick={() => step(-1)} aria-label="Earlier version" disabled={p <= 0.01}>
              ←
            </button>
            <button type="button" onClick={() => step(1)} aria-label="Later version" disabled={p >= 0.99}>
              →
            </button>
          </div>
        </div>
      </div>
      <ol ref={track} className="hist-track" tabIndex={0} aria-label="Surf versions" data-reveal="">
        {VERSIONS.map((x) => (
          <li key={x.when} className="hist-card">
            <span className="hist-when meta">{x.when}</span>
            <span className="hist-v">{x.v}</span>
            <span className="hist-line">{x.line}</span>
            {!x.img && (
              <span className="hist-blank" aria-hidden="true">
                <span className="serif">{x.when.slice(-4)}</span>
              </span>
            )}
            {x.img && (
              <figure className="hist-fig">
                <Image src={x.img} alt={`Surf's site: ${x.cap}`} width={1600} height={1000} quality={75} sizes="(min-width:1024px) 560px, 82vw" />
                <figcaption className="meta">{x.cap}</figcaption>
              </figure>
            )}
          </li>
        ))}
      </ol>
      <div className="grid-main">
        <div className="hist-rail col-span-full" aria-hidden="true">
          <i style={{ transform: `scaleX(${0.12 + p * 0.88})` }} />
        </div>
      </div>
    </div>
  )
}
