import type { Project } from './projects-data'
import { PLATES } from './media'

/**
 * The hover picture for a list row: the project's own screenshot or its plate's first still, through the
 * image optimizer at a size made for a 280px card. Undefined when the project has no real picture, and then
 * the row shows nothing.
 */
export function previewOf(p: Project): string | undefined {
  const src = p.image ?? PLATES[p.id]?.stills.a.src
  return src ? `/_next/image?url=${encodeURIComponent(src)}&w=640&q=75` : undefined
}
