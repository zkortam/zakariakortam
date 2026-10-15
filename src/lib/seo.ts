import type { Metadata } from 'next'

/** Canonical origin. The apex redirects here, so every absolute URL the site emits uses www. */
export const SITE_URL = 'https://www.zakariakortam.com'
export const SITE_NAME = 'Zakaria Kortam'
export const PERSON_ID = `${SITE_URL}/#person`
export const WEBSITE_ID = `${SITE_URL}/#website`

export function absUrl(path: string): string {
  return path.startsWith('http') ? path : `${SITE_URL}${path}`
}

/**
 * Per-page metadata with canonical, Open Graph, and Twitter fields filled in.
 * Next merges metadata shallowly, so a page that sets openGraph replaces the layout's whole object;
 * this keeps siteName, locale, type, and the share image on every page.
 */
export function pageMeta({
  path,
  title,
  description,
  ogTitle,
  type = 'website',
  image = '/opengraph-image',
  imageAlt = SITE_NAME,
}: {
  path: string
  title: string
  description: string
  /** Full title for social cards, where the "| Zakaria Kortam" template does not apply. */
  ogTitle?: string
  type?: 'website' | 'profile' | 'article'
  /** Share image route. Defaults to the root opengraph-image. */
  image?: string
  imageAlt?: string
}): Metadata {
  const social = ogTitle ?? `${title} | ${SITE_NAME}`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      locale: 'en_US',
      siteName: SITE_NAME,
      url: path,
      title: social,
      description,
      // Setting openGraph in a page replaces the generated opengraph-image, so name it explicitly.
      // Twitter inherits these images when it has none of its own.
      images: [{ url: image, width: 1200, height: 630, alt: imageAlt, type: 'image/png' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: social,
      description,
      creator: '@zakariakortam',
      site: '@zakariakortam',
    },
  }
}
