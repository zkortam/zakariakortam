import { TLink } from './TLink'
import { work, type Project } from '@/lib/projects-data'
import { LOGOS } from '@/lib/logos'

/** The company's mark, or its name set in the house face when it has none to show. */
export function OrgMark({ p, height = 28 }: { p: Project; height?: number }) {
  const logo = LOGOS[p.id]
  if (!logo) return <span className="org-word" style={{ fontSize: height * 0.92 }}>{p.org ?? p.title}</span>
  return (
    <span
      role="img"
      aria-label={p.org ?? p.title}
      className="org-logo"
      style={{
        width: height * logo.ratio,
        height,
        WebkitMaskImage: `url(${logo.src})`,
        maskImage: `url(${logo.src})`,
        ['--brand' as string]: logo.brand,
      }}
    />
  )
}

/** The roles as a timeline: four cards on a rail, newest first. Across on wide screens, down on phones. */
export function ExperienceList({ items = work }: { items?: Project[] }) {
  return (
    <ol className="xp col-span-full">
      {items.map((p, i) => (
        <li key={p.id} className="xp-item" data-reveal="" style={{ ['--d' as string]: `${i * 70}ms` }}>
          <span className="xp-node" aria-hidden="true" />
          <span className="xp-year meta">{p.year}</span>
          <TLink href={`/portfolio/${p.id}`} className="xp-card cardx" data-light="">
            <span className="xp-mark">
              <OrgMark p={p} />
            </span>
            <span className="xp-role">{p.role}</span>
            {p.highlight && <span className="xp-hl">{p.highlight}</span>}
            <span className="xp-go" aria-hidden="true">
              →
            </span>
          </TLink>
        </li>
      ))}
    </ol>
  )
}
