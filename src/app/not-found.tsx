import type { Metadata } from 'next'
import { ULink } from '@/components/ULink'
import { COPY } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Not found',
  robots: { index: false, follow: true },
  alternates: { canonical: null },
}

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1}>
      <section className="nf tone-dark" data-tone="dark">
        <div aria-hidden="true" className="light light-rose" style={{ width: '110vmax', height: '110vmax', left: '50%', top: '40%' }} />
        <div className="grid-main relative">
          <h1 className="oc col-span-4 text-display md:col-span-6" data-rise="">
            Not found
          </h1>
          <div className="nf-side cap-md col-span-4 mt-[24px] text-read md:col-span-5 md:col-start-7 md:mt-0">
            <p data-reveal="" style={{ color: 'var(--bone-92)' }}>
              {COPY.notFoundLine}
            </p>
            <p className="mt-[24px] flex gap-[28px]" data-reveal="">
              <ULink href="/">Back home</ULink>
              <ULink href="/portfolio">See the work</ULink>
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
