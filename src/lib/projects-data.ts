export interface Project {
  id: string
  title: string
  /** One plain sentence. Shown on cards and lists. */
  line: string
  kind: 'work' | 'project'
  /** Featured projects get a screenshot tile; the rest go in a plain list. */
  featured: boolean
  year: string
  role: string
  org?: string
  overview: string
  problem?: string
  approach?: string
  results?: string[]
  stack: string[]
  /** Screenshot in public/work, if there is one. */
  image?: string
  links?: {
    live?: string
    github?: string
  }
}

export const projects: Project[] = [
  // Work
  {
    id: 'digicert',
    title: 'DigiCert',
    line: 'New products in digital trust: certificates, PKI, and identity.',
    kind: 'work',
    featured: true,
    year: '2026 to now',
    role: 'Associate Product Manager, Innovation',
    org: 'DigiCert',
    overview:
      'I work on new products at DigiCert, the certificate authority behind a large share of the web’s TLS, code signing, and PKI.',
    problem:
      'Trust on the internet is changing quickly. Certificate lifetimes are getting shorter, post-quantum cryptography is coming, and AI agents need identities you can verify.',
    approach:
      'Talk to customers, frame the problem, and prototype early so ideas get tested before they get scaled.',
    stack: ['Product management', 'Customer discovery', 'PKI', 'Prototyping'],
    links: { live: 'https://www.digicert.com' },
  },
  {
    id: 'facilis-ai',
    title: 'FacilisAI',
    line: 'Agents that work with factory systems: PLCs, MES, and SCADA.',
    kind: 'work',
    featured: true,
    year: '2025 to 2026',
    role: 'Founding AI Engineer',
    org: 'FacilisAI',
    overview:
      'I built FacilisAI’s main product, a platform that connects plant systems (PLCs, MES, SCADA) to AI agents. Operators use it through chat and scheduled background tasks.',
    problem:
      'Plant software is air-gapped and old. Work that touches it is slow and manual, and cloud AI can’t reach it.',
    approach:
      'I owned the agent architecture and the integrations. I ran 15+ customer interviews to set the ICP and roadmap, shipped on-prem and air-gapped installs with small edge models, and ran demos and sales calls.',
    results: [
      '20 enterprise demo testers',
      'Demos converted into provisional contracts',
      'Tasks that took a month now take hours',
    ],
    stack: ['TypeScript', 'Node.js', 'React', 'MCP', 'Edge SLMs'],
    links: { live: 'https://facilis.ai' },
  },
  {
    id: 'incorta-dashboards',
    title: 'Incorta',
    line: 'Charts and schema interpreters behind the AI Copilot dashboard.',
    kind: 'work',
    featured: true,
    year: '2024 to 2025',
    role: 'Product Engineering Intern',
    org: 'Incorta',
    overview:
      'I built the TypeScript interpreters that turn model-generated JSON specs into streamed charts for Incorta’s AI Copilot, and the charting library underneath them.',
    problem:
      'The Copilot had to draw fast, correct charts from model output over enterprise data, with the access controls enterprise customers expect.',
    approach:
      'Shipped 5+ features from PRD through design review, QA, and rollout. Set up CI on GitHub Actions and defined adoption, completion, and latency metrics.',
    results: [
      'Tables, sparklines, and time series from one spec format',
      '90%+ test coverage in CI',
      'RBAC, audit logging, and accessibility in the release checklist',
    ],
    stack: ['TypeScript', 'React', 'SQL', 'Jest', 'GitHub Actions', 'Figma'],
    links: { live: 'https://incorta.com' },
  },
  {
    id: 'inqueue',
    title: 'Inqueue',
    line: 'Took a queuing app from research to a shipped Flutter MVP.',
    kind: 'work',
    featured: true,
    year: '2023',
    role: 'Product Intern',
    org: 'Inqueue',
    overview:
      'I owned the MVP for a mobile queuing app: market research, the core user flows, and a shipped Flutter build.',
    approach:
      'Set KPIs for activation, flow completion, and notification engagement, then reordered the backlog based on interviews and usage.',
    stack: ['Flutter', 'User research', 'KPIs'],
  },

  // Projects
  {
    id: 'helio',
    image: '/work/helio.webp',
    title: 'Helio',
    line: 'A voice AI tutor that teaches math and science on a live whiteboard.',
    kind: 'project',
    featured: true,
    year: '2026',
    role: 'Founder',
    overview:
      'Helio is a live tutor in place of a lesson video. Students talk to it and interrupt whenever they want. It explains out loud while it writes, draws, and animates on an unlimited whiteboard, with the voice and the ink in sync.',
    problem:
      'A tutor that talks and draws at the same time has to keep voice, ink, and reasoning in step without lag. It can’t say anything wrong, and it has to be safe for kids.',
    approach:
      'A Rust core compiled to WebAssembly runs the board, layout, and handwriting. Every claim gets checked before it is spoken. A provider layer lets me swap model and voice vendors. The design came from 18 research reports and seven rounds of review.',
    results: [
      'Speech and handwriting synced word by word',
      'Claims checked before they are spoken',
      'Accounts for students, parents, teachers, and districts',
    ],
    stack: ['Rust', 'WebAssembly', 'TypeScript', 'Cloudflare', 'Supabase'],
    links: { live: 'https://helio.education' },
  },
  {
    id: 'surf',
    image: '/work/surf.webp',
    title: 'Surf',
    line: 'A social platform I have been building since 2022.',
    kind: 'project',
    featured: true,
    year: '2022 to now',
    role: 'Founder',
    overview:
      'Surf has feeds, posts, shorts with a video editor in the browser, messaging and calls, live streaming, creator analytics, subscriptions, and family controls. One Next.js codebase runs the web app and the iOS and Android apps.',
    problem:
      'A whole social product built by one person. Design, engineering, safety, and infrastructure all land on me.',
    approach:
      'This is the fourth version, rebuilt on Next.js and Supabase. Database access rules are tested against a live database. Every release has to pass type checks, lint, unit tests, and end-to-end tests.',
    results: [
      '150+ routes on web, iOS, and Android',
      'Shorts, live streaming, and calls',
      'Moderation and family controls built in',
    ],
    stack: ['Next.js', 'React', 'TypeScript', 'Supabase', 'Capacitor'],
    links: { live: 'https://surfsocial.org' },
  },
  {
    id: 'surf-messenger',
    image: '/work/surf-messenger.webp',
    title: 'Surf Messenger',
    line: 'Surf’s messaging as its own app, on Mac, Windows, and phones.',
    kind: 'project',
    featured: true,
    year: '2026',
    role: 'Founder',
    overview:
      'Surf Messenger takes Surf’s messaging and calls and makes them a separate app. It runs on macOS and Windows and on phones, on the same backend as Surf.',
    approach:
      'Electron for the desktop builds and Capacitor on mobile. Every version loads the same web app, so a change ships to all of them at once.',
    stack: ['Electron', 'Capacitor', 'Next.js', 'Supabase'],
    links: {
      live: 'https://surfmessenger.com',
      github: 'https://github.com/zkortam/SurfMessengerDesktop',
    },
  },
  {
    id: 'spice-plus-plus',
    image: '/work/spice-plus-plus.webp',
    title: 'SPICE++',
    line: 'A circuit simulator in the browser, written from scratch.',
    kind: 'project',
    featured: true,
    year: '2025 to now',
    role: 'Creator',
    overview:
      'SPICE++ is an LTspice replacement that runs in the browser. It has a schematic editor, a waveform viewer, and a simulation engine I wrote myself in TypeScript.',
    problem:
      'A real SPICE engine is hard numerical work. It also has to open the files engineers already use.',
    approach:
      'A modified nodal analysis solver with operating point, DC sweep, transient, and AC analysis, plus diode, MOSFET, and op-amp models. An AI assistant can place parts, wire them, run the simulation, and debug the circuit. It imports and exports SPICE, LTspice, KiCad, and Verilog.',
    results: [
      '.op, .dc, .tran, and .ac analysis',
      'AI assistant with 15+ circuit tools',
      'Checked against UCSD ECE coursework',
    ],
    stack: ['TypeScript', 'Azure OpenAI', 'Supabase', 'Stripe'],
    links: { live: 'https://www.spicepp.com' },
  },
  {
    id: 'airofind',
    image: '/work/airofind.webp',
    title: 'AiroFind',
    line: 'A fast, quiet flight search.',
    kind: 'project',
    featured: true,
    year: '2026',
    role: 'Creator',
    overview:
      'AiroFind is a flight search with a plain black interface that keeps out of the way of the results.',
    problem: 'Most flight search sites are slow and crowded with clutter.',
    approach:
      'A Next.js front end on Vercel, with a fare scraper running on its own Azure VM.',
    stack: ['Next.js', 'Three.js', 'Framer Motion', 'Azure'],
    links: { live: 'https://airofind.com' },
  },
  {
    id: 'documap-ai',
    title: 'Documap',
    line: 'Contract analysis. Won the SAG-AFTRA Challenge at Stanford Law.',
    kind: 'project',
    featured: false,
    year: '2025',
    role: 'Creator',
    overview:
      'Documap reads contracts and pulls out clauses, defined terms, and what changed between versions. I owned it from the first idea to the demo.',
    approach:
      'Claude with LangChain retrieval over ChromaDB, a FastAPI backend, and a Next.js front end. I measured it on accuracy and on how often reviewers agreed with it.',
    results: [
      'Won the SAG-AFTRA Challenge',
      'Top 5 at the 2025 Stanford Law LLM Hackathon',
      'Acquisition interest from Davis Wright Tremaine',
    ],
    stack: ['Python', 'FastAPI', 'LangChain', 'ChromaDB', 'Next.js'],
  },
  {
    id: 'closingthedivide',
    title: 'ClosingTheDivide',
    line: 'A nonprofit putting computers in classrooms. I was COO.',
    kind: 'project',
    featured: false,
    year: '2021 to 2025',
    role: 'Chief Operating Officer',
    overview:
      'ClosingTheDivide is a 501(c)(3) that gets computers to students who don’t have them. As COO I ran operations across 20+ branches and 185 volunteers.',
    results: [
      '1,350+ computers donated',
      '$285K raised',
      '12 computer labs in other countries',
    ],
    stack: ['Operations', 'Fundraising', 'Curriculum'],
    links: { live: 'https://closingthedivide.foundation' },
  },
  {
    id: 'alex-ai',
    title: 'Alex AI',
    line: 'Picks a business structure and files the paperwork. 1st at TedAI × Microsoft.',
    kind: 'project',
    featured: false,
    year: '2023',
    role: 'Lead Developer',
    overview:
      'Alex recommends a business structure from a founder’s goals, then fills out and submits the formation documents.',
    results: ['1st place, 2023 TedAI × Microsoft Hackathon, San Francisco'],
    stack: ['GPT-4', 'Python'],
  },
  {
    id: 'nexus-robot',
    title: 'Nexus',
    line: 'A path-following robot on Arduino with vision and PID control.',
    kind: 'project',
    featured: false,
    year: '2025',
    role: 'Creator',
    overview:
      'An Arduino robot that follows a path using RGB sensing, IR and light sensors, and a PID controller I tuned in MATLAB.',
    stack: ['Arduino', 'C/C++', 'MATLAB'],
    links: { live: 'https://nexusrobot.org' },
  },
  {
    id: 'risk-factors-viz',
    title: 'Risk Factors',
    line: 'Pulls risk factors out of SEC filings and graphs how they connect.',
    kind: 'project',
    featured: false,
    year: '2024',
    role: 'Developer',
    overview:
      'Extracts and sorts risk factors from 10-K and 10-Q filings, then draws the links between them as an interactive graph. Built at a Stanford Law hackathon.',
    stack: ['Python', 'LangChain', 'Streamlit', 'NetworkX'],
  },
  {
    id: 'legiscan',
    title: 'Legiscan',
    line: 'Compares a bill to current law and scores how complex it is.',
    kind: 'project',
    featured: false,
    year: '2023',
    role: 'Developer',
    overview:
      'Summarizes what a proposed bill would change compared to current law, with a complexity score. Built at the Stanford Law CodeX hackathon.',
    stack: ['Python', 'GPT-3.5'],
  },
  {
    id: 'clippy-2',
    title: 'Clippy 2.0',
    line: 'Clippy, brought back as a chatbot. 1,200+ users.',
    kind: 'project',
    featured: false,
    year: '2023',
    role: 'Creator',
    overview:
      'A GPT-3.5 chatbot with Clippy’s personality and an old Windows look. It peaked at 1,200+ active users and closed in August 2023.',
    stack: ['JavaScript', 'GPT-3.5'],
  },
  {
    id: 'hypersonic-sprinkler',
    title: 'Hypersonic Sprinkler',
    line: 'A sprinkler that uses oscillators to spread water more evenly.',
    kind: 'project',
    featured: false,
    year: '2020 to 2022',
    role: 'Lead Designer',
    overview:
      'A two-year high school design project. I prototyped and tested a sprinkler that uses oscillators to cover ground more evenly and waste less water.',
    stack: ['Mechanical design', 'Prototyping'],
  },
]

export const work = projects.filter((p) => p.kind === 'work')
export const featuredProjects = projects.filter(
  (p) => p.kind === 'project' && p.featured,
)
export const earlierProjects = projects.filter(
  (p) => p.kind === 'project' && !p.featured,
)
