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
      style={{ ['--ground' as string]: spec.ground, ['--title-lines' as string]: lines.length }}
    >
      <PlateMediaLayer spec={spec} />

      <div className="plate-head grid-main" data-flip-strip="">
        <H className="c1 col-span-4 text-display md:col-span-12 lg:col-span-6">
          <span className="title-u oc">
            <span className="block" data-rise="">
              {lines.length > 1 ? lines.map((l) => <span key={l} className="block">{l}</span>) : lines[0]}
            </span>
            {link && <span aria-hidden="true" className="u-line" />}
          </span>
        </H>
        <p className="plate-line c2 col-span-4 text-read md:col-span-10 lg:col-span-5 lg:col-start-7" data-reveal="">
          {line ?? noWidow(project.line)}
        </p>
      </div>

      {link && (
        <TLink href={`/portfolio/${project.id}`} className="plate-link" aria-label={project.title} flip="plate" flipId={project.id} />
      )}

      <div className="plate-stage">
        <PlateMediaFlow spec={spec} />
      </div>

      <div className="plate-foot grid-main" data-flip-strip="">
        <p className="c3 text-body" data-reveal="">
          {project.year}
        </p>
        <div className="pills" data-reveal="" data-align="end">
          {showGithub && project.links?.github && <LivePill href={project.links.github} label="GitHub" light={light} />}
          {project.links?.live && <LivePill href={project.links.live} light={light} />}
        </div>
      </div>
    </section>
  )
}
