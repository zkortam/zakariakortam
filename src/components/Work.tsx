import Image from 'next/image'
import Link from 'next/link'
import { type Project } from '@/lib/projects-data'
import { Fade } from './Motion'

/** A project with a screenshot. */
export function Shot({ p, wide = false }: { p: Project; wide?: boolean }) {
  return (
    <Fade className={wide ? 'sm:col-span-2' : ''}>
      <Link href={`/portfolio/${p.id}`} className="group block">
        <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-white/[0.03]">
          {p.image && (
            <Image
              src={p.image}
              alt={p.title}
              fill
              sizes={wide ? '(min-width: 640px) 90vw, 100vw' : '(min-width: 640px) 45vw, 100vw'}
              className="object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.02]"
            />
          )}
        </div>
        <div className="mt-4 flex items-baseline justify-between gap-6">
          <span>{p.title}</span>
          <span className="text-sm text-foreground-subtle">{p.year}</span>
        </div>
        <p className="mt-1 text-foreground-muted">{p.line}</p>
      </Link>
    </Fade>
  )
}

/** Plain rows: left, middle, right. */
export function Rows({
  items,
  left,
  mid,
}: {
  items: Project[]
  left: (p: Project) => string
  mid: (p: Project) => string
}) {
  return (
    <ul>
      {items.map((p) => (
        <li key={p.id} className="border-b last:border-b-0">
          <Link
            href={`/portfolio/${p.id}`}
            className="group grid grid-cols-[1fr_auto] gap-x-6 gap-y-0.5 py-5 sm:grid-cols-[13rem_1fr_auto]"
          >
            <span className="text-foreground-muted transition-colors group-hover:text-foreground">{left(p)}</span>
            <span className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">{mid(p)}</span>
            <span className="col-start-2 row-start-1 text-sm text-foreground-subtle sm:col-start-auto sm:row-start-auto">
              {p.year}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
