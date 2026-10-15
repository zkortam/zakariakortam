'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { TLink } from './TLink'
import { Icon } from './Icon'
import { formatDate, type Post } from '@/content/blog/types'

type Card = Omit<Post, 'html' | 'text' | 'headings'>

/** A post without a cover gets one of the site's soft washes, picked by its address so it never changes. */
const tint = (slug: string) => String([...slug].reduce((n, c) => n + c.charCodeAt(0), 0) % 3)

function Meta({ p }: { p: Card }) {
  return (
    <span className="bl-meta tnum">
      {formatDate(p.date)}
      <span>{p.minutes} min read</span>
    </span>
  )
}

/** The blog's index: the newest post large, the rest as cards; topics filter when posts have tags. */
export function BlogIndex({ posts }: { posts: Card[] }) {
  const tags = useMemo(() => [...new Set(posts.flatMap((p) => p.tags))].sort(), [posts])
  const [tag, setTag] = useState<string | null>(null)
  const shown = tag ? posts.filter((p) => p.tags.includes(tag)) : posts
  const [lead, ...rest] = shown

  return (
    <>
      <div className="grid-main work-bar">
        <h1 className="oc col-span-4 text-display md:col-span-4" data-rise="">
          Blog
        </h1>
        {tags.length > 0 && (
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
          <p className="c3 col-span-4 text-read md:col-span-8" data-reveal="">
            The first posts are on the way.
          </p>
        </div>
      )}

      {lead && (
        <div className="grid-main mt-sec">
          <TLink href={`/blog/${lead.slug}`} className={`bl-lead col-span-full ${lead.cover ? '' : 'no-cover'}`} data-reveal="">
            {lead.cover && (
              <span className="bl-cover">
                <Image src={lead.cover} alt="" fill sizes="(min-width:1024px) 60vw, 100vw" quality={90} priority />
              </span>
            )}
            <span className="bl-lead-txt">
              <Meta p={lead} />
              <span className="bl-lead-title">{lead.title}</span>
              {lead.summary && <span className="bl-sum">{lead.summary}</span>}
              <span className="bl-read">
                Read
                <Icon name="arrow-right" size="1em" strokeWidth={2.25} className="ar" />
              </span>
            </span>
          </TLink>
        </div>
      )}

      {rest.length > 0 && (
        <div className="grid-main mt-sec">
          <div className="bl-grid col-span-full">
            {rest.map((p) => (
              <TLink key={p.slug} href={`/blog/${p.slug}`} className="bl-card" data-reveal="">
                <span className="bl-cover" data-tint={p.cover ? undefined : tint(p.slug)}>
                  {p.cover && <Image src={p.cover} alt="" fill sizes="(min-width:1280px) 30vw, (min-width:768px) 45vw, 100vw" quality={82} />}
                </span>
                <Meta p={p} />
                <span className="bl-title">{p.title}</span>
                {p.summary && <span className="bl-sum">{p.summary}</span>}
              </TLink>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
