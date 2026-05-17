import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-6 text-center">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-[150px]" />
      <div className="relative">
        <p className="text-[clamp(5rem,18vw,11rem)] font-bold leading-none text-accent">
          404
        </p>
        <h1 className="mt-2 text-headline text-gradient">Page not found</h1>
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
