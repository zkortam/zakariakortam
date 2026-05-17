'use client'

import { useState } from 'react'
import { Linkedin, Twitter, Instagram, Github, Check, Copy } from 'lucide-react'
import { Container } from '@/components/Container'
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
    <main className="pt-16">
      <Container>
        <section className="border-b border-white/8 py-20">
          <Reveal>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Contact
            </h1>
            <p className="mt-4 max-w-xl text-foreground-muted">
              AI engineering, product work, or collaboration. I usually reply
              within a day.
            </p>
          </Reveal>
        </section>

        <div className="grid gap-16 py-16 lg:grid-cols-[1fr_280px]">
          <Reveal>
            <ContactForm />
          </Reveal>

          <Reveal delay={0.06} className="space-y-8 lg:border-l lg:border-white/8 lg:pl-8">
            <div>
              <h2 className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
                Email
              </h2>
              <button
                onClick={copy}
                className="focus-ring mt-3 inline-flex items-center gap-2 rounded text-sm transition-colors hover:text-foreground-muted"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4 text-foreground-subtle" />
                )}
                {copied ? 'Copied' : EMAIL}
              </button>
            </div>

            <div>
              <h2 className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
                Elsewhere
              </h2>
              <ul className="mt-3 space-y-2">
                {socials.map((s) => (
                  <li key={s.name}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="focus-ring inline-flex items-center gap-2.5 rounded text-sm text-foreground-muted transition-colors hover:text-foreground"
                    >
                      <s.icon className="h-4 w-4" />
                      {s.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
                Location
              </h2>
              <p className="mt-3 text-sm text-foreground-muted">
                San Jose, California
              </p>
            </div>
          </Reveal>
        </div>
      </Container>
    </main>
  )
}
