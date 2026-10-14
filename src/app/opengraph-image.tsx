import { ImageResponse } from 'next/og'

export const alt = 'Zakaria Kortam'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: 80,
          color: '#f6f4f1',
          background:
            'radial-gradient(90% 120% at 85% 10%, #7a1a28 0%, #2a0a10 45%, #040304 80%)',
        }}
      >
        <div style={{ fontSize: 120, fontFamily: 'Georgia, serif', letterSpacing: -4, lineHeight: 1 }}>
          Zakaria Kortam
        </div>
        <div style={{ marginTop: 28, fontSize: 36, color: '#c9c4bf' }}>
          Associate Product Manager, Innovation at DigiCert
        </div>
      </div>
    ),
    size,
  )
}
