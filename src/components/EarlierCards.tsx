import Image from 'next/image'
import { TLink } from './TLink'
import { Glyph } from './Glyph'
import type { Project } from '@/lib/projects-data'
import { noWidow } from '@/lib/site'

/** Real screens, captured from the live sites. */
export const SHOTS: Record<string, string> = {
  robodog: '/work/earlier/robodog.webp',
  'fridgit': '/work/earlier/fridgit.webp',
  'nexus-robot': '/work/earlier/nexus.webp',
}

/** The one line a card wears as a badge: a placing, a prize, a user count. Only what the project page backs up. */
export const BADGE: Record<string, string> = {
  'documap-ai': 'Winner, SAG-AFTRA Challenge',
  'alex-ai': '1st place, TedAI × Microsoft',
  'clippy-2': '1,200+ users',
  'nexus-robot': '2nd of 8',
}

/** Warm and cool paper tints, so a row of drawings never reads as one flat block. */
const TINTS = ['#E4DDD3', '#DADFDC', '#E6D9D3', '#DCDCE3']

const kindOf = (p: Project) => (p.tags?.includes('Hackathons') ? 'Hackathon' : p.tags?.includes('Hardware') ? 'Hardware' : p.tags?.[0] ?? 'Project')

export function EarlierCards({ items }: { items: Project[] }) {
  return (
    <ul className="early col-span-full">
      {items.map((p, i) => {
        const shot = SHOTS[p.id]
        const badge = BADGE[p.id]
        return (
          <li key={p.id} data-reveal="" style={{ ['--d' as string]: `${(i % 3) * 60}ms` }}>
            <TLink href={`/portfolio/${p.id}`} className="early-card cardx" data-light="">
              <span className="early-media" style={{ background: shot ? '#0B0B0E' : TINTS[i % TINTS.length] }}>
                {shot ? (
                  <Image src={shot} alt={`${p.title}, from its live site`} fill sizes="(min-width:1024px) 31vw, (min-width:768px) 46vw, 120px" quality={82} className="object-cover" />
                ) : (
                  <Glyph id={p.id} />
                )}
                {badge && <span className="early-badge">{badge}</span>}
              </span>
              <span className="early-body">
                <span className="early-top">
                  <span className="early-title">{p.title}</span>
                  <span className="meta c3 tnum">{p.year}</span>
                </span>
                <span className="early-line">{noWidow(p.line)}</span>
                {badge && <span className="early-badge-m meta">{badge}</span>}
                <span className="early-kind meta">{kindOf(p)}</span>
              </span>
            </TLink>
          </li>
        )
      })}
    </ul>
  )
}
