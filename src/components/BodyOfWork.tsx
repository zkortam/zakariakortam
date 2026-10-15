'use client'

import { useState } from 'react'
import { FIGURES, compact, type Figure } from '@/lib/figures'

/**
 * The body of work in three numbers, each split by product. The bar is the picture; the legend under it carries
 * the names and the values, so nothing depends on color alone. Hovering a segment or a legend row isolates it.
 */
function Breakdown({ f }: { f: Figure }) {
  const [on, setOn] = useState<string | null>(null)
  return (
    <div className="bow-break" onPointerLeave={() => setOn(null)}>
      <div className="bow-bar" role="img" aria-label={f.parts.map((p) => `${p.label} ${compact(p.value)}`).join(', ')}>
        {f.parts.map((p) => (
          <span
            key={p.id}
            className={`bow-seg ${on && on !== p.id ? 'dim' : ''}`}
            style={{ flexGrow: p.value, background: p.color }}
            onPointerEnter={() => setOn(p.id)}
          />
        ))}
      </div>
      <ul className="bow-legend">
        {f.parts.map((p) => (
          <li key={p.id} className={on && on !== p.id ? 'dim' : ''} onPointerEnter={() => setOn(p.id)}>
            <i style={{ background: p.color }} aria-hidden="true" />
            <span>{p.label}</span>
            <span className="tnum">{compact(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function BodyOfWork() {
  return (
    <div className="col-span-full grid grid-cols-1 gap-y-[56px] md:grid-cols-3 md:gap-x-[var(--g)]">
      {FIGURES.map((f, i) => (
        <div key={f.label} className="bow" data-reveal="" style={{ ['--d' as string]: `${i * 90}ms` }}>
          <p className="bow-v">{f.value}</p>
          <p className="bow-l">{f.label}</p>
          <Breakdown f={f} />
        </div>
      ))}
    </div>
  )
}
