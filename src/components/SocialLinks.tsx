'use client'

import { motion } from 'framer-motion'
import { Linkedin, Twitter, Instagram, Github, Mail } from 'lucide-react'

const socialLinks = [
  {
    name: 'LinkedIn',
    href: 'https://linkedin.com/in/zkortam',
    icon: Linkedin,
    color: 'hover:text-[#0077B5]',
    description: 'Professional network and career updates'
  },
  {
    name: 'X (Twitter)',
    href: 'https://x.com/zakariakortam',
    icon: Twitter,
    color: 'hover:text-accent-blue',
    description: 'Thoughts on AI, tech, and product development'
  },
  {
    name: 'Instagram',
    href: 'https://instagram.com/zkortam',
    icon: Instagram,
    color: 'hover:text-[#E4405F]',
    description: 'Behind the scenes and personal projects'
  },
  {
    name: 'GitHub',
    href: 'https://github.com/zkortam',
    icon: Github,
    color: 'hover:text-foreground',
    description: 'Open source projects and code samples'
  }
]

export function SocialLinks() {
  return (
    <div className="space-y-4">
      {socialLinks.map((link, index) => (
        <motion.a
          key={link.name}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1, duration: 0.3 }}
          className={`group flex items-center gap-4 p-4 glass rounded-card-lg hover:glass-elevated transition-all duration-normal ${link.color} focus-ring`}
        >
          <div className="flex-shrink-0">
            <link.icon className="w-5 h-5 transition-colors duration-normal" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="font-medium group-hover:text-current transition-colors duration-normal">
              {link.name}
            </div>
            <div className="text-sm text-foreground-muted">
              {link.description}
            </div>
          </div>
          <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-normal">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </div>
        </motion.a>
      ))}

      {/* Email Contact Card */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: socialLinks.length * 0.1, duration: 0.3 }}
        className="group flex items-center gap-4 p-4 glass rounded-card-lg cursor-pointer hover:glass-elevated transition-all duration-normal hover:text-accent-cyan focus-ring"
        onClick={() => {
          navigator.clipboard.writeText('zakaria@zakariakortam.com')
          // Could add a toast notification here
        }}
      >
        <div className="flex-shrink-0">
          <Mail className="w-5 h-5 transition-colors duration-normal" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="font-medium group-hover:text-current transition-colors duration-normal">
            Email
          </div>
          <div className="text-sm text-foreground-muted">
            Click to copy email address
          </div>
        </div>
        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-normal">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
      </motion.div>
    </div>
  )
}
