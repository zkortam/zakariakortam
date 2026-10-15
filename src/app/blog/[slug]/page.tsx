import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Footer } from '@/components/Footer'
import { NextRow } from '@/components/IndexRows'
import { formatDate, published } from '@/content/blog/posts'
import { postHtml, readingMinutes } from '@/lib/blog'
import { pageMeta } from '@/lib/seo'

type Params = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return published.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const p = published.find((x) => x.slug === slug)
  if (!p) return {}
  return pageMeta({ path: `/blog/${p.slug}`, title: p.title, ogTitle: `${p.title}, by Zakaria Kortam`, description: p.summary, type: 'article' })
}

export default async function PostPage({ params }: Params) {
  const { slug } = await params
  const i = published.findIndex((x) => x.slug === slug)
  if (i < 0) notFound()
  const p = published[i]
  const next = published[(i + 1) % published.length]
  return (
    <>
      <main id="main" tabIndex={-1}>
        <article className="paper pt-page pb-sec" data-tone="light">
          <div className="grid-main">
            <header className="col-span-4 md:col-span-10 lg:col-span-8">
              <p className="c3 tnum text-body" data-reveal="">
                {formatDate(p.date)} · {readingMinutes(p.slug)} min read
              </p>
              <h1 className="oc mt-[16px] text-statement" data-rise="">
                {p.title}
              </h1>
            </header>
          </div>
          <div className="grid-main mt-head">
            <div className="prose col-span-4 md:col-span-8 lg:col-span-7" dangerouslySetInnerHTML={{ __html: postHtml(p.slug) }} />
          </div>
          {published.length > 1 && (
            <div className="grid-main mt-sec">
              <NextRow href={`/blog/${next.slug}`} title={next.title} />
            </div>
          )}
        </article>
      </main>
      <Footer />
    </>
  )
}
