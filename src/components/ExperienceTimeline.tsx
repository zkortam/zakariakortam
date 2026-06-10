'use client'

import { Reveal } from './Reveal'

export type Experience = {
  role: string
  org: string
  when: string
  points: string[]
}

/**
 * Clean, structured experience entries: role + company on the left, the work
 * on the right, separated by hairlines. Reveals on scroll.
 */
export function ExperienceTimeline({ items }: { items: Experience[] }) {
  return (
    <div className="mt-12 border-t border-white/[0.1]">
      {items.map((e, i) => (
        <Reveal key={e.org}>
          <div className="grid gap-6 border-b border-white/[0.1] py-10 sm:py-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <div className="flex items-baseline gap-4">
                <span className="font-display text-base tabular-nums text-foreground-subtle">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="text-2xl font-semibold leading-tight tracking-tight sm:text-[1.75rem]">
                  {e.role}
                </h3>
              </div>
              <p className="mt-2.5 pl-10 text-lg text-accent">{e.org}</p>
              <p className="mt-1 pl-10 text-sm text-foreground-subtle">
                {e.when}
              </p>
            </div>

            <ul className="space-y-4 lg:pt-1">
              {e.points.map((p) => (
                <li
                  key={p}
                  className="flex gap-3.5 leading-relaxed text-foreground-muted"
                >
                  <span className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-accent/70" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      ))}
    </div>
  )
}
