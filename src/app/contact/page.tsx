import type { Metadata } from 'next'
import { Grid } from '@/components/Container'
import { PageHead } from '@/components/PageHead'
import { Fade, Rule } from '@/components/Motion'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with Zakaria Kortam.',
}

const rows = [
  { name: 'Email', value: 'zakaria@zakariakortam.com', href: 'mailto:zakaria@zakariakortam.com' },
  { name: 'LinkedIn', value: 'in/zkortam', href: 'https://linkedin.com/in/zkortam' },
  { name: 'GitHub', value: 'zkortam', href: 'https://github.com/zkortam' },
  { name: 'X', value: '@zakariakortam', href: 'https://x.com/zakariakortam' },
  { name: 'Instagram', value: '@zkortam', href: 'https://instagram.com/zkortam' },
]

export default function ContactPage() {
  return (
    <main>
      <PageHead title="Contact" statement="Email is best. I usually reply within a day." />

      <Grid className="mt-24 sm:mt-36">
        <ul className="lg:col-span-12">
          {rows.map((r, i) => (
            <li key={r.name}>
              <Rule delay={i * 0.05} />
              <Fade delay={i * 0.05}>
                <a
                  href={r.href}
                  {...(r.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="group grid grid-cols-1 gap-1 py-6 lg:grid-cols-12 lg:gap-x-5"
                >
                  <span className="text-[15px] text-foreground-muted lg:col-span-6">{r.name}</span>
                  <span className="text-statement transition-colors duration-300 group-hover:text-foreground-muted lg:col-span-6">
                    {r.value}
                  </span>
                </a>
              </Fade>
            </li>
          ))}
        </ul>
      </Grid>
    </main>
  )
}
