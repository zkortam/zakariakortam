import type { ReactNode } from 'react'
import { PlateMediaFlow, PlateMediaLayer } from './PlateMedia'
import { LivePill } from './LivePill'
import { TLink } from './TLink'
import type { Project } from '@/lib/projects-data'
import type { PlateSpec } from '@/lib/media'
import { noWidow } from '@/lib/site'

/** One full screen per product, lit in its own colors. Home reel, project hero and next-project plate. */
export function Plate({
  project,
  spec,
  heading = 'h2',
  link = true,
  flipTarget = false,
  line,
  showGithub = false,
}: {
  project: Project
  spec: PlateSpec
  heading?: 'h1' | 'h2'
  link?: boolean
  flipTarget?: boolean
  line?: ReactNode
  showGithub?: boolean
}) {
  const H = heading
  const light = spec.tone === 'light'
  const lines = spec.titleLines
  return (
    <section
      className="plate reel"
      data-tone={spec.tone}
      data-plate={spec.id}
      data-comp={spec.composition}
      {...(flipTarget ? { 'data-flip-target': spec.id } : {})}
      style={{ ['--ground' as string]: spec.ground, ['--title-lines' as string]: 1 }}
    >
      <PlateMediaLayer spec={spec} />

      <div className="plate-head grid-main" data-flip-strip="">
        <H className="c1 col-span-full text-display">
          <span className="title-u oc">
            <span className="block" data-rise="">
              {lines.join(' ')}
            </span>
            {link && <span aria-hidden="true" className="u-line" />}
          </span>
        </H>
        <div className="plate-sub col-span-4 md:col-span-8 lg:col-span-6">
          <p className="plate-line c2 text-read" data-reveal="">
            {line ?? noWidow(project.line)}
          </p>
          <div className="plate-meta" data-reveal="">
            <span className="c3 text-body tnum">{project.year}</span>
            {showGithub && project.links?.github && <LivePill href={project.links.github} label="GitHub" light={light} />}
            {project.links?.live && <LivePill href={project.links.live} light={light} />}
          </div>
        </div>
      </div>

      {link && (
        <TLink href={`/portfolio/${project.id}`} className="plate-link" aria-label={project.title} flip="plate" flipId={project.id} />
      )}

      <div className="plate-stage">
        <PlateMediaFlow spec={spec} />
      </div>

    </section>
  )
}
