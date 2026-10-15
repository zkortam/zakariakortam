import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const OG_SIZE = { width: 1200, height: 630 }

export async function ogFonts() {
  const dir = join(process.cwd(), 'src/og')
  const [m, s] = await Promise.all([readFile(join(dir, 'Geist-500.ttf')), readFile(join(dir, 'Geist-600.ttf'))])
  return [
    { name: 'Geist', data: m, weight: 500 as const, style: 'normal' as const },
    { name: 'Geist', data: s, weight: 600 as const, style: 'normal' as const },
  ]
}

/** Share card: oxblood light, the title set large, one line, the name. Same language as the site's opening. */
export function OgCard({ title, line, foot }: { title: string; line: string; foot: string }) {
  const big = title.length <= 10 ? 188 : title.length <= 16 ? 140 : 108
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 72px',
        fontFamily: 'Geist',
        color: '#F3EDE8',
        background: 'radial-gradient(ellipse 80% 90% at 68% 30%, #6A1C2C 0%, #33101A 48%, #14060A 100%)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 28, fontWeight: 500, color: 'rgba(243,237,232,.72)' }}>
        <span>Zakaria Kortam</span>
        <span>{foot}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: big, fontWeight: 600, letterSpacing: '-0.05em', lineHeight: 0.92 }}>{title}</div>
        <div style={{ marginTop: 28, fontSize: 38, fontWeight: 500, letterSpacing: '-0.01em', color: 'rgba(243,237,232,.86)', maxWidth: 940, lineHeight: 1.2 }}>
          {line}
        </div>
      </div>
    </div>
  )
}
