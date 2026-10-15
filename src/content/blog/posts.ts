/**
 * The blog's posts, newest first. Each entry has a Markdown file next to it: src/content/blog/<slug>.md.
 * A post shows on the site (and the Blog link appears in the nav) only when it is listed here without `draft`.
 */
export interface PostMeta {
  slug: string
  title: string
  /** ISO date, e.g. '2026-10-15'. */
  date: string
  /** One plain sentence for the index and link previews. */
  summary: string
  draft?: boolean
}

export const POSTS: PostMeta[] = []

export const published = POSTS.filter((p) => !p.draft).sort((a, b) => b.date.localeCompare(a.date))

export function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}
