'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ProjectTile } from './ProjectTile'
import { ExperienceList } from './ExperienceList'
import { IndexRows } from './IndexRows'
import { projects, type Category, type Project } from '@/lib/projects-data'
import { Icon } from './Icon'

const FILTERS: [string, Category | 'All'][] = [
  ['All', 'All'],
  ['AI', 'AI'],
  ['Apps', 'Consumer apps'],
  ['Tools', 'Engineering tools'],
  ['Hardware', 'Hardware'],
]

/**
 * The Work page as something a stranger can browse: search by name, idea or technology, or pick a
 * category. Keyword matching is instant; when the meaning-based search endpoint is available its
 * ranking is blended in, so "tutoring" finds Helio and "chip design" finds RTL++.
 */

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}+#. ]/gu, ' ')

function haystack(p: Project) {
  return {
    title: norm(`${p.title} ${p.org ?? ''}`),
    body: norm([p.line, p.overview, p.problem, p.approach, p.role, ...(p.results ?? []), ...p.stack, ...(p.tags ?? [])].filter(Boolean).join(' ')),
  }
}

function keywordScore(p: Project, terms: string[]) {
  const h = haystack(p)
  let score = 0
  for (const t of terms) {
    if (h.title.includes(t)) score += 3
    else if (h.body.includes(t)) score += 1
    else return 0 // every term must appear somewhere
  }
  return score
}

export function WorkIndex() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category | 'All'>('All')
  const [semantic, setSemantic] = useState<Record<string, number> | null>(null)
  const results = useRef<HTMLDivElement>(null)
  const touched = q.trim() !== '' || cat !== 'All'

  // Meaning-based ranking, if the endpoint exists. Fails quietly to keyword search.
  useEffect(() => {
    const query = q.trim()
    if (query.length < 3) {
      setSemantic(null)
      return
    }
    const ctl = new AbortController()
    const t = setTimeout(() => {
      fetch('/api/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q: query.slice(0, 200) }),
        signal: ctl.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { results?: { id: string; score: number }[] } | null) => {
          if (!d?.results) return
          setSemantic(Object.fromEntries(d.results.map((r) => [r.id, r.score])))
        })
        .catch(() => undefined)
    }, 320)
    return () => {
      clearTimeout(t)
      ctl.abort()
    }
  }, [q])

  const shown = useMemo(() => {
    const terms = norm(q).split(/\s+/).filter(Boolean)
    const inCat = projects.filter((p) => cat === 'All' || p.tags?.includes(cat))
    if (!terms.length) return inCat
    // Semantic hits count when they are close to the best match for this query.
    const top = semantic ? Math.max(0, ...Object.values(semantic)) : 0
    const bar = Math.max(0.3, top - 0.05)
    const scored = inCat
      .map((p) => {
        const k = keywordScore(p, terms)
        const s = semantic?.[p.id] ?? 0
        const score = k * 0.2 + (s >= bar ? s * 2 : 0)
        return { p, score }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
    return scored.map((x) => x.p)
  }, [q, cat, semantic])

  const featured = shown.filter((p) => p.kind === 'project' && p.featured)
  const roles = shown.filter((p) => p.kind === 'work')
  const more = shown.filter((p) => p.kind === 'project' && !p.featured)


  // Results that mount after a filter change play the site's entrance themselves.
  useEffect(() => {
    if (!touched) return
    const els = results.current?.querySelectorAll<HTMLElement>('[data-reveal]:not(.in),[data-media]:not(.in)')
    if (!els?.length) return
    const raf = requestAnimationFrame(() => els.forEach((el, i) => {
      el.style.setProperty('--d', `${Math.min(i, 8) * 30}ms`)
      el.classList.add('in')
    }))
    return () => cancelAnimationFrame(raf)
  }, [shown, touched])

  return (
    <>
      <div className="grid-main mt-sec">
        <div className="wi-search col-span-4 md:col-span-6" data-reveal="">
          <Icon name="search" className="wi-glass" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or idea"
            aria-label="Search projects"
            className="wi-input text-read"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
          />
          {q && (
            <button type="button" className="wi-clear text-body" onClick={() => setQ('')} aria-label="Clear search">
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
        <div className="wi-cats col-span-4 mt-[20px] md:col-span-6 md:col-start-7 md:mt-0" role="group" aria-label="Filter by category" data-reveal="">
          {FILTERS.map(([label, c]) => (
            <button
              key={label}
              type="button"
              aria-pressed={cat === c}
              onClick={() => setCat(c)}
              className={`wi-cat text-body ${cat === c ? 'on' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div ref={results} aria-live="polite">
        {shown.length === 0 && (
          <div className="grid-main mt-sec">
            <p className="col-span-4 text-read md:col-span-8">
              Nothing matches “{q.trim()}”{cat !== 'All' ? ` in ${cat}` : ''}.{' '}
              <button type="button" className="wi-reset" onClick={() => { setQ(''); setCat('All') }}>
                Show everything
              </button>
            </p>
          </div>
        )}

        {featured.length > 0 && (
          <div className="grid-main mt-sec gap-y-[64px] md:gap-y-[80px] lg:gap-y-[96px]">
            {featured.map((p, i) => (
              <ProjectTile key={p.id} project={p} index={i} />
            ))}
          </div>
        )}

        {roles.length > 0 && (
          <div className="grid-main mt-big">
            <h2 className="oc col-span-4 text-statement md:col-span-12">Roles</h2>
            <div className="mt-head col-span-full grid grid-cols-subgrid">
              <ExperienceList items={roles} />
            </div>
          </div>
        )}

        {more.length > 0 && (
          <div className="grid-main mt-sec">
            <h2 className="oc col-span-4 text-statement md:col-span-12">{touched ? 'More projects' : 'Earlier projects'}</h2>
            <div className="mt-head col-span-full grid grid-cols-subgrid">
              <IndexRows items={more} />
            </div>
          </div>
        )}
      </div>
    </>
  )
}
