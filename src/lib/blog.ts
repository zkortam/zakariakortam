import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { marked } from 'marked'

/** A post's Markdown, rendered to HTML at build time. Only files under src/content/blog are ever read. */
export function postHtml(slug: string): string {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('bad slug')
  const md = readFileSync(join(process.cwd(), 'src/content/blog', `${slug}.md`), 'utf8')
  return marked.parse(md, { async: false, gfm: true }) as string
}

/** Minutes to read at about 230 words a minute. */
export function readingMinutes(slug: string): number {
  const md = readFileSync(join(process.cwd(), 'src/content/blog', `${slug}.md`), 'utf8')
  return Math.max(1, Math.round(md.split(/\s+/).filter(Boolean).length / 230))
}
