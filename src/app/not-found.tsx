import Link from 'next/link'
import { Container } from '@/components/Container'

export default function NotFound() {
  return (
    <main>
      <Container className="flex min-h-[70svh] flex-col justify-end pt-40">
        <h1 className="font-display text-title">Not found</h1>
        <Link href="/" className="mt-10 text-foreground-muted transition-colors hover:text-foreground">
          Back home
        </Link>
      </Container>
    </main>
  )
}
