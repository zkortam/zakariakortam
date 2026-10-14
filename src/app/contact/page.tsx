import type { Metadata } from 'next'
import { Container } from '@/components/Container'
import { ShaderGradient } from '@/components/ShaderGradient'
import { EmailPill } from '@/components/EmailPill'
import { ContactForm } from '@/components/ContactForm'
import { BlurIn, Rule, SectionHead, Words } from '@/components/Motion'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with Zakaria Kortam.',
}

const elsewhere = [
  { name: 'LinkedIn', handle: 'in/zkortam', href: 'https://linkedin.com/in/zkortam' },
  { name: 'GitHub', handle: 'zkortam', href: 'https://github.com/zkortam' },
  { name: 'X', handle: '@zakariakortam', href: 'https://x.com/zakariakortam' },
  { name: 'Instagram', handle: '@zkortam', href: 'https://instagram.com/zkortam' },
]

export default function ContactPage() {
  return (
    <main>
      {/* Inset panel, centered, like the america.gov hero */}
      <section className="p-2 sm:p-3">
        <div className="relative flex min-h-[86svh] flex-col items-center justify-center overflow-hidden rounded-[36px] border border-white/[0.08] bg-[#0b0708] px-5 pb-16 pt-32 text-center">
          <div
            className="absolute inset-0"
            style={{
              maskImage: 'radial-gradient(70% 70% at 50% 100%, #000 20%, transparent 80%)',
              WebkitMaskImage: 'radial-gradient(70% 70% at 50% 100%, #000 20%, transparent 80%)',
            }}
          >
            <ShaderGradient seed={1.1} className="block h-full w-full" />
          </div>
          <div className="relative w-full">
            <Words as="h1" onMount stagger={0.08} className="font-display text-giant" text="Say hello." />
            <Words
              as="p"
              onMount
              delay={0.3}
              stagger={0.03}
              className="mx-auto mt-8 max-w-[30rem] text-lede text-foreground-muted"
              text="Product, a project, or just to talk. I usually reply within a day."
            />
            <div className="mt-12">
              <EmailPill />
            </div>
          </div>
        </div>
      </section>

      <Container className="pt-32 sm:pt-44">
        <SectionHead n="I" label="Write here" />
        <div className="grid gap-10 lg:grid-cols-2">
          <BlurIn className="max-w-[24rem] text-foreground-muted">
            This opens your mail app with the message filled in.
          </BlurIn>
          <BlurIn delay={0.08}>
            <ContactForm />
          </BlurIn>
        </div>
      </Container>

      <Container className="pt-32 sm:pt-44">
        <SectionHead n="II" label="Elsewhere" />
        {elsewhere.map((s, i) => (
          <div key={s.name}>
            <a
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group grid grid-cols-[1fr_auto] items-baseline gap-6 py-6 lg:grid-cols-2"
            >
              <BlurIn as="span" delay={i * 0.05} className="text-[clamp(1.35rem,2.2vw,1.9rem)] tracking-[-0.025em] transition-transform duration-500 group-hover:translate-x-1">
                {s.name}
              </BlurIn>
              <BlurIn as="span" delay={i * 0.05 + 0.05} className="flex items-baseline justify-between text-foreground-muted transition-colors group-hover:text-foreground">
                {s.handle}
                <span className="ml-6 opacity-0 transition-opacity duration-500 group-hover:opacity-100">↗</span>
              </BlurIn>
            </a>
            <Rule delay={i * 0.05} />
          </div>
        ))}
      </Container>
    </main>
  )
}
