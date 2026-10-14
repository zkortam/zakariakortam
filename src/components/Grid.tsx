import type { ElementType, ComponentPropsWithoutRef } from 'react'

type GridProps<T extends ElementType> = { as?: T; className?: string } & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>

export function Grid<T extends ElementType = 'div'>({ as, className = '', ...rest }: GridProps<T>) {
  const Tag = (as ?? 'div') as ElementType
  return <Tag className={`grid-main ${className}`} {...rest} />
}
