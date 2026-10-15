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

export function Tile({ id, className, children, media, year }: { id: string; className: string; children?: ReactNode; media: ReactNode; year?: boolean }) {
  const p = projects.find((x) => x.id === id)!
  const spec = PLATES[id]
  return (
    <TLink href={`/portfolio/${id}`} className={`bt ${className}`} data-tone={spec.tone} style={{ ['--ground' as string]: spec.ground }}>
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
    return { cls: 'bt-shot', media: <Image src="/work/hd/spice-plus-plus-app.webp" alt="" width={3200} height={2000} sizes="(min-width:1024px) 40vw, 100vw" quality={82} /> }
  if (id === 'rtl-plus-plus')
    return { cls: 'bt-shot', media: <Image src="/work/hd/rtlpp-app.webp" alt="" width={2304} height={1612} sizes="(min-width:1024px) 40vw, 100vw" quality={82} /> }
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
