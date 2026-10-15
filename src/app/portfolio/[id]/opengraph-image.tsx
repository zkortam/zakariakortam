import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { projects } from '@/lib/projects-data'

export const alt = 'Project by Zakaria Kortam'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export function generateStaticParams() {
  return projects.map((p) => ({ id: p.id }))
}

/** Drawn by scripts/build-brand.py with each product's real screen. */
export default async function ProjectOg({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const file = projects.some((p) => p.id === id) ? `${id}.png` : 'home.png'
  const png = await readFile(join(process.cwd(), 'public/og', file))
  return new Response(new Uint8Array(png), { headers: { 'content-type': contentType, 'cache-control': 'public, max-age=86400, s-maxage=31536000' } })
}
