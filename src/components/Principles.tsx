import Image from 'next/image'
import { TLink } from './TLink'
import { PRINCIPLES } from '@/lib/voice'

/** Five beliefs, each with the line of proof from the work that backs it. */
export function Principles() {
  return (
    <ol className="principles col-span-full mt-head">
      {PRINCIPLES.map((p, i) => (
        <li key={p.head} className="principle cardx" data-reveal="" style={{ ['--d' as string]: `${(i % 2) * 80}ms` }}>
          <span className="principle-n serif" aria-hidden="true">
            {String(i + 1).padStart(2, '0')}
          </span>
          <h3 className="principle-h">{p.head}</h3>
          <p className="principle-b">{p.body}</p>
          {p.id ? (
            <TLink href={`/portfolio/${p.id}`} className="proof">
              <Image src={`/work/thumb/${p.id}.webp`} alt="" width={96} height={96} sizes="32px" quality={82} className="proof-i" />
              <span>{p.proof}</span>
              <span aria-hidden="true" className="proof-a">→</span>
            </TLink>
          ) : (
            <p className="proof">
              <span className="proof-i proof-dot" aria-hidden="true" />
              <span>{p.proof}</span>
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}
