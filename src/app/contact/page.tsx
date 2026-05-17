'use client'

import { useState } from 'react'
import { Linkedin, Twitter, Instagram, Github, Check, Copy } from 'lucide-react'
import { ContactForm } from '@/components/ContactForm'
import { GlassCard } from '@/components/GlassCard'
import { Reveal } from '@/components/Reveal'

const socials = [
  { name: 'LinkedIn', href: 'https://linkedin.com/in/zkortam', icon: Linkedin },
  { name: 'X', href: 'https://x.com/zakariakortam', icon: Twitter },
  { name: 'Instagram', href: 'https://instagram.com/zkortam', icon: Instagram },
  { name: 'GitHub', href: 'https://github.com/zkortam', icon: Github },
]

const EMAIL = 'zakaria@zakariakortam.com'

export default function ContactPage() {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(EMAIL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pb-32 pt-40">
      <Reveal>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent/80">
          Contact
        </p>
        <h1 className="mt-5 text-display text-gradient">Let's talk.</h1>
        <p className="mt-7 max-w-lg text-balance text-lg text-foreground-muted">
          AI engineering, product work, or collaboration. I usually reply within
          a day.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mt-14">
        <GlassCard className="rounded-4xl p-8 sm:p-10">
          <ContactForm />
        </GlassCard>
      </Reveal>

      <Reveal delay={0.1} className="mt-6">
        <GlassCard className="flex flex-col gap-5 rounded-4xl p-8 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={copy}
            className="focus-ring inline-flex items-center gap-2 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground"
          >
            {copied ? (
              <Check className="h-4 w-4 text-accent" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? 'Copied' : EMAIL}
          </button>
          <div className="flex items-center gap-2">
            {socials.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.name}
                className="focus-ring flex h-10 w-10 items-center justify-center rounded-full border border-white/8 text-foreground-muted transition-all duration-base hover:scale-110 hover:border-white/25 hover:text-foreground"
              >
                <s.icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </GlassCard>
      </Reveal>

      <p className="mt-10 text-center text-sm text-foreground-subtle">
        San Jose, California
      </p>
    </main>
  )
}
