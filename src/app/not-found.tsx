import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen pt-16 flex items-center justify-center">
      <div className="mx-auto max-w-2xl px-6 py-32 text-center">
        <div className="space-y-8">
          {/* 404 Number */}
          <div className="relative">
            <h1 className="text-9xl font-bold text-foreground/10">404</h1>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-2xl font-semibold">Page Not Found</div>
            </div>
          </div>

          {/* Message */}
          <div className="space-y-4">
            <p className="text-lg text-foreground-muted">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link
              href="/"
              className="px-8 py-4 bg-foreground text-background rounded-full font-medium hover:bg-foreground/90 transition-all duration-normal focus-ring"
            >
              Back to Home
            </Link>
            <Link
              href="/portfolio"
              className="px-8 py-4 glass-elevated rounded-full font-medium hover:scale-[1.02] transition-all duration-normal focus-ring"
            >
              View Projects
            </Link>
          </div>

          {/* Quick Links */}
          <div className="pt-8 space-y-4">
            <p className="text-sm text-foreground-subtle">Or try one of these:</p>
            <div className="flex flex-wrap gap-4 justify-center text-sm">
              <Link href="/about" className="text-accent-blue hover:text-accent-cyan transition-colors">
                About
              </Link>
              <span className="text-foreground-subtle">•</span>
              <Link href="/portfolio" className="text-accent-blue hover:text-accent-cyan transition-colors">
                Portfolio
              </Link>
              <span className="text-foreground-subtle">•</span>
              <Link href="/contact" className="text-accent-blue hover:text-accent-cyan transition-colors">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
