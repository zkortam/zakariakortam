import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const alt = 'Zakaria Kortam, Product Manager at DigiCert'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Drawn by scripts/build-brand.py from the real portrait. */
export default async function OpengraphImage() {
  const png = await readFile(join(process.cwd(), 'public/og/home.png'))
  return new Response(new Uint8Array(png), { headers: { 'content-type': contentType, 'cache-control': 'public, max-age=86400, s-maxage=31536000' } })
}
