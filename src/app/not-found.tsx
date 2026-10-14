import Link from 'next/link'
import { Container } from '@/components/Container'

export default function NotFound() {
  return (
    <main>
      <Container className="flex min-h-[80svh] flex-col justify-center pt-28">
        <h1 className="font-display text-giant">Not here.</h1>
        <p className="mt-8 max-w-[30rem] text-lede text-foreground-muted">
          This page doesn’t exist, or it moved.
        </p>
        <Link href="/" className="group mt-10 inline-flex items-center gap-2 text-[0.95rem] font-medium">
          Back home <span className="transition-transform duration-500 group-hover:translate-x-1">→</span>
        </Link>
      </Container>
    </main>
  )
}
