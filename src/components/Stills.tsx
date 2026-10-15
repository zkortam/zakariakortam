import Image from 'next/image'
import type { PlateSpec } from '@/lib/media'

export function Stills({ spec }: { spec: PlateSpec }) {
  const { a } = spec.stills
  return (
    <section className="paper pb-sec" data-tone="light">
      <div className="grid-main items-start">
        <div className="col-span-4 md:col-span-12 3xl:col-span-10 3xl:col-start-2" data-media="">
          <Image src={a.src} alt={a.alt} width={a.w} height={a.h} quality={82} sizes="(min-width:1680px) 80vw, (min-width:768px) 95vw, 100vw" className="block h-auto w-full" />
        </div>
      </div>
    </section>
  )
}
