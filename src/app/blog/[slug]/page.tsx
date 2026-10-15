import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Footer } from '@/components/Footer'
import { TLink } from '@/components/TLink'
import { Icon } from '@/components/Icon'
import { NextRow } from '@/components/IndexRows'
import { POSTS } from '@/content/blog/posts.generated'
import { formatDate } from '@/content/blog/types'
import { pageMeta } from '@/lib/seo'

type Params = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const p = POSTS.find((x) => x.slug === slug)
  if (!p) return {}
  return pageMeta({
    path: `/blog/${p.slug}`,
    title: p.title,
    ogTitle: `${p.title}, by Zakaria Kortam`,
    description: p.summary || p.title,
    type: 'article',
    ...(p.cover ? { image: p.cover, imageAlt: p.title } : {}),
  })
}

export default async function PostPage({ params }: Params) {
  const { slug } = await params
  const i = POSTS.findIndex((x) => x.slug === slug)
  if (i < 0) notFound()
  const p = POSTS[i]
  const next = POSTS.length > 1 ? POSTS[(i + 1) % POSTS.length] : null
  const toc = p.headings.length >= 3
  return (
    <>
      <div className="read-progress" aria-hidden="true" />
      <main id="main" tabIndex={-1}>
        <article className="paper pt-page pb-sec" data-tone="light">
          <div className="grid-main">
            <header className="col-span-4 md:col-span-10 lg:col-span-9">
              <TLink href="/blog" className="post-back c3 text-body" data-reveal="">
                <Icon name="arrow-left" size="1em" strokeWidth={2.25} className="ar" />
                Blog
              </TLink>
              <h1 className="oc mt-[24px] text-statement" data-rise="">
                {p.title}
              </h1>
              {p.summary && (
                <p className="p-lead c3 mt-[20px]" data-reveal="">
                  {p.summary}
                </p>
              )}
              <p className="post-meta c3 tnum text-body" data-reveal="">
                {formatDate(p.date)}
                <span>{p.minutes} min read</span>
                {p.tags.length > 0 && <span>{p.tags.join(', ')}</span>}
              </p>
            </header>
          </div>
          {p.cover && (
            <div className="grid-main mt-head">
              <figure className="post-cover col-span-full" data-reveal="">
                <Image src={p.cover} alt="" fill sizes="100vw" quality={90} priority />
              </figure>
            </div>
          )}
          <div className="grid-main mt-head">
            <div className={`prose col-span-4 md:col-span-8 ${toc ? 'lg:col-span-7' : 'lg:col-span-7 lg:col-start-3'}`} dangerouslySetInnerHTML={{ __html: p.html }} />
            {toc && (
              <nav className="post-toc hidden lg:col-span-3 lg:col-start-10 lg:block" aria-label="Contents">
                <p className="c3 text-body">Contents</p>
                <ol>
                  {p.headings.map((h) => (
                    <li key={h.id}>
                      <a href={`#${h.id}`}>{h.text}</a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
          </div>
          {next && (
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
