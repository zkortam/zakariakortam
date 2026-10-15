'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { TLink } from './TLink'
import { Icon } from './Icon'
import { formatDate, type Post } from '@/content/blog/types'

type Card = Omit<Post, 'html' | 'text' | 'headings'>

/** A post without a cover gets one of the site's soft washes, picked by its address so it never changes. */
const tint = (slug: string) => String([...slug].reduce((n, c) => n + c.charCodeAt(0), 0) % 3)

/** The blog: tall photo cards, each with a frosted panel inset on every side holding the title, date, and length. */
export function BlogIndex({ posts }: { posts: Card[] }) {
  const tags = useMemo(() => [...new Set(posts.flatMap((p) => p.tags))].sort(), [posts])
  const [tag, setTag] = useState<string | null>(null)
  const shown = tag ? posts.filter((p) => p.tags.includes(tag)) : posts

  return (
    <>
      <div className="grid-main work-bar">
        <h1 className="oc col-span-4 text-display md:col-span-4" data-rise="">
          Blog
        </h1>
        {tags.length > 1 && (
          <div className="wb-tools col-span-4 md:col-span-8 md:col-start-5" data-reveal="">
            <div className="seg" role="group" aria-label="Filter by topic">
              <button type="button" aria-pressed={!tag} className={!tag ? 'on' : ''} onClick={() => setTag(null)}>
                All
              </button>
              {tags.map((t) => (
                <button key={t} type="button" aria-pressed={tag === t} className={tag === t ? 'on' : ''} onClick={() => setTag(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!posts.length && (
        <div className="grid-main mt-head">
          <p className="c3 col-span-4 text-read md:col-span-8">The first posts are on the way.</p>
        </div>
      )}

      {shown.length > 0 && (
        <div className="grid-main mt-sec">
          <div className="bc-grid col-span-full">
            {shown.map((p, i) => (
              <TLink key={p.slug} href={`/blog/${p.slug}`} className="bc" data-tint={p.cover ? undefined : tint(p.slug)} data-reveal="">
                {p.cover && (
                  <Image src={p.cover} alt="" fill sizes="(min-width:1280px) 30vw, (min-width:768px) 45vw, 100vw" quality={82} priority={i < 3} className="bc-img" />
                )}
                <span className="bc-glass">
                  <span className="bc-title">{p.title}</span>
                  <span className="bc-meta">
                    <span>
                      <Icon name="calendar" size={16} />
                      <span className="tnum">{formatDate(p.date)}</span>
                    </span>
                    <span>
                      <Icon name="clock" size={16} />
                      <span className="tnum">{p.minutes} min</span>
                    </span>
                  </span>
                </span>
              </TLink>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
