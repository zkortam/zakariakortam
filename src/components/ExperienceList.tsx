import { TLink } from './TLink'
import { Rule } from './Rule'
import { work } from '@/lib/projects-data'

/** Four role rows on a subgrid: org, role, years. */
export function ExperienceList() {
  return (
    <>
      <ul className="rows col-span-full grid grid-cols-subgrid">
        {work.map((p) => (
          <li key={p.id} className="row col-span-full grid grid-cols-subgrid">
            <Rule className="rule-top" />
            <TLink href={`/portfolio/${p.id}`} className="u-group col-span-full grid grid-cols-subgrid items-baseline py-row">
              <span className="col-span-4 text-statement md:col-span-6 md:row-span-2 lg:row-span-1" data-reveal="">
                <span className="u-box oc">
                  {p.org ?? p.title}
                  <span aria-hidden="true" className="u-line thick" />
                </span>
              </span>
              <span className="col-span-4 mt-[8px] text-read md:col-span-6 md:col-start-7 md:mt-0 lg:col-span-4" data-reveal="">
                {p.role}
              </span>
              <span
                className="c3 tnum col-span-4 mt-[8px] text-body md:col-span-6 md:col-start-7 lg:col-span-2 lg:col-start-11 lg:mt-0 lg:text-right lg:text-read"
                data-reveal=""
                data-align="end"
              >
                {p.year}
              </span>
            </TLink>
          </li>
        ))}
      </ul>
      <Rule className="rule-end col-span-full" />
    </>
  )
}
