import { ImageResponse } from 'next/og'
import { OG_SIZE, OgCard, ogFonts } from '@/og/card'

export const alt = 'Zakaria Kortam'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function OpengraphImage() {
  return new ImageResponse(
    <OgCard title="Zakaria Kortam" line="Associate Product Manager at DigiCert. On my own time I build Helio, Surf, SPICE++, and AiroFind." foot="zakariakortam.com" />,
    { ...OG_SIZE, fonts: await ogFonts() },
  )
}
