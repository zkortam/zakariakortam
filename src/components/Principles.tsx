import { PRINCIPLES } from '@/lib/voice'

/** Six short beliefs, each a statement with one line of why, on the 12 column grid. */
export function Principles() {
  return (
    <div className="mt-head col-span-full grid grid-cols-subgrid">
      <ul className="col-span-full grid grid-cols-subgrid">
        {PRINCIPLES.map((p) => (
          <li key={p.head} className="principle relative col-span-full grid grid-cols-subgrid py-row">
            <span aria-hidden="true" className="rule absolute left-0 right-0 top-0" />
            <h3 className="oc col-span-4 text-statement md:col-span-6" data-rise="">
              {p.head}
            </h3>
            <p className="c3 col-span-4 mt-[16px] text-read md:col-span-5 md:col-start-7 md:mt-[0.35em]" data-reveal="">
              {p.body}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
