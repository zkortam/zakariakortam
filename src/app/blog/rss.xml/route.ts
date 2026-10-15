import { POSTS } from '@/content/blog/posts.generated'
import { absUrl } from '@/lib/seo'

export const dynamic = 'force-static'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** RSS for readers who follow the blog. */
export function GET() {
  const items = POSTS.map(
    (p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${absUrl(`/blog/${p.slug}`)}</link>
      <guid>${absUrl(`/blog/${p.slug}`)}</guid>
      <pubDate>${new Date(`${p.date}T12:00:00Z`).toUTCString()}</pubDate>
      <description>${esc(p.summary)}</description>
    </item>`,
  ).join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Zakaria Kortam</title>
    <link>${absUrl('/blog')}</link>
    <description>Writing on product, building, and AI.</description>
${items}
  </channel>
</rss>
`
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } })
}
