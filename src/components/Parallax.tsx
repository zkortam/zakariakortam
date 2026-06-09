'use client'

import { useRef } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  type HTMLMotionProps,
} from 'framer-motion'

/**
 * Scroll-linked vertical parallax. Positive speed drifts up as it scrolls
 * through the viewport; depth without a fixed background. Disabled for
 * reduced-motion.
 */
export function Parallax({
  children,
  speed = 0.15,
  className,
  ...rest
}: Omit<HTMLMotionProps<'div'>, 'children'> & {
  children: React.ReactNode
  speed?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const range = speed * 100
  const y = useTransform(scrollYProgress, [0, 1], [`${range}%`, `${-range}%`])

  return (
    <motion.div
      ref={ref}
      style={reduce ? undefined : { y }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
