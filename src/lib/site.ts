export const EMAIL = 'zakaria@zakariakortam.com'

export const NAV = [
  { href: '/portfolio', label: 'Work' },
  { href: '/about', label: 'About' },
  { href: '/now', label: 'Now' },
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
    'Product Manager at DigiCert.',
    'Building Helio, Surf,',
    'SPICE++, and AiroFind.',
  ],
  statementLead: 'I work on the whole product.',
  statementRest: 'From the first customer call to the code that ships.',
  allWork: 'All work',
  workLine: '',
  aboutHead: 'I’m a product manager who builds. I take products from zero to one, end to end.',
  aboutStory: [
    'Surf started in 2021 and is on its fourth version. Helio, SPICE++, RTL++, and AiroFind came after it. Each one taught me something a spec never would.',
    'I build with AI every day. Agents write, test, and review code alongside me, and I review everything that ships.',
    'Before DigiCert I was the founding AI engineer at Facilis, building agents that work with factory systems. Before that I did product work at Incorta and Inqueue.',
  ],
  aboutQuote: 'Most of what I know about product came from shipping my own things.',
  tools: [
    { label: 'Product', value: 'Customer interviews, roadmaps, PRDs, metrics, and launch. Zero to one.' },
    { label: 'Design', value: 'Interaction design, motion, and design systems. Figma, then straight to code.' },
    { label: 'Building', value: 'TypeScript, React, Next.js, Rust, Python, Postgres. Web, iOS, Android, desktop.' },
    { label: 'AI', value: 'Agents, MCP, retrieval, evals, and voice in what I ship. Claude Code and Codex in my loop.' },
    { label: 'Cloud', value: 'Vercel, Supabase, Cloudflare, Azure, AWS, Docker, Kubernetes.' },
    { label: 'Shipping', value: 'Small releases, real tests, fast fixes.' },
  ],
  education: [
    { label: 'UC San Diego', value: 'B.S. Electrical Engineering, 2026' },
    { label: 'Evergreen Valley College', value: 'A.S. Mathematics, A.S. Computer Science, A.S. Physics' },
  ],
  contactHead: 'Email is best. I usually reply within a day.',
  inquiries: [
    { label: 'Consulting', subject: 'Consulting', body: 'Product design, AI implementation, and taking products from zero to one.' },
    { label: 'Opportunities', subject: 'Opportunity', body: 'Roles, collaborations, and projects in product and AI.' },
    { label: 'General', subject: 'Hello', body: 'Questions about my work, speaking, or anything else.' },
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
