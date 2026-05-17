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

export const projects: Project[] = [
  {
    id: 'facilis-ai',
    title: 'Facilis - Agentic AI Tools',
    description: 'Building production agentic tools for industrial enterprise customers using MCPs, Node, React, and TypeScript.',
    category: 'AI/ML',
    tags: ['MCP', 'Node.js', 'React', 'TypeScript', 'Agents', 'Enterprise AI'],
    image: '/api/placeholder/400/300',
    featured: true,
    year: '2025',
    role: 'AI Engineer',
    timeline: 'Apr 2025 - Present',
    team: 'Facilis Engineering',
    overview: 'Building agentic tools and AI systems for industrial enterprise customers at Facilis. Working with cutting-edge technologies including Model Context Protocol (MCP), creating intelligent agents that can understand context, make decisions, and interact with complex enterprise systems.',
    challenge: 'Industrial enterprises need AI systems that can understand complex workflows, integrate with existing infrastructure, and make intelligent decisions in real-time. Traditional automation falls short when dealing with the nuanced requirements of industrial operations.',
    solution: 'Developing sophisticated agentic systems using MCPs that enable AI to maintain context across interactions, reason about complex scenarios, and take autonomous actions within defined parameters. Built using modern stack (Node.js, React, TypeScript) to ensure scalability and maintainability.',
    impact: [
      'Deployed AI agents serving industrial enterprise customers',
      'Implemented Model Context Protocol for intelligent agent systems',
      'Built production-grade tools with React and TypeScript',
      'Enabled autonomous decision-making in enterprise workflows'
    ],
    technologies: ['MCP', 'Node.js', 'React', 'TypeScript', 'AI Agents', 'Enterprise Systems', 'REST APIs'],
    links: {
      live: 'https://facilis.ai',
    },
  },
  {
    id: 'surf',
    title: 'Surf',
    description: 'Cross-platform social application with 2.5+ years of development. Founder-led product with AI-powered content moderation and recommendations.',
    category: 'Product Engineering',
    tags: ['Flutter', 'GPT-4', 'YOLOv8', 'Supabase', 'Flask'],
    image: '/api/placeholder/400/300',
    featured: true,
    year: '2022-2025',
    role: 'Founder & Lead Engineer',
    timeline: 'Aug 2022 - Mar 2025',
    team: 'Founded and developed solo',
    overview: 'Surf is a cross-platform social application built from the ground up with modern AI capabilities. Developed using Flutter and Dart for iOS, Android, and Web with a scalable Flask backend and Supabase infrastructure.',
    challenge: 'Building a production-ready social platform as a solo founder requires balancing feature development, scalability, content safety, and user experience across multiple platforms. Modern social apps need intelligent content moderation and personalization while maintaining performance and data privacy.',
    solution: 'Developed a full-stack cross-platform application using Flutter and Dart, ensuring consistent performance and user experience across iOS, Android, and Web. Built scalable backend with Flask and Supabase (Postgres) for API management and real-time data syncing. Established CI/CD pipeline using Codemagic for automated building, testing, and deployment. Implemented content recommendation algorithms and semantic search with Supabase vector database and custom embeddings. Integrated GPT-4 for text processing and YOLOv8 for image content analysis. Ensured data privacy and security by adhering to enterprise standards.',
    impact: [
      '2.5+ years of continuous development and iteration',
      'Full-stack cross-platform support (iOS, Android, Web)',
      'Real-time AI content moderation with GPT-4 and YOLOv8',
      'Intelligent recommendation engine with semantic search',
      'Complete CI/CD pipeline with automated testing',
      'Enterprise-grade security and data privacy'
    ],
    technologies: ['Flutter', 'Dart', 'GPT-4', 'YOLOv8', 'Flask', 'Python', 'Supabase', 'PostgreSQL', 'Firebase', 'Codemagic', 'Vector Database', 'REST APIs'],
    links: {
      live: 'https://surfsocial.org',
    },
  },
  {
    id: 'documap-ai',
    title: 'Documap.ai',
    description: 'AI-powered contract analysis platform. Top 5 finalist in 2025 Stanford Law LLM Hackathon and won SAG AFTRA challenge.',
    category: 'AI/ML',
    tags: ['LLM', 'Contract Analysis', 'Legal Tech'],
    image: '/api/placeholder/400/300',
    featured: false,
    year: '2025',
    role: 'Developer',
    timeline: 'Apr 2025 - Present',
    team: 'Hackathon Team',
    overview: 'AI-powered contract analysis platform that uses large language models to analyze legal documents in seconds. Competed at the 2025 Stanford Law LLM Hackathon, finishing as a Top 5 finalist and winning the SAG AFTRA challenge.',
    challenge: 'Legal contract review is time-intensive and requires specialized expertise. Lawyers spend hours analyzing contracts for key clauses, risks, and obligations. This creates bottlenecks and increases costs for businesses and individuals alike.',
    solution: 'Built an intelligent system that leverages LLMs to automatically parse, analyze, and extract critical information from contracts. The platform identifies key terms, highlights potential risks, and generates plain-language summaries accessible to non-lawyers.',
    impact: [
      'Top 5 finalist in 2025 Stanford Law LLM Hackathon',
      'Won SAG AFTRA challenge for legal tech innovation',
      'Automated contract analysis from hours to seconds',
      'Made legal document review accessible to non-specialists'
    ],
    technologies: ['GPT-4', 'LangChain', 'React', 'Python', 'NLP', 'Legal Tech'],
    links: {
      live: 'https://documap.ai',
    },
  },
  {
    id: 'incorta-dashboards',
    title: 'Incorta - Data Visualization Platform',
    description: 'Full-stack visual components and interactive dashboards enhancing data visualization capabilities for enterprise customers.',
    category: 'Product Engineering',
    tags: ['React', 'Node.js', 'TypeScript', 'Data Viz', 'Jest'],
    image: '/api/placeholder/400/300',
    featured: true,
    year: '2024-2025',
    role: 'Product Development Intern',
    timeline: 'Jun 2024 - Mar 2025',
    team: 'Incorta Engineering',
    overview: 'Developed full-stack visual components and interactive dashboards for Incorta\'s data visualization platform. Built dynamic tables, charts, and analytics features used by enterprise customers worldwide.',
    challenge: 'Enterprise customers need powerful, flexible data visualization tools that can handle complex datasets while remaining intuitive. Building reusable, performant components that work across diverse use cases requires careful design and engineering.',
    solution: 'Developed full-stack visual components and interactive dashboards using React, Node, and TypeScript. Built dynamic tables and charts (sparklines, bar charts, dot plots) with advanced features like grouping, conditional formatting, and comparative analysis across time frames and dimensions. Contributed to Incorta AI Copilot by integrating REST APIs and working extensively with JSON data. Managed the end-to-end development lifecycle, including UI/UX design, front-end and back-end development, customer collaboration, and publication. Implemented comprehensive unit testing using Jest.',
    impact: [
      'Deployed to enterprise customers worldwide',
      'Built reusable visual components and charts',
      'Contributed to Incorta AI Copilot features',
      'End-to-end ownership of features from design to deployment',
      'Comprehensive testing with Jest for code reliability'
    ],
    technologies: ['React', 'Node.js', 'TypeScript', 'JavaScript', 'Jest', 'REST APIs', 'JSON', 'Data Visualization', 'SDKs'],
    links: {
      live: 'https://incorta.com',
    },
  },
  {
    id: 'closingthedivide',
    title: 'ClosingTheDivide - Global Tech Access',
    description: 'Multi-national 501(c)(3) nonprofit expanding technological access. Led team that donated 1,350+ computers, raised $285K, and established 12 international computer labs.',
    category: 'Product Engineering',
    tags: ['Leadership', 'Nonprofit', 'C++', 'Java', 'Education'],
    image: '/api/placeholder/400/300',
    featured: true,
    year: '2021-2025',
    role: 'Chief Operating Officer',
    timeline: 'Sep 2021 - Feb 2025',
    team: '185 volunteers worldwide, 20+ branches',
    overview: 'Led a multi-national 501(c)(3) nonprofit dedicated to expanding technological access globally. Managed hundreds of volunteers across 20+ branches worldwide, establishing computer labs and educational programs in underserved communities.',
    challenge: 'The digital divide prevents millions from accessing technology and technical education. Bridging this gap requires coordinating international operations, fundraising, logistics, and developing accessible educational content for diverse communities.',
    solution: 'Built and scaled a global nonprofit organization from the ground up. Coordinated donation programs that collected and distributed over 1,350 computers. Raised $285K by connecting with government, philanthropic, and independent donors. Established 12 computer labs internationally. Developed a C++ curriculum designed to teach programming to those with limited tech experience, currently being deployed in Morocco. Created simple mobile apps in Java for tech-novice users. Managed supply chain, volunteer coordination, and international operations across 20 branches and 185 volunteers.',
    impact: [
      'Over 1,350 computers donated to underserved communities',
      '$285K raised from government and philanthropic sources',
      '12 international computer labs established',
      '20+ branches and 185 volunteers worldwide',
      'Hardware/software educational programs launched internationally',
      'Custom C++ curriculum deployed in Morocco',
      'Developed accessible mobile apps in Java'
    ],
    technologies: ['C++', 'Java', 'Mobile Development', 'Project Management', 'Supply Chain', 'Curriculum Development'],
    links: {
      live: 'https://closingthedivide.foundation',
    },
  },
  {
    id: 'risk-factors-viz',
    title: 'Risk Factors Visualization',
    description: 'Stanford Law School hackathon project automating risk factor analysis in SEC filings (10-K and 10-Q) using NLP and interactive graph visualization.',
    category: 'AI/ML',
    tags: ['LangChain', 'GPT-3.5', 'Streamlit', 'NetworkX', 'PyVis', 'Figma'],
    image: '/api/placeholder/400/300',
    featured: false,
    year: '2024',
    role: 'Developer',
    timeline: 'Apr 2024',
    team: 'Greg Tanaka, Han-chung Lee, Giuseppina D\'Auria, Yassin Kortam',
    overview: 'Developed a Risk Factors Visualization Tool during Stanford Law School hackathon to automate risk factor analysis in SEC filings. Automated extraction and categorization of risk factors from legal documents with interactive graph visualization.',
    challenge: 'SEC filings (10-K and 10-Q) contain critical risk information buried in dense legal text spanning hundreds of pages. Investors and analysts need to quickly understand risk relationships and dependencies across multiple filings, but manual analysis is time-consuming and prone to missing important connections.',
    solution: 'Utilized NLP with LangChain\'s GPT-3.5-turbo model to extract and categorize risk factors from legal documents. Parsed data from the SEC EDGAR database using BeautifulSoup for data extraction. Implemented graph visualization of risk factor relationships using NetworkX and PyVis, rendered within a Streamlit web app for interactive exploration. Ensured secure environment configuration with python-dotenv for managing sensitive information. Designed user experience in Figma.',
    impact: [
      'Automated risk factor extraction from SEC filings',
      'Reduced analysis time from hours to minutes',
      'Interactive network graphs showing risk relationships',
      'Comparative risk analysis across multiple companies',
      'Recognized at Stanford Law School Hackathon'
    ],
    technologies: ['Python', 'LangChain', 'GPT-3.5', 'Streamlit', 'NetworkX', 'PyVis', 'BeautifulSoup', 'Figma', 'SEC EDGAR API'],
  },
  {
    id: 'alex-ai',
    title: 'Alex AI',
    description: 'Winner of 2023 TedAI & Microsoft Hackathon in San Francisco. AI-powered business creation tool that identifies optimal business structures and auto-fills documents.',
    category: 'AI/ML',
    tags: ['GPT-4', 'Business Automation', 'Document Processing'],
    image: '/api/placeholder/400/300',
    featured: false,
    year: '2023',
    role: 'Lead Developer',
    timeline: 'Oct 2023',
    team: '2 members',
    overview: 'Alex AI is an AI-powered business creation tool that creates your business for you by identifying the optimal business structure and creating a checklist of documents you need filled, which it auto-fills and submits for you. Provides business management support using GPT-4.',
    challenge: 'Starting a business involves complex decisions about entity structure (LLC, C-Corp, S-Corp, etc.) and requires extensive paperwork. Entrepreneurs often make costly mistakes or pay expensive legal fees for basic formation tasks, creating barriers to entry for first-time founders.',
    solution: 'Developed an AI-powered assistant that asks targeted questions about business goals, then recommends optimal entity structures based on tax implications, liability protection, and growth plans. Implemented GPT-4 integration to automatically generate and fill formation documents, operating agreements, and compliance checklists tailored to specific jurisdictions. The system handles document submission and provides ongoing business management support.',
    impact: [
      'Won 1st place at 2023 TedAI & Microsoft Hackathon in San Francisco',
      'Reduced business formation time from weeks to hours',
      'Automated complex legal document generation and submission',
      'Made business formation accessible to non-technical founders',
      'Ongoing business management support post-formation'
    ],
    technologies: ['GPT-4', 'Python', 'Document Generation', 'API Integration', 'NLP'],
  },
  {
    id: 'pixal',
    title: 'Pixal',
    description: 'Slack application implementing generative AI in workspaces. Developed during Adobe Career Academy apprenticeship.',
    category: 'Tools',
    tags: ['JavaScript', 'Python', 'Slack API', 'Generative AI', 'Product Development'],
    image: '/api/placeholder/400/300',
    featured: false,
    year: '2023',
    role: 'Developer',
    timeline: 'Aug 2023 - Sep 2023',
    team: 'Solo project during Adobe apprenticeship',
    overview: 'Pixal is a Slack application that implements generative AI in workspaces. It connects data from your workspace to its knowledge base to answer any question regarding any subject from your Slack workspace.',
    challenge: 'Teams struggle to find information scattered across Slack channels, threads, and shared documents. Questions get repeated, institutional knowledge is lost, and productivity suffers when information is difficult to locate. Traditional keyword search misses contextual understanding.',
    solution: 'Built a Slack app that integrates with workspace data to create a searchable knowledge base powered by generative AI. Users can ask questions in natural language, summarizing discussions, finding timestamps, understanding individual perspectives, or identifying who certain individuals are, and Pixal answers based on all public data in the Slack workspace. Developed, tested, and debugged using Python and JavaScript, presented to Adobe staff during the Adobe Career Academy program.',
    impact: [
      'Seamlessly integrated into existing Slack workflows',
      'Automated knowledge retrieval from workspace conversations',
      'Improved team knowledge sharing and onboarding',
      'Presented to Adobe staff as part of Adobe Career Academy',
      'Processed queries from summarization to individual identification'
    ],
    technologies: ['JavaScript', 'Python', 'Node.js', 'Slack API', 'Generative AI', 'Product Development'],
  },
  {
    id: 'legiscan',
    title: 'Legiscan',
    description: 'Stanford Law School / CODEX LLM hackathon project. Compares proposed legislation against status quo using GPT-3.5.',
    category: 'AI/ML',
    tags: ['GPT-3.5', 'Legal Tech', 'NLP', 'Policy Analysis'],
    image: '/api/placeholder/400/300',
    featured: false,
    year: '2023',
    role: 'Developer',
    timeline: 'Sep 2023',
    team: 'Solo project',
    overview: 'Software that implements the GPT-3.5 LLM to compare proposed legislation against the status quo in order to return a summary, concise overview of the net-change, as well as a complexity index score to the user.',
    challenge: 'Legislative bills are written in complex legal language and can be hundreds of pages long. Citizens and policymakers struggle to understand what bills actually do and how they differ from existing laws. Comparing proposed legislation to current law is time-consuming and requires legal expertise.',
    solution: 'Developed an NLP system using GPT-3.5 to analyze legislative text and generate plain-language summaries. Implemented comparison features that highlight key differences between proposed legislation and status quo. Created a complexity index that scores bills based on readability, legal terminology density, and structural complexity. Built for the Stanford Law School / CODEX LLM hackathon.',
    impact: [
      'Made legislation more accessible to general public',
      'Automated comparison between proposed and existing law',
      'Provided objective complexity metrics for legislative review',
      'Generated concise net-change summaries',
      'Developed at Stanford Law School / CODEX LLM hackathon'
    ],
    technologies: ['Python', 'GPT-3.5', 'NLP', 'Text Analysis', 'LangChain'],
  },
  {
    id: 'nexus-robot',
    title: 'Nexus - Autonomous Robot',
    description: 'Autonomous robot system developed for ECE 5 at UC San Diego with advanced navigation and control systems.',
    category: 'Research/Academic',
    tags: ['Robotics', 'Controls', 'Embedded Systems', 'UC San Diego'],
    image: '/api/placeholder/400/300',
    featured: false,
    year: '2025',
    role: 'Developer',
    timeline: 'Feb 2025 - Mar 2025',
    team: 'Course project',
    overview: 'Autonomous robot system developed for ECE 5 (Intro to ECE) at UC San Diego. Designed and built a robot capable of autonomous navigation, obstacle avoidance, and task completion.',
    challenge: 'Autonomous navigation in dynamic environments requires real-time sensor processing, path planning, and precise motor control. The robot needed to handle unexpected obstacles while maintaining stable operation and completing assigned tasks within course requirements.',
    solution: 'Developed embedded control systems using C/C++ for real-time sensor processing and motor control. Implemented control algorithms for precise movement and sensor fusion combining ultrasonic, infrared, and other sensor data. Created navigation algorithms for autonomous path planning and obstacle avoidance.',
    impact: [
      'Successfully completed ECE 5 autonomous robot project',
      'Demonstrated autonomous navigation and obstacle avoidance',
      'Real-time sensor processing and control',
      'Hands-on experience with embedded systems at UC San Diego'
    ],
    technologies: ['C/C++', 'Embedded Systems', 'Control Systems', 'Sensor Fusion', 'Arduino', 'Motor Control', 'Robotics'],
    links: {
      live: 'https://nexusrobot.org',
    },
  },
  {
    id: 'clippy-2',
    title: 'Clippy 2.0',
    description: 'Humorous chatbot bringing Microsoft\'s Clippy back to life using GPT-3.5. Achieved 1,200+ active users before closure in August 2023.',
    category: 'Tools',
    tags: ['GPT-3.5', 'Chatbot', 'JavaScript', 'Product Launch'],
    image: '/api/placeholder/400/300',
    featured: false,
    year: '2023',
    role: 'Creator & Developer',
    timeline: 'Apr 2023 - Aug 2023',
    team: 'Solo project',
    overview: 'A viral chatbot that brought Microsoft\'s iconic Clippy assistant back to life with modern AI capabilities. Combined nostalgia with cutting-edge language models to create an engaging user experience.',
    challenge: 'Create a chatbot that captures Clippy\'s iconic personality while providing actually useful assistance powered by modern AI. The challenge was balancing humor with utility and building viral appeal that would resonate with users who remembered the original assistant.',
    solution: 'Built a GPT-3.5 powered chatbot with carefully crafted system prompts that embody Clippy\'s personality: helpful, slightly annoying, and endearingly persistent. Created a web interface with nostalgic Windows aesthetics. Implemented conversation memory and context awareness to maintain engaging interactions.',
    impact: [
      'Over 1,200 active users at peak',
      'Viral spread across social media',
      'Featured in tech blogs and newsletters',
      'Demonstrated product-market fit for AI nostalgia products',
      'Closed in August 2023'
    ],
    technologies: ['JavaScript', 'GPT-3.5', 'Node.js', 'OpenAI API', 'Web Development'],
  },
  {
    id: 'hypersonic-sprinkler',
    title: 'Hypersonic Sprinkler System',
    description: 'Environmentally friendly hypersonic sprinkler system developed through the use of oscillators.',
    category: 'Research/Academic',
    tags: ['Engineering', 'Sustainability', 'Mechanical Design', 'Environmental'],
    image: '/api/placeholder/400/300',
    featured: false,
    year: '2020-2022',
    role: 'Lead Designer & Engineer',
    timeline: 'May 2020 - Jun 2022',
    team: 'Silver Creek High School project',
    overview: 'Development of an environmentally friendly hypersonic sprinkler system through the use of oscillators. Multi-year engineering project focused on sustainable water distribution.',
    challenge: 'Traditional sprinkler systems are inefficient, wasting significant amounts of water through evaporation and poor distribution patterns. Creating a more efficient system required innovative engineering approaches to water delivery.',
    solution: 'Designed and prototyped a hypersonic sprinkler system utilizing oscillators to improve water distribution efficiency. Focused on environmentally friendly design principles to reduce water waste while maintaining effective coverage. Iteratively tested and refined the system over two years.',
    impact: [
      '2-year development and testing period',
      'Improved water distribution efficiency',
      'Environmentally sustainable design',
      'Hands-on engineering experience in mechanical systems'
    ],
    technologies: ['Mechanical Engineering', 'Oscillators', 'Prototyping', 'Sustainability Engineering'],
  },
]

export const categories = ['All', 'AI/ML', 'Product Engineering', 'Research/Academic', 'Tools'] as const
