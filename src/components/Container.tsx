import { type ReactNode } from 'react'

/** The page column. NDS-style wide gutters; everything aligns to these edges. */
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
