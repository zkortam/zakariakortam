'use client'

import { ContactForm } from '@/components/ContactForm'
import { Linkedin, Twitter, Instagram, Github } from 'lucide-react'

const socialLinks = [
  {
    name: 'LinkedIn',
    href: 'https://linkedin.com/in/zkortam',
    icon: Linkedin,
  },
  {
    name: 'X',
    href: 'https://x.com/zakariakortam',
    icon: Twitter,
  },
  {
    name: 'Instagram',
    href: 'https://instagram.com/zkortam',
    icon: Instagram,
  },
  {
    name: 'GitHub',
    href: 'https://github.com/zkortam',
    icon: Github,
  }
]

export default function ContactPage() {
  return (
    <main className="min-h-screen pt-16">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <div className="space-y-16">
          {/* Header */}
          <section className="space-y-4 text-center">
            <h1 className="text-5xl md:text-6xl font-semibold tracking-tight">Let's Connect</h1>
            <p className="text-lg text-foreground-muted max-w-xl mx-auto">
              Interested in AI engineering, product development, or collaboration?
            </p>
          </section>

          {/* Contact Form */}
          <section className="space-y-6">
            <ContactForm />
          </section>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-subtle"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-background text-foreground-subtle">or connect via</span>
            </div>
          </div>

          {/* Quick Info */}
          <section className="space-y-8">
            {/* Email & Response */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
              <button
                onClick={() => navigator.clipboard.writeText('zakaria@zakariakortam.com')}
                className="px-6 py-2.5 glass rounded-full text-sm font-medium hover:glass-elevated transition-all duration-normal focus-ring"
              >
                zakaria@zakariakortam.com
              </button>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/5 text-sm text-foreground-muted">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                <span>Available · 24-48h response</span>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex items-center justify-center gap-4">
              {socialLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 glass rounded-full hover:glass-elevated transition-all duration-normal focus-ring group"
                  aria-label={link.name}
                >
                  <link.icon className="w-5 h-5 group-hover:scale-110 transition-transform duration-normal" />
                </a>
              ))}
            </div>

            {/* Location */}
            <p className="text-center text-sm text-foreground-subtle">
              San Jose, California · Silicon Valley
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
