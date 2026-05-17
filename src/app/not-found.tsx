import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-[100svh] items-center justify-center px-6">
      <div className="mx-auto max-w-md text-center">
        <div className="text-display text-gradient">404</div>
        <p className="mt-4 text-foreground-muted">
          This page does not exist or has moved.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="focus-ring rounded-full bg-foreground px-7 py-3.5 text-sm font-semibold text-background transition-transform duration-base hover:scale-[1.03]"
          >
            Back Home
          </Link>
          <Link
            href="/portfolio"
            className="glass focus-ring rounded-full px-7 py-3.5 text-sm font-semibold transition-all duration-base hover:scale-[1.03]"
          >
            View Work
          </Link>
        </div>
      </div>
    </main>
  )
}
