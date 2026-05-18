'use client'

import { useState } from 'react'
import { Linkedin, Twitter, Instagram, Github, Check, Copy } from 'lucide-react'
import { Section } from '@/components/Section'
import { ContactForm } from '@/components/ContactForm'
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
    <main>
      {/* Hero */}
      <Section className="relative overflow-hidden pt-40 pb-20 sm:pt-48 sm:pb-24">
        <Reveal className="relative">
          <p className="eyebrow">Contact</p>
          <h1 className="mt-4 text-display text-balance">Let&apos;s talk.</h1>
          <p className="mt-7 max-w-xl text-lg text-foreground-muted sm:text-xl">
            AI engineering, product work, or collaboration. I usually reply
            within a day.
          </p>
        </Reveal>
      </Section>

      {/* Form + details */}
      <Section divider band className="py-20 sm:py-28">
        <div className="grid gap-16 lg:grid-cols-[1.4fr_0.6fr]">
          <Reveal>
            <ContactForm />
          </Reveal>

          <Reveal delay={0.08} className="space-y-12">
            <div>
              <h2 className="eyebrow">Email</h2>
              <button
                onClick={copy}
                className="focus-ring mt-4 inline-flex items-center gap-2 rounded-full text-sm transition-colors hover:text-accent"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-accent" />
                ) : (
                  <Copy className="h-4 w-4 text-foreground-subtle" />
                )}
                {copied ? 'Copied' : EMAIL}
              </button>
            </div>

            <div>
              <h2 className="eyebrow">Elsewhere</h2>
              <ul className="mt-4 space-y-3">
                {socials.map((s) => (
                  <li key={s.name}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="focus-ring group inline-flex items-center gap-3 rounded-full text-sm text-foreground-muted transition-colors hover:text-accent"
                    >
                      <s.icon className="h-4 w-4 transition-colors group-hover:text-accent" />
                      {s.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="eyebrow">Location</h2>
              <p className="mt-4 text-sm text-foreground-muted">
                San Jose, California
              </p>
            </div>
          </Reveal>
        </div>
      </Section>
    </main>
  )
}
