import type { CSSProperties } from 'react'
import { LivePill } from './LivePill'
import { Icon } from './Icon'
import type { Project } from '@/lib/projects-data'
import { noWidow } from '@/lib/site'

/*
 * The opening of a role (or an earlier project): the company's own light drifting behind, a headline whose words
 * rise out of their masks and whose key word turns from hairline to heavy as it lands (the type move from the Surf
 * site's manifesto), then the facts in glass. CSS only; reduced motion shows the finished frame.
 */
export function RoleHero({ p }: { p: Project }) {
  const head = p.headline ?? p.title
  const words = head.split(' ')
  const plain = head.replace(/\*/g, '')
  // Numbers when the work has them, else what it delivered, else what it was built with.
  type Tile = { big?: string; small?: string; text?: string; k?: string; v?: string; wide?: boolean }
  const tiles: Tile[] = p.stats?.length
    ? p.stats.map((s) => ({ big: s.value, small: s.label }))
    : [
        ...(p.results ?? []).map((r) => ({ text: r })),
        ...((p.results?.length ?? 0) < 3 ? [{ k: p.kind === 'work' ? 'Focus' : 'Built with', v: p.stack.join(', ') }] : []),
      ]
  return (
    <section className="rh" data-tone="dark" style={{ ['--acc' as string]: p.accent ?? '#B33A4C' } as CSSProperties}>
      <div className="rh-glow" aria-hidden="true">
        <i />
        <i />
      </div>
      <div className="grid-main relative">
        <p className="rh-eyebrow col-span-full">
          {p.headline ? p.org ?? p.title : p.role}
          <span> · {p.year}</span>
        </p>
        <h1 className="rh-title col-span-full text-display" aria-label={plain}>
          {words.map((w, i) => {
            const key = /^\*.*\*[.,]?$/.test(w) || w.startsWith('*') || w.endsWith('*') || w.endsWith('*.')
            const text = w.replace(/\*/g, '')
            return (
              <span key={i} aria-hidden="true">
                <span className="rh-w">
                  <span className="rh-in" style={{ ['--i' as string]: i } as CSSProperties}>
                    {key ? (
                      <span className="rh-key">
                        <span className="rh-thin">{text}</span>
                        <span className="rh-bold">{text}</span>
                      </span>
                    ) : (
                      text
                    )}
                  </span>
                </span>
                {i < words.length - 1 ? ' ' : ''}
              </span>
            )
          })}
        </h1>
        <div className="rh-sub col-span-4 md:col-span-8 lg:col-span-7">
          {p.headline && <p className="rh-role text-read">{p.role}</p>}
          <p className="rh-line text-read">{noWidow(p.line)}</p>
          {(p.links?.github || p.links?.live) && (
            <div className="plate-meta">
              {p.links?.github && <LivePill href={p.links.github} label="GitHub" />}
              {p.links?.live && <LivePill href={p.links.live} />}
            </div>
          )}
        </div>
        <div className={`rh-tiles col-span-full ${tiles.length === 1 ? "one" : ""}`} style={{ ['--n' as string]: tiles.length } as CSSProperties}>
          {tiles.map((t, i) => (
            <div key={i} className={`rh-tile ${t.wide ? 'wide' : ''} ${t.text ? 'res' : ''}`} style={{ ['--i' as string]: i } as CSSProperties}>
              {t.big && (
                <>
                  <span className="rh-big tnum">{t.big}</span>
                  <span className="rh-small">{t.small}</span>
                </>
              )}
              {t.text && (
                <>
                  <Icon name="check" size={22} strokeWidth={2.5} className="rh-check" />
                  <span className="rh-val">{t.text}</span>
                </>
              )}
              {t.k && (
                <>
                  <span className="rh-small">{t.k}</span>
                  <span className="rh-val">{t.v}</span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
