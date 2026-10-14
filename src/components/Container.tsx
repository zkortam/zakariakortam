import { type ReactNode } from 'react'

/** The page column. Wide NDS gutters; everything aligns to these edges. */
export function Container({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`mx-auto w-full max-w-content px-5 sm:px-10 ${className}`}>
      {children}
    </div>
  )
}

/** 12-column grid. Content snaps to column 1 or column 7. */
export function Grid({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <Container className={`grid grid-cols-1 gap-x-5 lg:grid-cols-12 ${className}`}>
      {children}
    </Container>
  )
}
