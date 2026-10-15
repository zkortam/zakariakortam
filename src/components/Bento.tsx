import Image from 'next/image'
import type { ReactNode } from 'react'
import { TLink } from './TLink'
import { LoopVideo } from './LoopVideo'
import { PhoneWithLoop } from './PlateMedia'
import { PLATES } from '@/lib/media'
import { projects } from '@/lib/projects-data'

/*
 * The home page's index of the work: one rounded tile per product, each in its own colours with the real product
 * in it (the same loops and captures as the project pages), plus the body of work in three numbers. Every tile
 * opens its project.
 */

const FIGURES = [
  { value: '1.46M', label: 'lines of TypeScript, Rust, and Python' },
  { value: '28,295', label: 'tests' },
  { value: '8,580', label: 'commits, all in 2026' },
]

/** Tiles sit on the paper: a product whose plate is pale gets its own dark app colour here, so it reads as a card. */
const TILE_GROUND: Record<string, { ground: string; tone: 'dark' | 'light' }> = {
  'rtl-plus-plus': { ground: 'radial-gradient(120% 90% at 80% 0%, #10203A 0%, #0B0C10 60%)', tone: 'dark' },
}

export function Tile({ id, className, children, media, year }: { id: string; className: string; children?: ReactNode; media: ReactNode; year?: boolean }) {
  const p = projects.find((x) => x.id === id)!
  const spec = PLATES[id]
  const g = TILE_GROUND[id] ?? { ground: spec.ground, tone: spec.tone }
  return (
    <TLink href={`/portfolio/${id}`} className={`bt ${className}`} data-tone={g.tone} style={{ ['--ground' as string]: g.ground }}>
      <span className="bt-head">
        <span className="bt-top">
          <span className="bt-title">{p.title}</span>
          {year && <span className="bt-year tnum">{p.year}</span>}
        </span>
        <span className="bt-line">{p.line}</span>
        {children}
      </span>
      <span className="bt-media" aria-hidden="true">
        {media}
      </span>
    </TLink>
  )
}

/** A wide screen framed for a narrow tile: zoomed in on the part worth reading. */
function Crop({ src, pos, zoom }: { src: string; pos: string; zoom: number }) {
  return (
    <span className="bt-cropbox" style={{ ['--pos' as string]: pos, ['--zoom' as string]: zoom }}>
      <Image src={src} alt="" fill sizes="(min-width:1280px) 50vw, (min-width:768px) 80vw, 160vw" quality={82} />
    </span>
  )
}

/** The real picture for each product's tile. */
export function tileMedia(id: string, square = false): { cls: string; media: ReactNode } {
  const spec = PLATES[id]
  if (id === 'helio')
    return {
      cls: 'bt-helio',
      media: <span className="bt-card">{spec.video && <LoopVideo clip={square && spec.video.mobile ? spec.video.mobile : spec.video} mobile={spec.video.mobile} id="tile-helio" />}</span>,
    }
  if (id === 'surf' || id === 'surf-messenger') return { cls: 'bt-phone', media: <PhoneWithLoop spec={spec} desk={false} /> }
  if (id === 'spice-plus-plus')
    return square
      ? { cls: 'bt-crop', media: <Crop src="/work/hd/spice-plus-plus-app.webp" pos="74% 38%" zoom={1.9} /> }
      : { cls: 'bt-shot', media: <Image src="/work/hd/spice-plus-plus-app.webp" alt="" width={3200} height={2000} sizes="(min-width:1024px) 60vw, 100vw" quality={82} /> }
  if (id === 'rtl-plus-plus')
    return square
      ? { cls: 'bt-crop', media: <Crop src="/work/hd/rtlpp-app.webp" pos="78% 30%" zoom={1.8} /> }
      : { cls: 'bt-shot', media: <Image src="/work/hd/rtlpp-app.webp" alt="" width={2304} height={1612} sizes="(min-width:1024px) 55vw, 100vw" quality={82} /> }
  return { cls: 'bt-airo', media: <Image src="/work/derived/airofind-results.webp" alt="" width={1277} height={1760} sizes="(min-width:1024px) 30vw, 80vw" quality={82} /> }
}

export function Bento() {
  const helio = PLATES.helio
  return (
    <div className="bento col-span-full">
      <Tile
        id="helio"
        className="bt-helio"
        media={
          <span className="bt-card">
            {helio.video && <LoopVideo clip={helio.video} mobile={helio.video.mobile} id="bento-helio" />}
          </span>
        }
      />
      <Tile id="surf" className="bt-surf bt-phone" media={<PhoneWithLoop spec={PLATES.surf} desk={false} />} />
      <div className="bt bt-stats" data-tone="light">
        {FIGURES.map((f) => (
          <p key={f.label}>
            <span className="bt-num tnum">{f.value}</span>
            <span className="bt-lab">{f.label}</span>
          </p>
        ))}
      </div>
      <Tile
        id="spice-plus-plus"
        className="bt-spice bt-shot"
        media={<Image src="/work/hd/spice-plus-plus-app.webp" alt="" width={3200} height={2000} sizes="(min-width:1024px) 60vw, 100vw" quality={82} />}
      />
      <Tile id="surf-messenger" className="bt-messenger bt-phone" media={<PhoneWithLoop spec={PLATES["surf-messenger"]} desk={false} />} />
      <Tile
        id="rtl-plus-plus"
        className="bt-rtl bt-shot"
        media={<Image src="/work/hd/rtlpp-app.webp" alt="" width={2304} height={1612} sizes="(min-width:1024px) 55vw, 100vw" quality={82} />}
      />
      <Tile
        id="airofind"
        className="bt-airo"
        media={<Image src="/work/derived/airofind-results.webp" alt="" width={1277} height={1760} sizes="(min-width:1024px) 34vw, 80vw" quality={82} />}
      />
    </div>
  )
}
