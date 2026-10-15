import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import { POSTS } from '@/content/blog/posts.generated'
import { formatDate } from '@/content/blog/types'
import { OG_SIZE, ogFonts } from '@/og/card'

export const alt = 'A post by Zakaria Kortam'
export const size = OG_SIZE
export const contentType = 'image/png'

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }))
}

/** The post's cover, cropped to the card, with the title set over a soft floor of shade. Covers are webp, which the renderer cannot read, so sharp hands it a jpeg. */
export default async function PostOg({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const p = POSTS.find((x) => x.slug === slug)
  const title = p?.title ?? 'Blog'
  const foot = p ? `${formatDate(p.date)} · ${p.minutes} min read` : ''
  let cover: string | null = null
  if (p?.cover) {
    const jpg = await sharp(join(process.cwd(), 'public', p.cover)).resize(size.width, size.height, { fit: 'cover', position: 'attention' }).jpeg({ quality: 86 }).toBuffer()
    cover = `data:image/jpeg;base64,${jpg.toString('base64')}`
  }
  const big = title.length <= 24 ? 84 : title.length <= 44 ? 68 : 56
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          fontFamily: 'Geist',
          color: '#FFFFFF',
          background: 'radial-gradient(ellipse 80% 90% at 68% 30%, #6A1C2C 0%, #33101A 48%, #14060A 100%)',
        }}
      >
        {cover && <img src={cover} width={size.width} height={size.height} style={{ position: 'absolute', top: 0, left: 0 }} alt="" />}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: size.width,
            height: size.height,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '56px 64px 60px',
            background: cover ? 'linear-gradient(180deg, rgba(10,4,6,.5) 0%, rgba(10,4,6,.08) 26%, rgba(10,4,6,.2) 44%, rgba(10,4,6,.9) 100%)' : 'transparent',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26, fontWeight: 500, color: 'rgba(255,255,255,.88)' }}>
            <span>Zakaria Kortam</span>
            <span>Blog</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: big, fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1.04, maxWidth: 980 }}>{title}</div>
            {foot && <div style={{ marginTop: 22, fontSize: 28, fontWeight: 500, color: 'rgba(255,255,255,.8)' }}>{foot}</div>}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  )
}
