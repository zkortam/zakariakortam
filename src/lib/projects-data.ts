export interface Project {
  id: string
  title: string
  description: string
  category: 'AI/ML' | 'Product Engineering' | 'Research/Academic' | 'Tools'
  tags: string[]
  image: string
  featured: boolean
  year: string
  role?: string
  timeline?: string
  team?: string
  overview: string
  challenge?: string
  solution?: string
  impact?: string[]
  technologies: string[]
  links?: {
    live?: string
    github?: string
    demo?: string
  }
}

const PLACEHOLDER = '/api/placeholder/400/300'

/** Branded tile. Swap in a real logo by replacing public/roles/<id>.svg. */
const roleTile = (id: string) => `/roles/${id}.svg`

export const projects: Project[] = [
  // ---------- WORK (resume experience) ----------
  {
    id: 'facilis-ai',
    title: 'FacilisAI',
    description:
      'Founding engineer building the agentic platform that connects plant systems (PLCs, MES, SCADA) to specialized AI agents.',
    category: 'AI/ML',
    tags: ['AI Agents', 'MCP', 'TypeScript', 'Node.js', 'Edge SLMs'],
    image: roleTile("facilis-ai"),
    featured: true,
    year: '2025',
    role: 'Founding AI Engineer',
    timeline: 'Apr 2025 to Present',
    team: 'FacilisAI, San Jose',
    overview:
      'Founding AI Engineer at FacilisAI. Architected and built the flagship agentic platform that connects plant systems (PLCs, MES, SCADA) to specialized AI agents, turning month-long operational work into hours through chat and scheduled background tasks.',
    challenge:
      'Industrial operators run critical workflows across air-gapped, OT-constrained systems that generic cloud AI cannot reach. The work is slow, manual, and locked behind legacy interfaces.',
    solution:
      'Owned the agent architecture and integrations end to end, then led 0-to-1 discovery across 15+ customer interviews to shape the ICP, roadmap, and positioning. Shipped on-prem and air-gapped deployments with edge-SLM packaging for OT environments, and ran demos and enterprise sales.',
    impact: [
      'Deployed to 20 enterprise demo testers including MEAU and OKI',
      'Secured $100K+ in provisional contracts with ~100% retention',
      'Cut month-long operational tasks down to hours',
      'Shipped on-prem, air-gapped, edge-SLM deployment',
    ],
    technologies: [
      'AI Agents',
      'MCP',
      'TypeScript',
      'Node.js',
      'React',
      'Edge SLMs',
      'PLC / MES / SCADA',
    ],
    links: { live: 'https://facilis.ai' },
  },
  {
    id: 'incorta-dashboards',
    title: 'Incorta',
    description:
      'Built the schema interpreters and charting library behind Incorta’s AI Copilot dashboards, and shipped 5+ features end to end.',
    category: 'Product Engineering',
    tags: ['TypeScript', 'React', 'SQL', 'Jest', 'GitHub Actions'],
    image: roleTile("incorta-dashboards"),
    featured: true,
    year: '2024-2025',
    role: 'Product Engineering Intern',
    timeline: 'Jul 2024 to Mar 2025',
    team: 'Incorta, San Mateo',
    overview:
      'Product Engineering Intern at Incorta. Built TypeScript schema interpreters that turn JSON specs into streamed visualizations for the AI Copilot dashboard, plus a dynamic charting library on SQL and schema data.',
    challenge:
      'The AI Copilot had to render trustworthy, fast visualizations from model-generated specs over enterprise data, with the access controls and reliability enterprise customers require.',
    solution:
      'Shipped 5+ features end to end: PRDs, design reviews in Figma, QA, and rollout. Built a GitHub Actions CI pipeline (Jest, shell) at 90%+ coverage, defined adoption, completion, and latency metrics, and embedded RBAC, audit logging, and accessibility into release readiness.',
    impact: [
      'Powered the AI Copilot dashboard from JSON spec to streamed charts',
      'Shipped a charting library: tables, sparklines, time-series',
      '90%+ test coverage via GitHub Actions CI',
      'Defined adoption, completion, and latency metrics',
    ],
    technologies: [
      'TypeScript',
      'React',
      'SQL',
      'Jest',
      'GitHub Actions',
      'Figma',
    ],
    links: { live: 'https://incorta.com' },
  },
  {
    id: 'adobe',
    title: 'Adobe',
    description:
      'Built a Slack-native generative AI app with RAG, RBAC, and audit logging for semantic search over workspace data.',
    category: 'AI/ML',
    tags: ['Node.js', 'Slack Bolt', 'RAG', 'Vector Search'],
    image: roleTile("adobe"),
    featured: false,
    year: '2023',
    role: 'Technical Intern',
    timeline: 'Jun 2023 to Aug 2023',
    team: 'Adobe, San Jose',
    overview:
      'Technical Intern at Adobe. Built a Slack-native generative AI app on Node.js and Slack Bolt that brings retrieval-augmented answers into the workspace with enterprise controls.',
    challenge:
      'Knowledge inside a large Slack workspace is scattered and unsearchable, and any AI layer over it has to respect role-based access and leave an audit trail.',
    solution:
      'Implemented a vector store for semantic search over Slack data with natural-language Q&A and thread summarization, wrapped in RBAC and audit logging.',
    impact: [
      'Slack-native GenAI app with RAG over workspace data',
      'RBAC and audit logging for enterprise use',
      'Natural-language Q&A and thread summarization',
    ],
    technologies: ['Node.js', 'Slack Bolt', 'RAG', 'Vector Search', 'OpenAI'],
  },
  {
    id: 'inqueue',
    title: 'Inqueue',
    description:
      'Owned a mobile queuing app from discovery to launch: market research, core journeys, and a shipped Flutter MVP.',
    category: 'Product Engineering',
    tags: ['Flutter', 'Product', 'KPIs', 'User Research'],
    image: roleTile("inqueue"),
    featured: false,
    year: '2023',
    role: 'Product Intern',
    timeline: 'Jun 2023 to Oct 2023',
    team: 'Inqueue',
    overview:
      'Product Intern at Inqueue. Owned MVP discovery through launch for a mobile queuing app, from market research and core user journeys to a shipped Flutter build.',
    challenge:
      'A new queuing product needed a focused MVP and a real way to tell whether the core flow worked for users.',
    solution:
      'Defined KPIs for activation, core-flow completion, and notification engagement, and reprioritized the backlog from interviews and signals. Partnered with design to validate assumptions and embedded trust/safety and accessibility into PRDs and acceptance criteria.',
    impact: [
      'Shipped a Flutter queuing app MVP',
      'Defined activation, completion, and engagement KPIs',
      'Embedded trust/safety and accessibility into the spec',
    ],
    technologies: [
      'Flutter',
      'Product Management',
      'User Research',
      'A/B Testing',
    ],
  },

  // ---------- PROJECTS ----------
  {
    id: 'surf',
    title: 'Surf',
    description:
      'Founder-built AI social platform: 60+ pages in React/TypeScript with a YOLOv8 vision pipeline and Claude RAG recommendations.',
    category: 'Product Engineering',
    tags: ['React', 'TypeScript', 'Flutter', 'YOLOv8', 'Supabase'],
    image: PLACEHOLDER,
    featured: true,
    year: '2022-2025',
    role: 'Founder',
    timeline: '2022 to 2025',
    team: 'Solo, built with Codex',
    overview:
      'An AI-enhanced social platform I designed and shipped solo: 60+ pages and 50+ components in React and TypeScript on Node.js and PostgreSQL, iterated from a Flutter prototype to React for production.',
    challenge:
      'Building a complete social product alone means owning design, engineering, AI, and infrastructure with no team to absorb the surface area.',
    solution:
      'Built a YOLOv8 computer-vision pipeline for image processing and RNNoise audio noise suppression, shipped Claude-powered RAG recommendations on a Supabase vector DB, and ran user research, usability studies, and A/B testing to set unified UX standards. CI/CD via Vercel.',
    impact: [
      '60+ pages and 50+ components, shipped solo',
      'YOLOv8 vision and RNNoise audio AI features',
      'Claude RAG recommendations on a Supabase vector DB',
      '2.5+ years of iteration',
    ],
    technologies: [
      'React',
      'TypeScript',
      'Flutter',
      'Node.js',
      'PostgreSQL',
      'Supabase',
      'YOLOv8',
      'Claude',
      'Vercel',
    ],
    links: { live: 'https://surfsocial.org' },
  },
  {
    id: 'spice-plus-plus',
    title: 'SPICE++',
    description:
      'A SPICE-class circuit simulator built from scratch in TypeScript, with an OpenAI agent that places, wires, runs, and debugs circuits from natural language.',
    category: 'Tools',
    tags: ['Next.js', 'TypeScript', 'OpenAI', 'Simulation'],
    image: PLACEHOLDER,
    featured: true,
    year: '2025',
    role: 'Creator',
    timeline: '2025',
    team: 'Solo',
    overview:
      'A SPICE-class circuit simulator built from scratch: a TypeScript MNA solver with .op, .dc, .tran, and .ac analyses, Newton-Raphson with junction limiting, and MOSFET, diode, and op-amp models.',
    challenge:
      'A real SPICE engine plus an AI layer that can reason about circuits is a deep numerical and tooling problem, and it had to interoperate with the formats engineers actually use.',
    solution:
      'Shipped an OpenAI tool-calling agent with 15+ circuit actions so agents place, wire, run, and debug circuits from natural-language prompts. Implemented round-trip import and export across SPICE, LTspice, KiCad 6+, and Verilog with 40+ tests.',
    impact: [
      'Full MNA solver: .op/.dc/.tran/.ac, Newton-Raphson, device models',
      'OpenAI agent with 15+ circuit actions',
      'Round-trip SPICE / LTspice / KiCad / Verilog, 40+ tests',
      'Verified against UCSD ECE 35/45/65/100/101/102 coursework',
    ],
    technologies: [
      'Next.js',
      'TypeScript',
      'OpenAI',
      'Firebase',
      'Numerical Methods',
    ],
  },
  {
    id: 'documap-ai',
    title: 'Documap',
    description:
      'AI contract analyzer (clauses, defined terms, version diffs) that won the SAG-AFTRA Challenge and placed Top 5 at the 2025 Stanford Law LLM Hackathon.',
    category: 'AI/ML',
    tags: ['Claude', 'LangChain', 'RAG', 'FastAPI'],
    image: PLACEHOLDER,
    featured: true,
    year: '2025',
    role: 'Creator',
    timeline: '2025',
    team: 'Hackathon team',
    overview:
      'An AI contract analyzer that surfaces clauses, defined terms, and version diffs using Claude with LangChain RAG. Owned the MVP from ideation to demo.',
    challenge:
      'Contract review is slow and error-prone, and the real value is catching what changed and what terms actually mean across versions.',
    solution:
      'Built the analyzer on Python and FastAPI with ChromaDB and a Next.js front end, and defined accuracy and reviewer-agreement metrics to evaluate it.',
    impact: [
      'Won the SAG-AFTRA Challenge',
      'Top 5 at the 2025 Stanford Law School LLM Hackathon',
      'Drew acquisition interest from Davis Wright Tremaine LLP',
    ],
    technologies: [
      'Python',
      'FastAPI',
      'ChromaDB',
      'LangChain',
      'Claude',
      'Next.js',
    ],
    links: { live: 'https://documap.ai' },
  },
  {
    id: 'nexus-robot',
    title: 'Nexus',
    description:
      'Autonomous Arduino path-following robot using RGB image processing, audio I/O, and PID control.',
    category: 'Research/Academic',
    tags: ['Arduino', 'C/C++', 'PID Control', 'MATLAB'],
    image: PLACEHOLDER,
    featured: false,
    year: '2025',
    role: 'Creator',
    timeline: '2025',
    team: 'UC San Diego, ECE 5',
    overview:
      'An autonomous path-following robot built on Arduino with RGB image processing, audio I/O, PID control, and photoresistor and IR sensing.',
    challenge:
      'Reliable autonomous path following on constrained Arduino hardware requires tight sensing and control loops.',
    solution:
      'Implemented the vision, sensing, and PID control stack in C/C++ and tuned it with MATLAB.',
    impact: [
      'Autonomous path following on Arduino',
      'RGB vision with IR and photoresistor sensing',
      'PID control tuned in MATLAB',
    ],
    technologies: [
      'Arduino',
      'C/C++',
      'PID Control',
      'MATLAB',
      'Embedded Systems',
    ],
    links: { live: 'https://nexusrobot.org' },
  },
  {
    id: 'closingthedivide',
    title: 'ClosingTheDivide',
    description:
      'Multinational 501(c)(3) expanding tech access: 1,350+ computers donated, $285K raised, 12 international computer labs.',
    category: 'Product Engineering',
    tags: ['Nonprofit', 'Leadership', 'Education', 'C++'],
    image: PLACEHOLDER,
    featured: false,
    year: '2021-2025',
    role: 'Chief Operating Officer',
    timeline: '2021 to 2025',
    team: '185 volunteers, 20+ branches',
    overview:
      'A multinational 501(c)(3) nonprofit expanding technological access. As COO I ran international operations across 20+ branches and 185 volunteers.',
    challenge:
      'Closing the digital divide means coordinating donations, logistics, fundraising, and curriculum across countries.',
    solution:
      'Scaled donation and lab programs, raised funds from government and philanthropic donors, and built a C++ curriculum deployed in Morocco.',
    impact: [
      '1,350+ computers donated',
      '$285K raised',
      '12 international computer labs',
      '20+ branches and 185 volunteers',
    ],
    technologies: ['C++', 'Java', 'Project Management', 'Operations'],
    links: { live: 'https://closingthedivide.foundation' },
  },
  {
    id: 'alex-ai',
    title: 'Alex AI',
    description:
      'Won the 2023 TedAI & Microsoft Hackathon: an AI tool that picks a business structure and auto-fills and submits formation documents.',
    category: 'AI/ML',
    tags: ['GPT-4', 'Automation', 'Documents'],
    image: PLACEHOLDER,
    featured: false,
    year: '2023',
    role: 'Lead Developer',
    timeline: 'Oct 2023',
    team: '2 members',
    overview:
      'An AI tool that recommends an optimal business structure, then generates, fills, and submits the formation documents for it.',
    challenge:
      'Business formation is full of structural decisions and paperwork that block first-time founders.',
    solution:
      'Built a GPT-4 assistant that recommends an entity structure from the founder’s goals and auto-generates jurisdiction-specific documents.',
    impact: [
      '1st place, 2023 TedAI & Microsoft Hackathon, San Francisco',
      'Reduced formation from weeks to hours',
      'Automated legal document generation and submission',
    ],
    technologies: ['GPT-4', 'Python', 'Document Generation', 'NLP'],
  },
  {
    id: 'legiscan',
    title: 'Legiscan',
    description:
      'Stanford Law / CODEX hackathon tool that compares proposed legislation to current law and scores its complexity.',
    category: 'AI/ML',
    tags: ['GPT-3.5', 'Legal Tech', 'NLP'],
    image: PLACEHOLDER,
    featured: false,
    year: '2023',
    role: 'Developer',
    timeline: 'Sep 2023',
    team: 'Solo',
    overview:
      'A tool that compares proposed legislation against the status quo, returning a plain-language net-change summary and a complexity score.',
    challenge:
      'Bills are long and dense, and the real question is how they differ from existing law.',
    solution:
      'Used GPT-3.5 to summarize and diff legislative text and compute a readability and complexity index. Built for the Stanford Law / CODEX LLM hackathon.',
    impact: [
      'Net-change summaries of proposed bills',
      'Objective complexity scoring',
      'Built at the Stanford Law / CODEX LLM hackathon',
    ],
    technologies: ['Python', 'GPT-3.5', 'NLP', 'LangChain'],
  },
  {
    id: 'risk-factors-viz',
    title: 'Risk Factors Visualization',
    description:
      'Stanford Law hackathon tool that extracts SEC 10-K/10-Q risk factors and maps their relationships as an interactive graph.',
    category: 'AI/ML',
    tags: ['LangChain', 'GPT-3.5', 'Streamlit', 'NetworkX'],
    image: PLACEHOLDER,
    featured: false,
    year: '2024',
    role: 'Developer',
    timeline: 'Apr 2024',
    team: 'Stanford Law hackathon',
    overview:
      'Automates risk-factor analysis in SEC filings (10-K, 10-Q): extraction, categorization, and an interactive relationship graph.',
    challenge:
      'Risk disclosures are buried across hundreds of pages and hard to compare across companies.',
    solution:
      'Used LangChain and GPT-3.5 to extract and categorize risk factors from EDGAR filings and rendered the relationships with NetworkX and PyVis in a Streamlit app.',
    impact: [
      'Automated SEC risk-factor extraction',
      'Interactive risk relationship graphs',
      'Comparative analysis across companies',
    ],
    technologies: [
      'Python',
      'LangChain',
      'GPT-3.5',
      'Streamlit',
      'NetworkX',
      'PyVis',
    ],
  },
  {
    id: 'clippy-2',
    title: 'Clippy 2.0',
    description:
      'A GPT-3.5 chatbot reviving Microsoft’s Clippy that reached 1,200+ active users before shutting down.',
    category: 'Tools',
    tags: ['GPT-3.5', 'Chatbot', 'JavaScript'],
    image: PLACEHOLDER,
    featured: false,
    year: '2023',
    role: 'Creator',
    timeline: 'Apr 2023 to Aug 2023',
    team: 'Solo',
    overview:
      'A chatbot that brought Clippy back with a GPT-3.5 personality and a nostalgic Windows interface.',
    challenge:
      'Capture Clippy’s character while being genuinely useful and shareable.',
    solution:
      'Built carefully prompted GPT-3.5 with conversation memory and a retro web UI.',
    impact: [
      '1,200+ active users at peak',
      'Spread across social media',
      'Closed August 2023',
    ],
    technologies: ['JavaScript', 'GPT-3.5', 'Node.js', 'OpenAI API'],
  },
  {
    id: 'hypersonic-sprinkler',
    title: 'Hypersonic Sprinkler',
    description:
      'A two-year mechanical design project: a water-efficient sprinkler that uses oscillators to improve distribution.',
    category: 'Research/Academic',
    tags: ['Mechanical Design', 'Sustainability', 'Prototyping'],
    image: PLACEHOLDER,
    featured: false,
    year: '2020-2022',
    role: 'Lead Designer',
    timeline: '2020 to 2022',
    team: 'High school project',
    overview:
      'An environmentally focused sprinkler system using oscillators to improve water distribution efficiency, prototyped and refined over two years.',
    challenge:
      'Conventional sprinklers waste water through evaporation and poor coverage.',
    solution:
      'Designed and iteratively tested an oscillator-based distribution mechanism for efficient coverage.',
    impact: [
      'Two-year design and testing cycle',
      'Improved distribution efficiency',
      'Sustainability-focused mechanical design',
    ],
    technologies: ['Mechanical Engineering', 'Oscillators', 'Prototyping'],
  },
]

export const categories = [
  'All',
  'AI/ML',
  'Product Engineering',
  'Research/Academic',
  'Tools',
] as const

/**
 * Work = professional roles from the resume (employment only). Surf and
 * ClosingTheDivide are projects, not jobs. Single source of truth for the
 * Work / Projects split.
 */
export const WORK_IDS = [
  'facilis-ai',
  'incorta-dashboards',
  'adobe',
  'inqueue',
] as const

export const isWorkProject = (p: Project): boolean =>
  (WORK_IDS as readonly string[]).includes(p.id)
