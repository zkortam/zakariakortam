import { ImageResponse } from 'next/og'
import { OG_SIZE, OgCard, ogFonts } from '@/og/card'
import { projects } from '@/lib/projects-data'

export const alt = 'Project by Zakaria Kortam'
export const size = OG_SIZE
export const contentType = 'image/png'

export function generateStaticParams() {
  return projects.map((p) => ({ id: p.id }))
}

export default async function ProjectOg({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const p = projects.find((x) => x.id === id)
  const title = p?.title ?? 'Zakaria Kortam'
  const line = p?.line ?? ''
  const foot = p ? (p.kind === 'work' ? `${p.org ?? p.title}, ${p.year}` : p.year) : ''
  return new ImageResponse(<OgCard title={title} line={line} foot={foot} />, { ...OG_SIZE, fonts: await ogFonts() })
}
