import Image from 'next/image'
import { TLink } from './TLink'
import { HERO_SIZES } from './PlateMedia'
import type { Project } from '@/lib/projects-data'
import { PLATES } from '@/lib/media'

const TILE_SIZES = '(min-width:1024px) 31vw, (min-width:768px) 48vw, 100vw'

export function ProjectTile({ project, index }: { project: Project; index: number }) {
  const spec = PLATES[project.id]
  if (!spec) return null
  const img = spec.primary
  const hero = HERO_SIZES[project.id]
  const c = spec.composition
  return (
    <TLink
      href={`/portfolio/${project.id}`}
      flip="tile"
      flipId={project.id}
      className="tile u-group col-span-4 block md:col-span-6 lg:col-span-4"
      data-media=""
      style={{ ['--d' as string]: `${(index % 3) * 80}ms` }}
    >
      <span className="flex items-baseline justify-between gap-[12px]">
        <span className="text-read">
          <span className="u-box">
            {project.title}
            <span aria-hidden="true" className="u-line" />
          </span>
          <span aria-hidden="true" className="tarr ml-[8px]">
            ↗
          </span>
        </span>
        <span className="c3 tnum whitespace-nowrap text-body" data-align="end">
          {project.year}
        </span>
      </span>
      <span className="tile-media mt-[14px] block" style={{ background: spec.ground }}>
        {c === 'card' && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className={`card tile-card block ${project.id === 'helio' ? '' : 'card-plain'}`} style={{ width: project.id === 'helio' ? '92%' : '84%' }} data-flip-img="" data-flip-fit="width">
              <Image src={img.src} alt={img.alt} width={img.w} height={img.h} sizes={TILE_SIZES} quality={82} data-hero-sizes={hero} />
            </span>
          </span>
        )}
        {(c === 'phone-right' || c === 'phone-left') && (
          <>
            {spec.ambient && (
              <span aria-hidden="true" className="amb block" style={{ width: '170%', height: '170%', opacity: 0.22, top: '55%' }}>
                <i style={{ backgroundImage: `url(${spec.ambient.src})`, animation: 'none' }} />
              </span>
            )}
            <span className="absolute left-0 right-0 top-[8%] mx-auto block h-[96%]" style={{ aspectRatio: `${img.w} / ${img.h}` }}>
              <span className="phone-shadow block" data-flip-img="" data-flip-fit="width">
                <Image src={img.src} alt={img.alt} width={img.w} height={img.h} sizes={TILE_SIZES} quality={82} className="block h-auto w-full" data-hero-sizes={hero} />
              </span>
            </span>
          </>
        )}
        {c === 'bleed' && (
          <span className="absolute inset-0 block" data-flip-img="" data-flip-fit="cover">
            <Image src={img.src} alt={img.alt} fill sizes={TILE_SIZES} quality={75} className="object-cover" style={{ objectPosition: '58% 50%' }} data-hero-sizes={hero} />
          </span>
        )}
        {c === 'results' && (
          <span className="absolute left-0 right-0 top-[6%] block">
            <span className="tile-results block" data-flip-img="" data-flip-fit="width">
              <Image src={img.src} alt={img.alt} width={img.w} height={img.h} sizes={TILE_SIZES} quality={82} className="block h-auto w-full" data-hero-sizes={hero} />
            </span>
          </span>
        )}
      </span>
    </TLink>
  )
}
