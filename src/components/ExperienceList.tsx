import { TLink } from './TLink'
import { work, type Project } from '@/lib/projects-data'
import { previewOf } from '@/lib/preview'
import { RowPreview } from './RowPreview'

/** Role rows, the same shape as the project rows: company, role, years. */
export function ExperienceList({ items = work }: { items?: Project[] }) {
  return (
    <>
      <ul className="rows col-span-full grid grid-cols-subgrid">
        {items.map((p) => (
          <li key={p.id} className="row col-span-full grid grid-cols-subgrid" data-preview={previewOf(p)}>
            <TLink href={`/portfolio/${p.id}`} className="u-group col-span-full grid grid-cols-subgrid items-baseline py-[20px] md:py-[28px]">
              <span className="col-span-4 text-read md:col-span-6" data-reveal="">
                <span className="u-box">
                  {p.org ?? p.title}
                  <span aria-hidden="true" className="u-line" />
                </span>
              </span>
              <span className="c3 col-span-4 mt-[6px] text-body md:col-span-5 md:col-start-7 md:mt-0 md:text-read" data-reveal="">
                {p.role}
                <span className="mt-[4px] block tnum md:hidden">{p.year}</span>
              </span>
              <span className="c3 tnum hidden whitespace-nowrap text-right text-body md:col-start-12 md:block" data-reveal="" data-align="end">
                {p.year}
              </span>
            </TLink>
          </li>
        ))}
      </ul>
      {items.some(previewOf) && <RowPreview />}
    </>
  )
}
