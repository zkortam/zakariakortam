import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zakaria Kortam',
    short_name: 'Kortam',
    start_url: '/',
    display: 'standalone',
    background_color: '#040304',
    theme_color: '#040304',
    icons: [{ src: '/icon', sizes: '64x64', type: 'image/png' }],
  }
}
