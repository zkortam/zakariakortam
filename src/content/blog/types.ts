export interface Post {
  slug: string
  title: string
  /** ISO date, e.g. '2026-10-20'. */
  date: string
  summary: string
  /** Path under /public, e.g. '/blog/cover.jpg'. */
  cover: string | null
  /** Photo credit for the cover, as its license asks. */
  credit: { text: string; href: string | null } | null
  tags: string[]
  draft: boolean
  minutes: number
  /** The post's ## sections, for the contents list. */
  headings: { id: string; text: string }[]
  html: string
  /** The Markdown itself, for search and the Ask assistant. */
  text: string
}

export function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}
