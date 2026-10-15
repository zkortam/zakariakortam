import type { CSSProperties } from 'react'
import { LivePill } from './LivePill'
import type { Project } from '@/lib/projects-data'

/** The opening of a role or an earlier project: the name, the role and dates on one line, the link. Nothing else. */
export function RoleHero({ p }: { p: Project }) {
  return (
    <section className="rh" data-tone="dark" style={{ ['--acc' as string]: p.accent ?? '#B33A4C' } as CSSProperties}>
      <div className="rh-glow" aria-hidden="true" />
      <div className="grid-main relative">
        <h1 className="oc col-span-full text-display" data-rise="">
          {p.title}
        </h1>
        <p className="rh-meta col-span-full text-read" data-reveal="">
          {p.role}
          <span>{p.year}</span>
        </p>
        {(p.links?.github || p.links?.live) && (
          <div className="plate-meta col-span-full" data-reveal="">
            {p.links?.github && <LivePill href={p.links.github} label="GitHub" />}
            {p.links?.live && <LivePill href={p.links.live} />}
          </div>
        )}
      </div>
    </section>
  )
}
