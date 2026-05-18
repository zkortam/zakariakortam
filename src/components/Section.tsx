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
}: {
  children: ReactNode
  className?: string
  divider?: boolean
  band?: boolean
  width?: 'normal' | 'wide'
}) {
  return (
    <section
      className={`relative ${divider ? 'hairline' : ''} ${
        band ? 'band' : ''
      } ${className}`}
    >
      <div
        className={`mx-auto w-full px-6 sm:px-8 ${
          width === 'wide' ? 'max-w-6xl' : 'max-w-content'
        }`}
      >
        {children}
      </div>
    </section>
  )
}
