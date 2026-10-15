export const EMAIL = 'zakaria@zakariakortam.com'

export const NAV = [
  { href: '/portfolio', label: 'Work' },
  { href: '/about', label: 'About' },
  { href: '/blog', label: 'Blog' },
  { href: '/now', label: 'Now' },
  { href: '/contact', label: 'Contact' },
] as const

export const SOCIALS = [
  { label: 'Surf', icon: 'surf', handle: '@zakaria', href: 'https://surfsocial.org/zakaria' },
  { label: 'LinkedIn', icon: 'linkedin', handle: 'in/zkortam', href: 'https://linkedin.com/in/zkortam' },
  { label: 'GitHub', icon: 'github', handle: 'zkortam', href: 'https://github.com/zkortam' },
  { label: 'X', icon: 'x', handle: '@zakariakortam', href: 'https://x.com/zakariakortam' },
  { label: 'Instagram', icon: 'instagram', handle: '@zkortam', href: 'https://instagram.com/zkortam' },
] as const

export const LOCATION = 'San Jose, California'

export const COPY = {
  heroTitle: 'Product Manager',
  heroLines: [
    'Associate Innovation Product Manager at DigiCert.',
    'On my own time I build Helio,',
    'Surf, SPICE++, and AiroFind.',
  ],
  statementLead: 'True simplicity is derived from so much more than just the absence of clutter and ornamentation.',
  statementRest: 'It’s about bringing order to complexity.',
  statementBy: 'Sir Jony Ive',
  allWork: 'All work',
  workLine: '',
  aboutHead: 'I’m a product manager who builds. I take products from zero to one, end to end.',
  aboutStory: [
    'Most of what I know about product, I learned by building my own, and I’ve been doing it since 2022.',
    'I took the long way to engineering: Evergreen Valley College first, where I earned three associate degrees, then electrical engineering at UC San Diego.',
    'I like building communities as much as products. I founded the computer science club and the Muslim Student Association at Evergreen Valley College, and the Egyptian Student Association, Triton Tory, and the Triton Law Review at UC San Diego.',
  ],
  tools: [
    { label: 'Product', value: 'Zero to one. Talking to customers, deciding what to build, roadmaps, PRDs, metrics, launch.' },
    { label: 'Design', value: 'Product and interaction design, motion, design systems. Figma, then straight to code.' },
    { label: 'Building', value: 'End to end: TypeScript, React, Next.js, Rust, Python, Postgres, and native apps for iOS, Android, and desktop.' },
    { label: 'AI', value: 'Claude Code, Codex, and agents in my daily loop. Agents, MCP, retrieval, evals, and voice in what I ship.' },
    { label: 'Cloud', value: 'Vercel, Supabase, Cloudflare, Azure, AWS, Docker, Kubernetes.' },
  ],
  education: [
    { label: 'UC San Diego', value: 'B.S. Electrical Engineering, 2026' },
    { label: 'Evergreen Valley College', value: 'A.S. Mathematics, A.S. Computer Science, A.S. Physics' },
  ],
  contactHead: 'Email is best.',
  inquiries: [
    { label: 'Consulting', subject: 'Consulting', body: 'Product design, AI implementation, and taking products from zero to one.' },
    { label: 'Opportunities', subject: 'Opportunity', body: 'Roles, collaborations, and projects in product and AI.' },
    { label: 'General', subject: 'Hello', body: 'Questions about my work, or anything else.' },
  ],
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
