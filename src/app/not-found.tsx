import Link from 'next/link'
import { Container } from '@/components/Container'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center pt-16">
      <Container>
        <p className="text-sm font-medium text-foreground-subtle">404</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-4 text-foreground-muted">
          This page does not exist or has moved.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="focus-ring rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Home
          </Link>
          <Link
            href="/portfolio"
            className="card card-hover focus-ring rounded-full px-6 py-3 text-sm font-medium"
          >
            View Work
          </Link>
        </div>
      </Container>
    </main>
  )
}
