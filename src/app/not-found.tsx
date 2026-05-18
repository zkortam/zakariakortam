import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-6 text-center">
      <div className="relative">
        <p className="text-[clamp(5rem,18vw,11rem)] font-bold leading-none text-foreground-subtle">
          404
        </p>
        <h1 className="mt-2 text-headline">Page not found</h1>
        <p className="mt-4 text-foreground-muted">
          This page does not exist or has moved.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-primary focus-ring">
            Home
          </Link>
          <Link href="/portfolio" className="btn-secondary focus-ring">
            View Work
          </Link>
        </div>
      </div>
    </main>
  )
}
