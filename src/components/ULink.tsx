import type { ReactNode } from 'react'
import { TLink } from './TLink'

/** Underline-wipe link. Internal links route through the transition system. */
export function ULink({
  href,
  children,
  className = '',
  thick = false,
  external,
  label,
}: {
  href: string
  children: ReactNode
  className?: string
  thick?: boolean
  external?: boolean
  label?: string
}) {
  const inner = (
    <>
      {children}
      <span aria-hidden="true" className={`u-line ${thick ? 'thick' : ''}`} />
    </>
  )
  const cls = `u-box u-hover ${className}`
  const isExternal = external ?? /^(https?:|mailto:)/.test(href)
  if (isExternal) {
    const newTab = href.startsWith('http')
    return (
      <a
        href={href}
        className={cls}
        {...(newTab ? { target: '_blank', rel: 'noopener noreferrer', 'aria-label': `${label ?? (typeof children === 'string' ? children : '')}, opens in a new tab` } : {})}
      >
        {inner}
      </a>
    )
  }
  return (
    <TLink href={href} className={cls}>
      {inner}
    </TLink>
  )
}
