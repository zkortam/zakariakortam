import { domainOf } from '@/lib/site'

export function LivePill({ href, label, light = false }: { href: string; label?: string; light?: boolean }) {
  const text = label ?? domainOf(href)
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${text}, opens in a new tab`}
      className={`pill ${light ? 'glass-light' : 'glass-dark'}`}
    >
      <span>{text}</span>
      <span aria-hidden="true" className="arr">
        ↗
      </span>
    </a>
  )
}
