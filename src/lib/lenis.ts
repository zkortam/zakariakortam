import type Lenis from 'lenis'

let instance: Lenis | null = null

export function setLenis(l: Lenis | null) {
  instance = l
}

export function getLenis(): Lenis | null {
  return instance
}

export function scrollTop() {
  if (instance) instance.scrollTo(0, { immediate: true, force: true })
  window.scrollTo(0, 0)
}
