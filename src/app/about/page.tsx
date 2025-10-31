'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export default function AboutPage() {
  return (
    <main className="min-h-screen pt-16 bg-background">
      {/* Hero Section with Cool Animations - Full Screen */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated Background Stars */}
        <div className="absolute inset-0 opacity-50 pointer-events-none">
          {Array.from({ length: 60 }).map((_, i) => {
            const x = (i * 17.3 + 13) % 100;
            const y = (i * 23.7 + 7) % 100;
            const duration = 2 + (i % 4);
            const delay = (i % 8) * 0.3;
            const size = i % 5 === 0 ? 2 : 1;

            return (
              <motion.div
                key={i}
                className="absolute rounded-full bg-white"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${size}px`,
                  height: `${size}px`,
                }}
                animate={{
                  opacity: [0.3, 1, 0.3],
                  scale: [0.8, 1.2, 0.8],
                }}
                transition={{
                  duration: duration,
                  delay: delay,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            );
          })}
        </div>

        {/* Floating Gradient Orbs */}
        <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute w-96 h-96 rounded-full bg-gradient-to-r from-blue-500/30 to-purple-500/30 blur-3xl"
            animate={{
              x: [0, 100, 0],
              y: [0, -50, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{ left: '10%', top: '20%' }}
          />
          <motion.div
            className="absolute w-80 h-80 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 blur-3xl"
            animate={{
              x: [0, -80, 0],
              y: [0, 60, 0],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{ right: '10%', top: '30%' }}
          />
        </div>

        <div className="relative mx-auto max-w-4xl px-6">
          <div className="space-y-10 text-center">
            {/* Title with letter animation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <motion.h1
                className="text-6xl md:text-7xl lg:text-8xl font-semibold tracking-tight"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                {'About'.split('').map((letter, index) => (
                  <motion.span
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.3 + index * 0.1,
                      ease: "easeOut"
                    }}
                    className="inline-block"
                  >
                    {letter}
                  </motion.span>
                ))}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className="text-xl md:text-2xl text-foreground-muted max-w-3xl mx-auto leading-relaxed"
              >
                AI Engineer building production systems at the intersection of machine learning,
                product engineering, and distributed systems.
              </motion.p>
            </motion.div>

            {/* Multiple animated dividers */}
            <motion.div
              className="flex items-center justify-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "3rem" }}
                transition={{ duration: 0.8, delay: 1.3 }}
                className="h-0.5 bg-foreground/50 rounded-full"
              />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 1.5 }}
                className="w-2 h-2 bg-foreground rounded-full"
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "3rem" }}
                transition={{ duration: 0.8, delay: 1.3 }}
                className="h-0.5 bg-foreground/50 rounded-full"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Content Sections with 50px top padding */}
      <div className="mx-auto max-w-4xl px-6 pb-20" style={{ paddingTop: '50px' }}>
        <div className="space-y-16">
          {/* Current Role */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="space-y-6"
          >
            <h2 className="text-2xl font-semibold tracking-tight">Current</h2>
            <div className="space-y-4 text-foreground-muted leading-relaxed">
              <p>
                AI Engineer at <span className="text-foreground font-medium">Facilis</span>, where I build
                production agentic tools for industrial enterprise customers. My work focuses on AI agent
                orchestration, Model Context Protocol (MCP) implementation, and full-stack development with
                React, TypeScript, and Node.js.
              </p>
              <p>
                Senior at <span className="text-foreground font-medium">UC San Diego</span> pursuing a B.S.
                in Electrical Engineering with specialization in Machine Learning and Controls (2024-2026).
              </p>
            </div>
          </motion.section>

          {/* Experience */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="space-y-8"
          >
            <h2 className="text-2xl font-semibold tracking-tight">Experience</h2>

            <div className="space-y-10">
              {/* Facilis */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-medium">AI Engineer</h3>
                    <div className="text-foreground-muted">Facilis</div>
                  </div>
                  <div className="text-sm text-foreground-subtle whitespace-nowrap">Apr 2025 - Present</div>
                </div>
                <ul className="space-y-2 text-foreground-muted">
                  <li>Building agentic AI tools for industrial enterprise using Model Context Protocol</li>
                  <li>Architecting AI agent orchestration systems with React, TypeScript, and Node.js</li>
                  <li>Designing and implementing production-grade LLM integrations</li>
                </ul>
              </div>

              {/* Incorta */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-medium">Product Development Intern</h3>
                    <div className="text-foreground-muted">Incorta</div>
                  </div>
                  <div className="text-sm text-foreground-subtle whitespace-nowrap">Jun 2024 - Mar 2025</div>
                </div>
                <ul className="space-y-2 text-foreground-muted">
                  <li>Developed full-stack visual components and interactive dashboards</li>
                  <li>Contributed to AI Copilot features for enterprise analytics platform</li>
                  <li>Built responsive UI components with React and TypeScript</li>
                </ul>
              </div>

              {/* Surf */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-medium">Founder & Lead Engineer</h3>
                    <div className="text-foreground-muted">Surf</div>
                  </div>
                  <div className="text-sm text-foreground-subtle whitespace-nowrap">Aug 2022 - Mar 2025</div>
                </div>
                <ul className="space-y-2 text-foreground-muted">
                  <li>Architected and built cross-platform social application with Flutter and Dart</li>
                  <li>Integrated GPT-4 for natural language processing and YOLOv8 for computer vision</li>
                  <li>Managed full product lifecycle from ideation to deployment over 2.5+ years</li>
                </ul>
              </div>
            </div>
          </motion.section>

          {/* Education */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="space-y-8"
          >
            <h2 className="text-2xl font-semibold tracking-tight">Education</h2>

            <div className="space-y-8">
              {/* UC San Diego */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-medium">University of California, San Diego</h3>
                    <div className="text-foreground-muted">B.S. Electrical Engineering</div>
                  </div>
                  <div className="text-sm text-foreground-subtle whitespace-nowrap">2024 - 2026</div>
                </div>
                <div className="text-foreground-muted">
                  Specialization: Machine Learning & Controls
                </div>
              </div>

              {/* Evergreen Valley College */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-medium">Evergreen Valley College</h3>
                    <div className="text-foreground-muted">Triple Major: Computer Science, Mathematics, Physics</div>
                  </div>
                  <div className="text-sm text-foreground-subtle whitespace-nowrap">2022 - 2024</div>
                </div>
                <div className="text-foreground-muted">
                  Graduated Magna Cum Laude. Completed high school early (Grade 10, 4.0 GPA).
                </div>
              </div>
            </div>
          </motion.section>

          {/* Technical Skills */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="space-y-8"
          >
            <h2 className="text-2xl font-semibold tracking-tight">Technical Skills</h2>

            <div className="grid gap-8 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground-subtle uppercase tracking-wider">AI & Machine Learning</h3>
                <div className="text-foreground-muted leading-relaxed">
                  Agentic AI, Model Context Protocol (MCP), LLMs (GPT-4, Claude),
                  LangChain, Vector Databases, Computer Vision (YOLOv8)
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground-subtle uppercase tracking-wider">Engineering & Product</h3>
                <div className="text-foreground-muted leading-relaxed">
                  React, TypeScript, Node.js, Flutter, Dart, Python,
                  Full-Stack Development, API Design, System Architecture
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground-subtle uppercase tracking-wider">Infrastructure & Tools</h3>
                <div className="text-foreground-muted leading-relaxed">
                  Supabase, PostgreSQL, Git, CI/CD, Docker,
                  Cloud Platforms, Database Design
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground-subtle uppercase tracking-wider">Languages</h3>
                <div className="text-foreground-muted leading-relaxed">
                  English (Native), Arabic (Professional), French (Working Proficiency)
                </div>
              </div>
            </div>
          </motion.section>

          {/* Approach */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="space-y-6"
          >
            <h2 className="text-2xl font-semibold tracking-tight">Approach</h2>
            <div className="space-y-4 text-foreground-muted leading-relaxed">
              <p>
                I focus on building AI products where the intelligence feels invisible to users.
                The goal isn't to showcase complexity—it's to solve real problems with systems
                that work reliably and scale effectively.
              </p>
              <p>
                My background spans machine learning, full-stack engineering, and product development.
                This allows me to move quickly from concept to production, understanding both the
                technical depth required and the product decisions that matter.
              </p>
            </div>
          </motion.section>

          {/* CTA */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.1 }}
            className="pt-8 border-t border-border-subtle"
          >
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/portfolio"
                className="px-6 py-3 bg-foreground text-background rounded-full font-medium hover:bg-foreground/90 transition-all duration-normal focus-ring text-center"
              >
                View Projects
              </Link>
              <Link
                href="/contact"
                className="px-6 py-3 glass rounded-full font-medium hover:glass-elevated transition-all duration-normal focus-ring text-center"
              >
                Get in Touch
              </Link>
            </div>
          </motion.section>
        </div>
      </div>
    </main>
  )
}
