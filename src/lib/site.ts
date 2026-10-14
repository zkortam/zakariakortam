export const EMAIL = 'zakaria@zakariakortam.com'

export const NAV = [
  { href: '/portfolio', label: 'Work' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const

export const SOCIALS = [
  { label: 'LinkedIn', handle: 'in/zkortam', href: 'https://linkedin.com/in/zkortam' },
  { label: 'GitHub', handle: 'zkortam', href: 'https://github.com/zkortam' },
  { label: 'X', handle: '@zakariakortam', href: 'https://x.com/zakariakortam' },
  { label: 'Instagram', handle: '@zkortam', href: 'https://instagram.com/zkortam' },
] as const

export const LOCATION = 'San Jose, California'

export const COPY = {
  heroLines: [
    'Associate Product Manager at',
    'DigiCert. On my own time I build',
    'Helio, Surf, SPICE++, and AiroFind.',
  ],
  statementLead: 'I work on the whole product.',
  statementRest: 'Talking to customers, deciding what to build, writing the code, and shipping it.',
  allWork: 'All work, including earlier projects',
  workLine: 'Products I built on my own, and the teams I have worked with.',
  aboutHead: 'I’m a product manager in San Jose. I studied electrical engineering at UC San Diego.',
  aboutStory: [
    'Most of what I know about product came from shipping my own things. Surf started in 2022 and is on its fourth version. Helio, SPICE++, and AiroFind came after it.',
    'Before DigiCert I was the founding AI engineer at FacilisAI, building agents that work with factory systems. Before that I did product work at Incorta and Inqueue.',
    'I was also COO of ClosingTheDivide, a nonprofit that has donated more than 1,350 computers and set up 12 computer labs.',
  ],
  tools: [
    { label: 'Product', value: 'Roadmaps, PRDs, KPIs, user research, A/B tests' },
    { label: 'Code', value: 'TypeScript, Python, Rust, Go, C/C++, SQL' },
    { label: 'AI', value: 'Claude, OpenAI, MCP, retrieval, vector databases' },
    { label: 'Infrastructure', value: 'Supabase, Postgres, Docker, Kubernetes, AWS, Azure' },
  ],
  education: { label: 'UC San Diego', value: 'B.S. Electrical Engineering, 2026' },
  contactHead: 'Email is best. I usually reply within a day.',
  footerHead: 'Email is best.',
  notFoundLine: 'This page doesn’t exist or has moved.',
} as const

/** Replace the last space with a no-break space when the last word is short, so no line ends on one word. */
export function noWidow(s: string): string {
  const i = s.lastIndexOf(' ')
  if (i < 0) return s
  const last = s.slice(i + 1)
  if (last.length > 12) return s
  return s.slice(0, i) + ' ' + last
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export const YEAR = new Date().getFullYear()
