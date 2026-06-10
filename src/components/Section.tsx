import { type ReactNode } from 'react'

/**
 * Full-bleed section. Content is constrained to the reading column,
 * but the section itself spans the viewport. Hairline dividers and
 * tonal bands separate sections instead of glass boxes.
 */
export function Section({
  children,
  className = '',
  divider = false,
  band = false,
  width = 'normal',
  backdrop,
}: {
  children: ReactNode
  className?: string
  divider?: boolean
  band?: boolean
  width?: 'normal' | 'wide'
  /** Full-bleed layer rendered behind the content column (e.g. a shader). */
  backdrop?: ReactNode
}) {
  return (
    <section
      className={`relative ${divider ? 'hairline' : ''} ${
        band ? 'band' : ''
      } ${className}`}
    >
      {backdrop && (
        <div className="pointer-events-none absolute inset-0 z-0">{backdrop}</div>
      )}
      <div
        className={`mx-auto w-full px-6 sm:px-8 ${
          width === 'wide' ? 'max-w-6xl' : 'max-w-content'
        } ${backdrop ? 'relative z-10' : ''}`}
      >
        {children}
      </div>
    </section>
  )
}
