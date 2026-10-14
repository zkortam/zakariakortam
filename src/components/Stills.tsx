import Image from 'next/image'
import type { PlateSpec } from '@/lib/media'

export function Stills({ spec }: { spec: PlateSpec }) {
  const { a, b1, b2, b2Phone } = spec.stills
  return (
    <section className="paper pb-sec" data-tone="light">
      <div className="grid-main items-start">
        <div className="col-span-4 md:col-span-12 3xl:col-span-10 3xl:col-start-2" data-media="">
          <Image src={a.src} alt={a.alt} width={a.w} height={a.h} quality={82} sizes="(min-width:1680px) 80vw, (min-width:768px) 95vw, 100vw" className="block h-auto w-full" />
        </div>
        <div className="col-span-4 mt-[64px] md:mt-[96px]" data-media="">
          <Image src={b1.src} alt={b1.alt} width={b1.w} height={b1.h} quality={82} sizes="(min-width:768px) 31vw, 100vw" className="block h-auto w-full" />
        </div>
        {b2Phone ? (
          <div
            className="col-span-4 mt-[20px] p-[48px] md:col-start-7 md:mt-[96px]"
            style={{ background: spec.ground, ['--d' as string]: '80ms' }}
            data-media=""
          >
            <Image src={b2.src} alt={b2.alt} width={b2.w} height={b2.h} quality={82} sizes="(min-width:768px) 300px, 100vw" className="block h-auto w-full" />
          </div>
        ) : (
          <div className="col-span-4 mt-[20px] md:col-span-8 md:col-start-5 md:mt-[96px]" style={{ ['--d' as string]: '80ms' }} data-media="">
            <Image src={b2.src} alt={b2.alt} width={b2.w} height={b2.h} quality={82} sizes="(min-width:768px) 63vw, 100vw" className={`block h-auto w-full ${b2.src.includes('helio-app') ? 'card' : ''}`} />
          </div>
        )}
      </div>
    </section>
  )
}
