import type { Metadata } from 'next'
import { Footer } from '@/components/Footer'
import { BlogIndex } from '@/components/BlogIndex'
import { POSTS } from '@/content/blog/posts.generated'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta({
  path: '/blog',
  title: 'Blog',
  ogTitle: 'Blog by Zakaria Kortam',
  description: 'Writing by Zakaria Kortam on product, building, and AI.',
})

export default function BlogPage() {
  // The cards need no bodies: only what the index shows crosses to the client.
  const cards = POSTS.map(({ html: _h, text: _t, headings: _hd, ...c }) => c)
  return (
    <>
      <main id="main" tabIndex={-1}>
        <section className="paper pt-page pb-sec" data-tone="light">
          <BlogIndex posts={cards} />
        </section>
      </main>
      <Footer />
    </>
  )
}
