'use client'

import { MotionConfig } from 'framer-motion'
import { type ReactNode } from 'react'

/**
 * Honors prefers-reduced-motion for all Framer animations (CSS media queries
 * don't reach JS-driven transforms). Transform/layout animations become
 * instant for users who ask for reduced motion; fades still fade.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
