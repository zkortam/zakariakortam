export const CATEGORIES = ['AI', 'Consumer apps', 'Engineering tools', 'Hardware', 'Hackathons', 'Roles'] as const
export type Category = (typeof CATEGORIES)[number]

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
  /** Categories for browsing the Work page. */
  tags?: Category[]
  /** Measured from the project's repository. */
  stats?: { value: string; label: string }[]
  /** A role page's light, in the company's own hue. */
  accent?: string
  /** The live demo section on the project page. */
  demo?: { title: string; line: string }
}

export const projects: Project[] = [
  // Work
  {
    id: 'digicert',
    accent: '#3D6BF2',
    tags: ['Roles', 'AI'],
    title: 'DigiCert',
    line: 'Product for AI agent trust: identity, authorization, policy, and lifecycle for autonomous agents.',
    kind: 'work',
    featured: true,
    year: 'July 2026 to now',
    role: 'Associate Innovation Product Manager',
    org: 'DigiCert',
    overview:
      'I own product for AI agent trust: how an autonomous agent proves who it is, what it may do, and how its credentials are managed.',
    results: [
      'Defined a DNS-level verification product, so agents only reach approved destinations',
      'Built a Kubernetes Envoy sidecar that enforces each agent’s egress policy',
      'Drove the requirements and policy model across engineering and security',
    ],
    stack: ['AI agent identity', 'Authorization and policy', 'PKI', 'Kubernetes', 'Envoy'],
    links: { live: 'https://www.digicert.com' },
  },
  {
    id: 'facilis-ai',
    accent: '#E8893A',
    tags: ['Roles', 'AI'],
    title: 'FacilisAI',
    line: 'An agentic platform that connects factory systems (PLCs, MES, and SCADA) to AI agents.',
    kind: 'work',
    featured: true,
    year: 'April 2025 to July 2026',
    role: 'Founding AI Engineer',
    org: 'FacilisAI',
    overview:
      'I architected and launched the flagship product: an agentic platform that connects plant systems to AI agents and cuts month-long tasks to hours.',
    results: [
      'Architected the agent platform and its plant integrations',
      'Led discovery for the OT market: ICP, roadmap, and positioning',
      'Owned the enterprise demos and sales cycles',
      'Built and run facilis.ai',
    ],
    stats: [
      { value: '20', label: 'enterprise demo testers' },
      { value: '$100K+', label: 'in provisional contracts' },
      { value: '~100%', label: 'retention' },
      { value: '15+', label: 'customer interviews' },
    ],
    stack: ['TypeScript', 'Node.js', 'React', 'MCP', 'Edge models'],
    links: { live: 'https://facilis.ai' },
  },
  {
    id: 'incorta-dashboards',
    accent: '#8E5CF0',
    tags: ['Roles', 'AI'],
    title: 'Incorta',
    line: 'Shipped features for the Incorta AI Copilot, from PRD to rollout.',
    kind: 'work',
    featured: true,
    year: 'July 2024 to March 2025',
    role: 'Product Engineering Intern',
    org: 'Incorta',
    overview:
      'I shipped AI Copilot features for Incorta, from PRD to rollout.',
    results: [
      'Shipped 5+ Copilot features end to end',
      'Built the interpreters that turn model output into streamed charts',
      'Defined adoption, completion, and latency KPIs',
      'Wrote RBAC, audit logging, and accessibility into release criteria',
    ],
    stack: ['TypeScript', 'React', 'SQL', 'Vitest', 'GitHub Actions', 'Figma'],
    links: { live: 'https://incorta.com' },
  },
  {
    id: 'inqueue',
    accent: '#1BB5A3',
    tags: ['Roles', 'Consumer apps'],
    title: 'Inqueue',
    line: 'Took a mobile queuing app from discovery to a shipped Flutter MVP.',
    kind: 'work',
    featured: true,
    year: 'June to October 2023',
    role: 'Product Intern',
    org: 'Inqueue',
    overview:
      'I took a mobile queuing app from discovery to a shipped Flutter MVP.',
    results: [
      'Shipped the MVP in Flutter',
      'Set KPIs for activation, flow completion, and notifications',
      'Fed usability findings into the roadmap',
    ],
    stack: ['Flutter', 'User research', 'KPIs', 'Usability testing'],
  },

  // Projects
  {
    id: 'helio',
    tags: ['AI', 'Consumer apps'],
    image: '/work/helio.webp',
    title: 'Helio',
    line: 'A voice AI tutor that talks, listens, and teaches math and science on a live whiteboard.',
    kind: 'project',
    featured: true,
    year: '2026',
    role: 'Product, design, and engineering',
    overview:
      'Helio is a live tutor in place of a lesson video. Students talk to it and interrupt whenever they want. It explains out loud while it writes, draws, and animates on an unlimited whiteboard, with the voice and the ink in sync.',
    problem:
      'A tutor that talks and draws at the same time has to keep voice, ink, and reasoning in step without lag. It can’t say anything wrong, and it has to be safe for kids.',
    approach:
      'A Rust core compiled to WebAssembly runs the board, layout, and handwriting. Every claim gets checked before it is spoken. A provider layer lets me swap model and voice vendors.',
    results: [
      'Speech and handwriting synced word by word',
      'Claims checked before they are spoken',
      'Accounts for students, parents, teachers, and districts',
    ],
    stack: ['Rust', 'WebAssembly', 'TypeScript', 'Cloudflare', 'Supabase'],
    links: { live: 'https://helio.education' },
    stats: [
      { value: '262k', label: 'lines of Rust' },
      { value: '3,503', label: 'tests' },
      { value: '1,970', label: 'commits in two weeks' },
      { value: '4', label: 'Rust crates, one core shared by client and server' },
    ],
    demo: { title: 'A lesson on the board', line: 'Helio writes in its own hand while it talks, sweeps the term it is talking about, then hands the pen over and checks the answer.' },
  },
  {
    id: 'surf',
    tags: ['Consumer apps'],
    image: '/work/surf.webp',
    title: 'Surf',
    line: 'A social network with feeds, short video, messaging, and live, on web, iOS, and Android.',
    kind: 'project',
    featured: true,
    year: '2022 to now',
    role: 'Product, design, and engineering',
    overview:
      'Surf has feeds, posts, shorts with a video editor in the browser, messaging and calls, live streaming, creator analytics, subscriptions, and family controls. One Next.js codebase runs the web app and the iOS and Android apps.',
    problem:
      'A social network has to get feeds, video, messaging, safety, and scale right at the same time, and every part has to feel fast.',
    approach:
      'This is the fourth version, rebuilt on Next.js and Supabase. Database access rules are tested against a live database, with type checks, unit tests, and end-to-end tests in CI.',
    results: [
      '150+ routes on web, iOS, and Android',
      'Shorts, live streaming, and calls',
      'Moderation and family controls built in',
    ],
    stack: ['Next.js', 'React', 'TypeScript', 'Supabase', 'Capacitor'],
    links: { live: 'https://surfsocial.org' },
    stats: [
      { value: '823k', label: 'lines of TypeScript' },
      { value: '24,249', label: 'tests' },
      { value: '1,935', label: 'database migrations' },
      { value: '5,969', label: 'commits this year' },
    ],
  },
  {
    id: 'surf-messenger',
    tags: ['Consumer apps'],
    image: '/work/surf-messenger.webp',
    title: 'Surf Messenger',
    line: 'Private messaging with end-to-end encryption, on Mac, Windows, and phones.',
    kind: 'project',
    featured: true,
    year: '2026',
    role: 'Product, design, and engineering',
    overview:
      'Surf Messenger takes Surf’s messaging and calls and makes them a separate app. It runs on macOS and Windows and on phones, on the same backend as Surf.',
    approach:
      'Electron for the desktop builds and Capacitor on mobile. Every version loads the same web app, so a change ships to all of them at once.',
    stack: ['Electron', 'Capacitor', 'Next.js', 'Supabase'],
    links: {
      live: 'https://surfmessenger.com',
      github: 'https://github.com/zkortam/SurfMessengerDesktop',
    },
    stats: [
      { value: 'X3DH', label: 'key agreement' },
      { value: 'Double Ratchet', label: 'a new key for every message' },
      { value: '51', label: 'crypto modules' },
      { value: '4', label: 'platforms: Mac, Windows, iOS, Android' },
    ],
    demo: { title: 'Sealed before it leaves', line: 'Write to Maya and send it. It is sealed in your browser the way Surf Messenger seals it, and next to the phone is everything the server stores.' },
  },
  {
    id: 'spice-plus-plus',
    tags: ['Engineering tools', 'AI'],
    image: '/work/spice-plus-plus.webp',
    title: 'SPICE++',
    line: 'A SPICE circuit simulator written from scratch, running in the browser, with an AI agent built in.',
    kind: 'project',
    featured: true,
    year: '2025 to now',
    role: 'Product, design, and engineering',
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
    stats: [
      { value: '145k', label: 'lines of TypeScript' },
      { value: '21', label: 'device types' },
      { value: '5', label: 'analysis types' },
      { value: '4', label: 'file formats in and out' },
    ],
    demo: { title: 'Run the engine', line: 'SPICE++ itself, in your browser: its example circuits, schematic and waveform dock, solved by its own engine in this tab. Click a part to change its value and the circuit runs again; hover the plot to read it.' },
  },
  {
    id: 'rtl-plus-plus',
    tags: ['Engineering tools'],
    image: '/work/hd/rtlpp-desktop.webp',
    title: 'RTL++',
    line: 'Verilog in the browser, two simulators, and a debugger that tells you why a test failed.',
    kind: 'project',
    featured: true,
    year: '2026',
    role: 'Product, design, and engineering',
    overview:
      'RTL++ is a browser workspace for digital logic. You write Verilog or SystemVerilog, run every test in two simulators, and build for iCE40 and ECP5 FPGAs.',
    problem:
      'Hardware tools are heavy installs, and when a test fails they show a waveform and leave you to work out why.',
    approach:
      'When a test fails, RTL++ traces the wrong value back through the waveform to the line of code that set it, and shows each step of that chain next to the source.',
    results: [
      'Verilog and SystemVerilog, tested in two simulators',
      'Traces any value back to the line that made it',
      'Builds for iCE40 and ECP5 FPGAs',
    ],
    stack: ['TypeScript', 'Verilog', 'WebAssembly', 'FPGA toolchains'],
    links: { live: 'https://rtlpp.vercel.app' },
    stats: [
      { value: '50k', label: 'lines of TypeScript' },
      { value: '2', label: 'simulators on every test' },
      { value: '2', label: 'FPGA families' },
      { value: '93', label: 'commits in two days' },
    ],
    demo: { title: 'Every value has a reason', line: 'A real RTL++ run at the moment a test fails: the line that caused it, the chain of causes and the waveform. Edit the counter and run it again; Icarus Verilog simulates it in this tab.' },
  },
  {
    id: 'airofind',
    tags: ['Consumer apps'],
    image: '/work/airofind.webp',
    title: 'AiroFind',
    line: 'Flight search that prices every date pair around your trip and finds the cheapest.',
    kind: 'project',
    featured: true,
    year: '2026',
    role: 'Product, design, and engineering',
    overview:
      'AiroFind is a flight search with a plain black interface that keeps out of the way of the results.',
    problem: 'Most flight search sites are slow and crowded with clutter.',
    approach:
      'A Next.js front end on Vercel, with a fare scraper running on its own Azure VM.',
    stack: ['Next.js', 'Three.js', 'Framer Motion', 'Azure'],
    links: { live: 'https://airofind.com' },
    stats: [
      { value: '49', label: 'fares priced per grid read' },
      { value: '105', label: 'commits' },
      { value: '1', label: 'scraper on its own Azure VM' },
    ],
    demo: { title: 'Search to cheapest', line: 'The real loading flight and results from a San Francisco to New York search, ported from the app. A real search cruises for about a minute; here it lands in a few seconds.' },
  },
  {
    id: 'documap-ai',
    tags: ['AI', 'Hackathons'],
    title: 'Documap',
    line: 'Contract analysis. Won the SAG-AFTRA Challenge at Stanford Law.',
    kind: 'project',
    featured: false,
    year: '2025',
    role: 'Product, design, and engineering',
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
    id: 'wingman',
    tags: ['AI', 'Engineering tools'],
    title: 'Wingman',
    line: 'Reviews what an AI agent is about to do before it does it.',
    kind: 'project',
    featured: false,
    year: '2026',
    role: 'Co-creator, with Ali Alani',
    overview:
      'Wingman sits where an agent calls its tools. It catches poorly considered actions before they run, learns from the moments a user pushes back, and only keeps a configuration change if it fails before the change and passes after it.',
    stack: ['TypeScript', 'npm SDK'],
    links: { github: 'https://github.com/zkortam/wingman' },
    stats: [
      { value: '537', label: 'tests' },
      { value: '25k', label: 'lines of TypeScript' },
      { value: '0', label: 'third-party runtime dependencies in the SDK' },
    ],
    demo: { title: 'A fix that ships with its proof', line: 'Wingman’s incident screen, ported from its code, with the incident from its own demo: an export that ignored the user’s filters, the assertion that fails 5 of 5 times before a three-line config change and passes 5 of 5 after it. Apply it, then export as each user: only the one who reported it gets the new config.' },
  },
  {
    id: 'robodog',
    tags: ['Hardware', 'AI'],
    title: 'RoboDog',
    line: 'Voice and vision for a robot on an Arduino UNO Q, all running locally.',
    kind: 'project',
    featured: false,
    year: '2026',
    role: 'Developer, UC San Diego ECE 180',
    overview:
      'RoboDog gives a robot a conversational presence. It listens hands free, speaks with local text to speech, recognizes people who have opted in, and reads facial expressions, with the voice and vision stack kept separate from motor control.',
    stack: ['Python', 'OpenCV', 'Arduino UNO Q', 'Cerebras'],
    links: { live: 'https://ece180robodog.vercel.app', github: 'https://github.com/zkortam/ece180robodog' },
  },
  {
    id: 'fridgit',
    tags: ['Consumer apps'],
    title: 'Fridgit',
    line: 'A shared fridge you keep track of by camera, voice, or receipt.',
    kind: 'project',
    featured: false,
    year: '2026',
    role: 'Product, design, and engineering',
    overview:
      'Fridgit tracks what is in a shared fridge. Hold food up to the camera to add or remove it, say what you bought, or scan the receipt, and each item is credited to whoever added it.',
    stack: ['JavaScript', 'Computer vision', 'Speech input'],
    links: { live: 'https://www.fridgit.org' },
  },
  {
    id: 'dealflow',
    tags: ['AI'],
    title: 'DealFlow',
    line: 'An AI agent that prepares you to negotiate salary, software, or rent.',
    kind: 'project',
    featured: false,
    year: '2026',
    role: 'Developer',
    overview:
      'DealFlow researches market data for an offer, a software quote, or a lease, writes the counter-offer and the email, and lets you rehearse the conversation by voice.',
    stack: ['Python', 'FastAPI', 'Claude', 'Toolhouse', 'ElevenLabs', 'Next.js'],
    links: { github: 'https://github.com/zkortam/dealflow' },
  },
  {
    id: 'sentiment-analysis',
    tags: ['AI', 'Engineering tools'],
    title: 'Sentiment Analysis',
    line: 'A real-time sentiment model served on Kubernetes with GitOps.',
    kind: 'project',
    featured: false,
    year: '2025',
    role: 'Product, design, and engineering',
    overview:
      'A FastAPI service that scores the sentiment of text in real time, packaged in Docker and deployed to AWS EKS through GitHub Actions and ArgoCD.',
    stack: ['Python', 'FastAPI', 'scikit-learn', 'Docker', 'Kubernetes', 'AWS'],
    links: { github: 'https://github.com/zkortam/sentiment-analysis-v2' },
  },
  {
    id: 'alex-ai',
    tags: ['AI', 'Hackathons'],
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
    tags: ['Hardware'],
    title: 'Nexus',
    line: 'A line-following robot on Arduino, steered by light sensors and PID. 2nd of 8 on competition day.',
    kind: 'project',
    featured: false,
    year: '2025',
    role: 'Team of four',
    overview:
      'An Arduino robot that follows a track with photoresistors and a PID controller, in a 3D-printed body designed in Onshape. Built as Team 35 with Nicholas Normart, Osezele Omoko, and Abdulrahman Alghamdi.',
    results: ['2nd of 8 on competition day'],
    stack: ['Arduino', 'C++', 'Onshape'],
    links: { live: 'https://nexusrobot.org', github: 'https://github.com/zkortam/Nexus' },
  },
  {
    id: 'risk-factors-viz',
    tags: ['AI', 'Hackathons'],
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
    tags: ['AI', 'Hackathons'],
    title: 'Legiscan',
    line: 'Compares a bill to current law and scores how complex it is.',
    kind: 'project',
    featured: false,
    year: '2023',
    role: 'Developer',
    overview:
      'Summarizes what a proposed bill would change compared to current law, with a complexity score. Built at the Stanford Law CodeX hackathon.',
    stack: ['Flutter', 'FlutterFlow', 'OpenAI'],
    links: { github: 'https://github.com/zkortam/Legiscan' },
  },
  {
    id: 'clippy-2',
    tags: ['AI', 'Consumer apps'],
    title: 'Clippy 2.0',
    line: 'Clippy, brought back as a chatbot. 1,200+ users.',
    kind: 'project',
    featured: false,
    year: '2023',
    role: 'Product, design, and engineering',
    overview:
      'A GPT-3.5 chatbot with Clippy’s personality and an old Windows look. It peaked at 1,200+ active users and closed in August 2023.',
    stack: ['JavaScript', 'GPT-3.5'],
  },
  {
    id: 'hypersonic-sprinkler',
    tags: ['Hardware'],
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
