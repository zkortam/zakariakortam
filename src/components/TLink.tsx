'use client'

import Link from 'next/link'
import type { ComponentPropsWithoutRef, MouseEvent } from 'react'
import { useTransitionNav, type FlipKind } from './Transitions'

type Props = ComponentPropsWithoutRef<typeof Link> & {
  href: string
  /** Carry the picture into the next page. */
  flip?: FlipKind
  flipId?: string
}

export function TLink({ href, flip, flipId, onClick, children, ...rest }: Props) {
  const { go } = useTransitionNav()

  function handle(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e)
    if (e.defaultPrevented) return
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const a = e.currentTarget
    if (a.target && a.target !== '_self') return
    const url = new URL(a.href, location.href)
    if (url.origin !== location.origin) return
    if (url.pathname === location.pathname) {
      if (url.hash) return
      e.preventDefault()
      return
    }
    e.preventDefault()
    let source: HTMLElement | null = null
    if (flip === 'plate') source = a.closest('.plate')
    if (flip === 'tile') source = a.querySelector<HTMLElement>('[data-flip-img]')
    go(url.pathname, flip && source && flipId ? { kind: flip, el: source, id: flipId } : undefined)
  }

  return (
    <Link href={href} onClick={handle} {...rest}>
      {children}
    </Link>
  )
}
