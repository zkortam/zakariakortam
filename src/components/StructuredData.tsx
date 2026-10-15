import type { Project } from '@/lib/projects-data'
import { SOCIALS } from '@/lib/site'
import { PERSON_ID, SITE_NAME, SITE_URL, WEBSITE_ID, absUrl } from '@/lib/seo'

/** Serialize for a script tag. Escaping "<" keeps a stray "</script>" in any string from closing the tag. */
function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}

/** Site-wide graph: the person and the website, linked by @id so page-level nodes can reference them. */
export function StructuredData() {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Person',
            '@id': PERSON_ID,
            name: SITE_NAME,
            url: `${SITE_URL}/`,
            image: absUrl('/zakaria.png'),
            jobTitle: 'Product Manager',
            worksFor: { '@type': 'Organization', name: 'DigiCert', url: 'https://www.digicert.com' },
            alumniOf: [
              { '@type': 'CollegeOrUniversity', name: 'UC San Diego', url: 'https://ucsd.edu' },
              { '@type': 'CollegeOrUniversity', name: 'Evergreen Valley College', url: 'https://www.evc.edu' },
            ],
            knowsAbout: [
              'Product management',
              'Product design',
              'Artificial intelligence',
              'AI agents',
              'Full stack development',
              'Electrical engineering',
            ],
            address: {
              '@type': 'PostalAddress',
              addressLocality: 'San Jose',
              addressRegion: 'CA',
              addressCountry: 'US',
            },
            sameAs: SOCIALS.map((s) => s.href),
          },
          {
            '@type': 'WebSite',
            '@id': WEBSITE_ID,
            name: SITE_NAME,
            url: `${SITE_URL}/`,
            inLanguage: 'en-US',
            publisher: { '@id': PERSON_ID },
            about: { '@id': PERSON_ID },
          },
        ],
      }}
    />
  )
}

/** One project or role page: the work itself plus a breadcrumb back to Work. */
export function ProjectStructuredData({ p }: { p: Project }) {
  const url = absUrl(`/portfolio/${p.id}`)
  const sameAs = [p.links?.live, p.links?.github].filter((x): x is string => Boolean(x))
  const crumbs = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Work', item: absUrl('/portfolio') },
      { '@type': 'ListItem', position: 3, name: p.title, item: url },
    ],
  }

  // Roles at companies are not works Zakaria authored, so they get a page node about the organization instead.
  const main =
    p.kind === 'work'
      ? {
          '@type': 'WebPage',
          '@id': `${url}#webpage`,
          url,
          name: `${p.role} at ${p.org ?? p.title}`,
          description: p.line,
          isPartOf: { '@id': WEBSITE_ID },
          about: [
            { '@id': PERSON_ID },
            { '@type': 'Organization', name: p.org ?? p.title, ...(p.links?.live ? { url: p.links.live } : {}) },
          ],
        }
      : {
          '@type': 'CreativeWork',
          '@id': `${url}#work`,
          name: p.title,
          description: p.line,
          abstract: p.overview,
          url,
          author: { '@id': PERSON_ID },
          ...(p.image ? { image: absUrl(p.image) } : {}),
          ...(p.stack.length ? { keywords: p.stack.join(', ') } : {}),
          ...(sameAs.length ? { sameAs } : {}),
          isPartOf: { '@id': WEBSITE_ID },
        }

  return <JsonLd data={{ '@context': 'https://schema.org', '@graph': [main, crumbs] }} />
}
