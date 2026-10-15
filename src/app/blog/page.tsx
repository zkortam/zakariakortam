import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Footer } from '@/components/Footer'
import { TLink } from '@/components/TLink'
import { formatDate, published } from '@/content/blog/posts'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta({
  path: '/blog',
  title: 'Blog',
  ogTitle: 'Blog by Zakaria Kortam',
  description: 'Writing by Zakaria Kortam on product, building, and AI.',
})

export default function BlogPage() {
  if (!published.length) notFound()
  return (
    <>
      <main id="main" tabIndex={-1}>
        <section className="paper pt-page pb-sec" data-tone="light">
          <div className="grid-main">
            <h1 className="oc col-span-4 text-display md:col-span-12" data-rise="">
              Blog
            </h1>
          </div>
          <div className="grid-main mt-head">
            <ul className="rows col-span-full grid grid-cols-subgrid">
              {published.map((p) => (
                <li key={p.slug} className="row col-span-full grid grid-cols-subgrid">
                  <TLink href={`/blog/${p.slug}`} className="u-group col-span-full grid grid-cols-subgrid items-baseline py-[20px] md:py-[28px]">
                    <span className="col-span-4 text-read md:col-span-6" data-reveal="">
                      <span className="u-box">
                        {p.title}
                        <span aria-hidden="true" className="u-line" />
                      </span>
                    </span>
                    <span className="c3 col-span-4 mt-[6px] text-body md:col-span-4 md:col-start-7 md:mt-0" data-reveal="">
                      {p.summary}
                    </span>
                    <span className="c3 tnum col-span-4 mt-[4px] text-body md:col-span-2 md:col-start-11 md:mt-0 md:text-right" data-reveal="" data-align="end">
                      {formatDate(p.date)}
                    </span>
                  </TLink>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
