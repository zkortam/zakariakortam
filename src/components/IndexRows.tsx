import { TLink } from './TLink'
import type { Project } from '@/lib/projects-data'
import { noWidow } from '@/lib/site'
import { previewOf } from '@/lib/preview'
import { RowPreview } from './RowPreview'

/** Earlier projects: title, line, year. */
export function IndexRows({ items }: { items: Project[] }) {
  return (
    <>
      <ul className="rows col-span-full grid grid-cols-subgrid">
        {items.map((p) => (
          <li key={p.id} className="row col-span-full grid grid-cols-subgrid" data-preview={previewOf(p)}>
            <TLink href={`/portfolio/${p.id}`} className="u-group col-span-full grid grid-cols-subgrid items-baseline py-[20px] md:py-[28px]">
              <span className="col-span-4 text-read md:col-span-6" data-reveal="">
                <span className="u-box">
                  {p.title}
                  <span aria-hidden="true" className="u-line" />
                </span>
              </span>
              <span className="c3 col-span-4 mt-[6px] text-body md:col-span-5 md:col-start-7 md:mt-0 md:text-read" data-reveal="">
                {noWidow(p.line)}
                <span className="block md:hidden c3 tnum mt-[4px]">{p.year}</span>
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

/** A single "Next: {title}" row. */
export function NextRow({ href, title }: { href: string; title: string }) {
  return (
    <>
      <ul className="rows col-span-full grid grid-cols-subgrid">
        <li className="row col-span-full grid grid-cols-subgrid">
          <TLink href={href} className="u-group col-span-full grid grid-cols-subgrid items-baseline py-[20px] md:py-[28px]">
            <span className="col-span-3 text-read md:col-span-10" data-reveal="">
              <span className="u-box">
                Next: {title}
                <span aria-hidden="true" className="u-line" />
              </span>
            </span>
            <span className="col-span-1 text-right text-read md:col-span-2" data-reveal="" data-align="end" aria-hidden="true">
              <span className="arrow-shift">→</span>
            </span>
          </TLink>
        </li>
      </ul>
    </>
  )
}
