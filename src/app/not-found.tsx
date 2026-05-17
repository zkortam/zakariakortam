import Link from 'next/link'
import { Container } from '@/components/Container'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center pt-28">
      <Container className="pb-24">
        <section className="glass rounded-5xl px-8 py-20 text-center sm:px-14">
          <p className="text-sm font-medium text-foreground-subtle">404</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-gradient sm:text-5xl">
            Page not found
          </h1>
          <p className="mt-4 text-foreground-muted">
            This page does not exist or has moved.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="focus-ring rounded-full bg-foreground px-7 py-3.5 text-sm font-medium text-background transition-transform duration-300 hover:scale-[1.03]"
            >
              Home
            </Link>
            <Link
              href="/portfolio"
              className="glass glass-hover focus-ring rounded-full px-7 py-3.5 text-sm font-medium"
            >
              View Work
            </Link>
          </div>
        </section>
      </Container>
    </main>
  )
}
