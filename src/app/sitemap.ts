import type { MetadataRoute } from 'next'
import { execSync } from 'node:child_process'
import { projects } from '@/lib/projects-data'
import { published } from '@/content/blog/posts'
import { absUrl } from '@/lib/seo'

/** Date of the last commit, so lastmod only moves when the site changes. Falls back to build time. */
function lastCommit(): Date {
  try {
    const iso = execSync('git log -1 --format=%cI', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? new Date() : d
  } catch {
    return new Date()
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = lastCommit()
  const pages: MetadataRoute.Sitemap = [
    { url: absUrl('/'), lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: absUrl('/portfolio'), lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: absUrl('/about'), lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: absUrl('/now'), lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: absUrl('/contact'), lastModified, changeFrequency: 'yearly', priority: 0.6 },
  ]
  // Featured projects lead; roles and earlier projects follow.
  const items: MetadataRoute.Sitemap = projects.map((p) => ({
    url: absUrl(`/portfolio/${p.id}`),
    lastModified,
    changeFrequency: 'monthly',
    priority: p.kind === 'project' && p.featured ? 0.8 : p.kind === 'work' ? 0.7 : 0.5,
  }))
  const posts: MetadataRoute.Sitemap = published.length
    ? [
        { url: absUrl('/blog'), lastModified, changeFrequency: 'weekly', priority: 0.7 },
        ...published.map((p) => ({ url: absUrl(`/blog/${p.slug}`), lastModified: new Date(`${p.date}T12:00:00Z`), changeFrequency: 'yearly' as const, priority: 0.6 })),
      ]
    : []
  return [...pages, ...items, ...posts]
}
