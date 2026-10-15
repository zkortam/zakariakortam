import type { SVGProps } from 'react'

/*
 * One icon set for the whole site: 24px grid, 2px stroke, round caps and joins, no fills, no sharp
 * corners. Size comes from `size`; colour is always currentColor.
 */

const PATHS = {
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="4" />
      <path d="M3.5 8.5l7.4 4.6a2 2 0 0 0 2.2 0l7.4-4.6" />
    </>
  ),
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="3" />
      <path d="M15.5 8.5V6.5a3 3 0 0 0-3-3h-6a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  popout: (
    <>
      <path d="M11 4.5H8a4 4 0 0 0-4 4v7.5a4 4 0 0 0 4 4h7.5a4 4 0 0 0 4-4V13" />
      <path d="M14.5 4h5.5v5.5M20 4l-8 8" />
    </>
  ),
  popin: (
    <>
      <path d="M11 4.5H8a4 4 0 0 0-4 4v7.5a4 4 0 0 0 4 4h7.5a4 4 0 0 0 4-4V13" />
      <path d="M12 6.5V12h5.5M12 12l8-8" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </>
  ),
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  // Socials
  surf: (
    <>
      <path d="M3 9.5c1.5 0 2.25-1.5 4.5-1.5S10.5 9.5 12 9.5s2.25-1.5 4.5-1.5S19.5 9.5 21 9.5" />
      <path d="M3 15.5c1.5 0 2.25-1.5 4.5-1.5s3 1.5 4.5 1.5 2.25-1.5 4.5-1.5 3 1.5 4.5 1.5" />
    </>
  ),
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M8 11v5.5M8 7.75v.01M12 16.5V11M12 13.75a2.75 2.75 0 0 1 5.5 0v2.75" />
    </>
  ),
  github: (
    <>
      <path d="M9 19.5c-4 1.25-4-2-5.5-2.5" />
      <path d="M15 21.5v-3.5a3 3 0 0 0-.85-2.35c2.85-.3 5.85-1.4 5.85-6.3a4.9 4.9 0 0 0-1.35-3.4 4.55 4.55 0 0 0-.1-3.4s-1.1-.35-3.5 1.3a12 12 0 0 0-6.2 0C6.45 2.2 5.35 2.55 5.35 2.55a4.55 4.55 0 0 0-.1 3.4A4.9 4.9 0 0 0 3.9 9.35c0 4.9 3 6 5.85 6.3A3 3 0 0 0 9 18v3.5" />
    </>
  ),
  x: (
    <>
      <path d="M4.5 4.5h3.75l11.25 15h-3.75z" />
      <path d="M19 4.5l-5.9 6.4M5 19.5l5.9-6.4" />
    </>
  ),
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5.5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.25 6.75v.01" />
    </>
  ),
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 20, strokeWidth = 2, ...rest }: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}
