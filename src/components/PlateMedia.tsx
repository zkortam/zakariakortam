import Image, { getImageProps } from 'next/image'
import type { CSSProperties } from 'react'
import { Parallax } from './Parallax'
import type { PlateSpec } from '@/lib/media'

const PHONE_SIZES = '(min-width:1024px) 400px, 300px'
const CARD_SIZES = '(min-width:1024px) 71vw, 100vw'
const RESULTS_SIZES = '(min-width:1024px) 560px, 100vw'
const BOARD_SIZES = '(min-width:1024px) 120vw, 180vw'

export const HERO_SIZES: Record<string, string> = {
  helio: CARD_SIZES,
  surf: PHONE_SIZES,
  'surf-messenger': PHONE_SIZES,
  'spice-plus-plus': BOARD_SIZES,
  airofind: RESULTS_SIZES,
}

function Ambient({ spec, className = '', style }: { spec: PlateSpec; className?: string; style?: CSSProperties }) {
  if (!spec.ambient) return null
  return (
    <div aria-hidden="true" data-ambient="" className={`amb ${className}`} style={style}>
      <i style={{ backgroundImage: `url(${spec.ambient.src})`, ['--dur' as string]: `${spec.ambient.dur}s` }} />
    </div>
  )
}

/** Desktop (>= 1024) media layer: ground plus the composition on the plate grid. Also the FLIP source. */
export function PlateMediaLayer({ spec }: { spec: PlateSpec }) {
  const { composition: c, primary: img } = spec
  return (
    <div data-plate-media="" data-flip-source={spec.id}>
      {c === 'bleed' && (
        <>
          <div className="pm-desk m3-board absolute inset-0" data-open="">
            <div className="open-img" data-flip-img="" data-flip-fit="cover">
              <Image src={img.src} alt={img.alt} fill sizes={BOARD_SIZES} quality={75} className="object-cover" style={{ objectPosition: '55% 50%' }} />
            </div>
          </div>
          <div className="pm-desk scrim" aria-hidden="true" />
        </>
      )}
      {c === 'results' && spec.earth && (
        <div className="pm-desk earth m3-earth" data-open="" aria-hidden="true">
          <div className="open-img">
            <Image src={spec.earth.desktop.src} alt="" fill sizes="100vw" quality={75} className="object-cover" />
          </div>
        </div>
      )}
      {c !== 'bleed' && (
        <div className="pm-desk grid-main pm-grid">
          {(c === 'phone-right' || c === 'phone-left') && (
            <div className={`relative row-start-1 row-end-4 ${c === 'phone-right' ? 'col-start-7 col-end-12' : 'col-start-2 col-end-7'}`} aria-hidden="true">
              <Ambient spec={spec} />
            </div>
          )}
          {c === 'card' && (
            <div className="col-start-4 col-end-13 row-start-2 flex items-end justify-end" style={{ containerType: 'size' }}>
              <div className="obj-hover">
                <div data-enter="">
                  <div className="card card-desk" data-flip-img="" data-flip-fit="width">
                    <Image src={img.src} alt={img.alt} width={img.w} height={img.h} sizes={CARD_SIZES} quality={82} />
                  </div>
                </div>
              </div>
            </div>
          )}
          {(c === 'phone-right' || c === 'phone-left') && (
            <div
              className={`row-start-2 row-end-4 flex items-start justify-center ${c === 'phone-right' ? 'col-start-7 col-end-12' : 'col-start-2 col-end-7'}`}
              style={{ containerType: 'size' }}
              data-free=""
            >
              <div className="obj-hover">
                <Parallax>
                  <div className="persp">
                    <div data-enter="phone">
                      <div className="phone-shadow phone-desk" data-flip-img="" data-flip-fit="width">
                        <Image src={img.src} alt={img.alt} width={img.w} height={img.h} sizes={PHONE_SIZES} quality={82} />
                      </div>
                    </div>
                  </div>
                </Parallax>
              </div>
            </div>
          )}
          {c === 'results' && (
            <div className="col-start-4 col-end-10 row-start-2 row-end-4 flex items-start justify-center" data-free="">
              <div className="obj-hover flex w-full justify-center">
                <div data-enter="" className="results" data-flip-img="" data-flip-fit="width">
                  <Image src={img.src} alt={img.alt} width={img.w} height={img.h} sizes={RESULTS_SIZES} quality={82} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Flow (< 1024) composition rendered inside the plate stage. */
export function PlateMediaFlow({ spec }: { spec: PlateSpec }) {
  const { composition: c, primary: img } = spec
  if (c === 'card') {
    const m = spec.mobile ?? img
    const desk = getImageProps({ src: img.src, alt: img.alt, width: img.w, height: img.h, sizes: '100vw', quality: 82 }).props
    const mob = getImageProps({ src: m.src, alt: m.alt, width: m.w, height: m.h, sizes: '100vw', quality: 82 }).props
    return (
      <div className="pm-flow flow-card">
        <div className="grid-main">
          <div className="col-span-4 md:col-span-12">
            <div className="obj-hover">
              <div data-enter="">
                <div className="card card-m" data-flip-img="" data-flip-fit="width">
                  <picture>
                    <source media="(min-width:768px)" srcSet={desk.srcSet} sizes="100vw" width={img.w} height={img.h} />
                    <img {...mob} alt={m.alt} loading="lazy" decoding="async" />
                  </picture>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  if (c === 'phone-right' || c === 'phone-left') {
    return (
      <div className="pm-flow phone-flow">
        <Ambient spec={spec} style={{ top: '50%' }} />
        <div className="phone-box">
          <div className="obj-hover">
            <Parallax>
              <div className="persp">
                <div data-enter="phone">
                  <div className="phone-shadow" data-flip-img="" data-flip-fit="width">
                    <Image src={img.src} alt={img.alt} width={img.w} height={img.h} sizes={PHONE_SIZES} quality={82} />
                  </div>
                </div>
              </div>
            </Parallax>
          </div>
        </div>
      </div>
    )
  }
  if (c === 'bleed') {
    return (
      <div className="pm-flow flow-bleed">
        <div className="board-band" data-flip-img="" data-flip-fit="width">
          <Image src={img.src} alt={img.alt} width={img.w} height={img.h} sizes="180vw" quality={75} />
        </div>
      </div>
    )
  }
  return (
    <div className="pm-flow flow-results">
      {spec.earth && (
        <div className="earth-m m3-earth" data-open="" aria-hidden="true">
          <div className="open-img">
            <Image src={spec.earth.mobile.src} alt="" width={spec.earth.mobile.w} height={spec.earth.mobile.h} sizes="100vw" quality={75} className="h-full w-full object-cover" />
          </div>
        </div>
      )}
      <div className="grid-main relative">
        <div className="col-span-4 flex justify-center md:col-span-12">
          <div className="obj-hover flex w-full justify-center">
            <div data-enter="" className="results results-flow" data-flip-img="" data-flip-fit="width">
              <Image src={img.src} alt={img.alt} width={img.w} height={img.h} sizes={RESULTS_SIZES} quality={82} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
