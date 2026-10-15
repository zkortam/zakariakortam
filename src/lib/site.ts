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
  aboutHead: 'I’m a product manager who builds, from the first question to the final detail.',
  aboutStory: [
    'I’m drawn to the whole arc of making something: the ambiguity of a first idea, the discipline of deciding what it should become, and the long, patient work of refining it until it feels inevitable.',
    'Along the way, I obsess over the smallest things. The details most people will never consciously notice, and the ones no one would think to ask for, are where I spend a disproportionate amount of my time.',
    'Attend to those details with enough care and they stop being small. They become the quiet, defining difference between a product people use and a product people love.',
  ],
  tools: [
    { label: 'Product', value: 'Finding the problem worth solving, then holding the line on what matters through discovery, roadmaps, metrics, and launch.' },
    { label: 'Design', value: 'Interaction, motion, and systems. I sketch in Figma and finish in code, where the details actually live.' },
    { label: 'Building', value: 'End to end, in TypeScript, React, Next.js, Rust, Python, and Postgres, with native apps for iOS, Android, and desktop.' },
    { label: 'AI', value: 'Agents are part of how I work every day and part of what I ship, from retrieval and evals to MCP and voice.' },
    { label: 'Cloud', value: 'Vercel, Supabase, Cloudflare, Azure, AWS, Docker, Kubernetes.' },
  ],
  education: [
    { label: 'UC San Diego', value: 'B.S. Electrical Engineering, 2026' },
    { label: 'Evergreen Valley College', value: 'A.S. Mathematics, A.S. Computer Science, A.S. Physics' },
  ],
  contactHead: 'Email is best.',
  inquiries: [
    { label: 'Consulting', subject: 'Consulting', body: 'Product strategy, design, and AI, from a first idea to a launch.' },
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
