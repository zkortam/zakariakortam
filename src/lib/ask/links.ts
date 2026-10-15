import { projects } from '@/lib/projects-data'

/** Every internal page the assistant may link to. Anything else renders as plain text. */
export const ASK_PAGES: { href: string; label: string }[] = [
  { href: '/', label: 'Home' },
  { href: '/portfolio', label: 'All work' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  ...projects.map((p) => ({ href: `/portfolio/${p.id}`, label: p.kind === 'work' ? (p.org ?? p.title) : p.title })),
]

const known = new Set(ASK_PAGES.map((p) => p.href))

export function isSitePath(href: string): boolean {
  return known.has(href.replace(/[#?].*$/, '').replace(/(.)\/$/, '$1'))
}
