import Image from 'next/image'
import { TLink } from './TLink'
import { featuredProjects } from '@/lib/projects-data'
import { PLATES } from '@/lib/media'

/**
 * Every product's live site, on a slow conveyor. The strip is drawn twice so the loop has no seam; the copy is hidden
 * from assistive tech and from the tab order. Hover pauses it; under reduced motion it is a strip you can scroll.
 */
export function Reel() {
  const items = featuredProjects.filter((p) => PLATES[p.id])
  const strip = (copy: boolean) =>
    items.map((p) => {
      const a = PLATES[p.id].stills.a
      return (
        <li key={`${p.id}${copy ? '-c' : ''}`} aria-hidden={copy || undefined}>
          <TLink href={`/portfolio/${p.id}`} className="reel-card" tabIndex={copy ? -1 : undefined}>
            <span className="reel-img">
              <Image src={a.src} alt={copy ? '' : a.alt} width={a.w} height={a.h} quality={75} sizes="(min-width:1024px) 440px, 300px" />
            </span>
            <span className="reel-cap">
              <span>{p.title}</span>
              <span className="meta c3">{p.year}</span>
            </span>
          </TLink>
        </li>
      )
    })
  return (
    <div className="reel-wrap" data-reveal="">
      <ul className="reel-track">
        {strip(false)}
        {strip(true)}
      </ul>
    </div>
  )
}
