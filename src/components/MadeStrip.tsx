import Image from 'next/image'
import { TLink } from './TLink'

const SHOTS = [
  { id: 'helio', title: 'Helio', src: '/work/hd/helio-desktop.webp' },
  { id: 'surf', title: 'Surf', src: '/work/derived/surf-desktop.webp' },
  { id: 'spice-plus-plus', title: 'SPICE++', src: '/work/hd/spice-plus-plus-desktop.webp' },
  { id: 'surf-messenger', title: 'Surf Messenger', src: '/work/hd/surf-messenger-desktop.webp' },
  { id: 'rtl-plus-plus', title: 'RTL++', src: '/work/hd/rtlpp-desktop.webp' },
  { id: 'airofind', title: 'AiroFind', src: '/work/hd/airofind-desktop.webp' },
]

/** A row of the real products that glides sideways as the page scrolls (CSS scroll-driven; still otherwise). */
export function MadeStrip() {
  return (
    <div className="made" aria-label="Things I’ve made">
      <div className="made-track">
        {SHOTS.map((s) => (
          <TLink key={s.id} href={`/portfolio/${s.id}`} className="made-item">
            <span className="made-shot">
              <Image src={s.src} alt={`${s.title} home page`} fill sizes="(min-width:1024px) 34vw, 78vw" quality={75} />
            </span>
            <span className="made-name">{s.title}</span>
          </TLink>
        ))}
      </div>
    </div>
  )
}
