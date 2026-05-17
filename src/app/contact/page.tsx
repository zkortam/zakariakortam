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
    <main className="pt-28">
      <Container className="space-y-6 pb-24">
        <Reveal>
          <section className="glass rounded-5xl px-8 py-16 sm:px-14">
            <h1 className="text-4xl font-semibold tracking-tight text-gradient sm:text-5xl">
              Contact
            </h1>
            <p className="mt-5 max-w-xl text-lg text-foreground-muted">
              AI engineering, product work, or collaboration. I usually reply
              within a day.
            </p>
          </section>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Reveal>
            <section className="glass rounded-4xl px-8 py-10 sm:px-10">
              <ContactForm />
            </section>
          </Reveal>

          <Reveal delay={0.06}>
            <aside className="glass space-y-8 rounded-4xl px-8 py-10">
              <div>
                <h2 className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
                  Email
                </h2>
                <button
                  onClick={copy}
                  className="focus-ring mt-3 inline-flex items-center gap-2 rounded-full text-sm transition-colors hover:text-foreground-muted"
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
                <ul className="mt-3 space-y-2.5">
                  {socials.map((s) => (
                    <li key={s.name}>
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="focus-ring inline-flex items-center gap-2.5 rounded-full text-sm text-foreground-muted transition-colors hover:text-foreground"
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
            </aside>
          </Reveal>
        </div>
      </Container>
    </main>
  )
}
