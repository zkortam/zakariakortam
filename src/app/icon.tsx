import { ImageResponse } from 'next/og'

export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 16,
          background: 'linear-gradient(160deg, #9b2a3a, #4a0f19)',
          color: '#fff',
          fontSize: 38,
          fontFamily: 'Georgia, serif',
        }}
      >
        Z
      </div>
    ),
    size,
  )
}
