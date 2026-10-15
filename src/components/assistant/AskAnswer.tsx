'use client'

import { Fragment, type ReactNode } from 'react'
import { isSitePath } from '@/lib/ask/links'
import { EMAIL } from '@/lib/site'
import { projects } from '@/lib/projects-data'

const PROJECT = /^\/portfolio\/([a-z0-9-]+)\/?$/
const projectFor = (href: string) => {
  const id = href.match(PROJECT)?.[1]
  return id ? projects.find((p) => p.id === id) : undefined
}

/** Turns the plain-text email address into a mailto link. */
function mail(s: string, key: string): ReactNode[] {
  const parts = s.split(EMAIL)
  return parts.flatMap((p, i) =>
    i === 0
      ? [p]
      : [
          <a key={`${key}-m${i}`} href={`mailto:${EMAIL}`} className="ask-link">
            {EMAIL}
          </a>,
          p,
        ],
  )
}

/**
 * Renders the small markdown subset the assistant writes: paragraphs, "- " lists,
 * and [text](href) links. Site links navigate with the page transition; links to
 * pages that do not exist render as plain text; external links open a new tab.
 * A final line made only of links becomes the related row: project pages render as
 * small cards (title and one line), other pages as quiet chips.
 */
export function AskAnswer({ text, onNavigate }: { text: string; onNavigate: (href: string) => void }) {
  const blocks = text
    // A bare [/path] from the model becomes a proper link with the page's name.
    .replace(/\[(\/[a-z0-9/-]*)\](?!\()/g, (_, p: string) => `[${projectFor(p)?.title ?? 'Open'}](${p})`)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)

  const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g
  const onlyLinks = (b: string) =>
    /\[[^\]]+\]\([^)\s]+\)/.test(b) &&
    b
      .replace(LINK, ' ')
      .replace(/\b(see|also|related|more|read|links?|pages?|and|or)\b/gi, ' ')
      .replace(/[\s,.;:|·•-]+/g, '') === ''

  let related: { label: string; href: string }[] = []
  const last = blocks[blocks.length - 1]
  if (last) {
    const lines = last.split('\n')
    const tail = lines[lines.length - 1]
    if (onlyLinks(tail) && (lines.length > 1 || blocks.length > 1)) {
      related = Array.from(tail.matchAll(LINK), (m) => ({ label: m[1], href: m[2] }))
      lines.pop()
      if (lines.length) blocks[blocks.length - 1] = lines.join('\n')
      else blocks.pop()
    } else {
      // Links run on at the end of the last sentence: "...drawing. [Helio](/portfolio/helio) · [Wingman](...)"
      const m = tail.match(/^(.*[.!?:])\s+((?:[\s,·|]*\[[^\]]+\]\([^)\s]+\))+)[\s.]*$/)
      if (m && onlyLinks(m[2])) {
        related = Array.from(m[2].matchAll(LINK), (x) => ({ label: x[1], href: x[2] }))
        lines[lines.length - 1] = m[1]
        blocks[blocks.length - 1] = lines.join('\n')
      }
    }
  }

  const seen = new Set<string>()
  const cards = related.flatMap((r) => {
    const p = projectFor(r.href)
    if (!p || seen.has(p.id)) return []
    seen.add(p.id)
    return [{ r, p }]
  })
  const chips = related.filter((r) => !projectFor(r.href))

  const inline = (s: string, key: string): ReactNode[] => {
    const out: ReactNode[] = []
    let i = 0
    for (const m of s.matchAll(LINK)) {
      const at = m.index ?? 0
      if (at > i) out.push(...mail(s.slice(i, at), `${key}-t${i}`))
      out.push(<AskLink key={`${key}-${at}`} label={m[1]} href={m[2]} onNavigate={onNavigate} />)
      i = at + m[0].length
    }
    if (i < s.length) out.push(...mail(s.slice(i), `${key}-t${i}`))
    return out
  }

  return (
    <div className="ask-md">
      {blocks.map((b, bi) => {
        const lines = b.split('\n')
        if (lines.every((l) => /^\s*([-*]|\d+\.)\s+/.test(l))) {
          return (
            <ul key={bi}>
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*([-*]|\d+\.)\s+/, ''), `${bi}-${li}`)}</li>
              ))}
            </ul>
          )
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {inline(l, `${bi}-${li}`)}
              </Fragment>
            ))}
          </p>
        )
      })}
      {cards.length > 0 && (
        <ul className="ask-cards">
          {cards.map(({ r, p }) => (
            <li key={r.href}>
              <a
                href={r.href}
                className="ask-card"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                  e.preventDefault()
                  onNavigate(r.href)
                }}
              >
                <span className="ask-card-t">
                  {p.org ?? p.title}
                  <span className="ask-card-y">{p.year}</span>
                </span>
                <span className="ask-card-l">{p.line}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {chips.length > 0 && (
        <div className="ask-related">
          {chips.map((r) => (
            <AskLink key={r.href + r.label} label={r.label} href={r.href} onNavigate={onNavigate} chip />
          ))}
        </div>
      )}
    </div>
  )
}

function AskLink({
  label,
  href,
  onNavigate,
  chip,
}: {
  label: string
  href: string
  onNavigate: (href: string) => void
  chip?: boolean
}) {
  if (href.startsWith('/')) {
    if (!isSitePath(href)) return <>{label}</>
    return (
      <a
        href={href}
        className={chip ? 'ask-chip' : 'ask-link'}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
          e.preventDefault()
          onNavigate(href)
        }}
      >
        {label}
        {chip && <span aria-hidden="true">→</span>}
      </a>
    )
  }
  if (/^https:\/\//.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={chip ? 'ask-chip' : 'ask-link'}>
        {label}
        {chip && <span aria-hidden="true">↗</span>}
        <span className="sr-only">, opens in a new tab</span>
      </a>
    )
  }
  return <>{label}</>
}
