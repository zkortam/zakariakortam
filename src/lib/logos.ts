/** Company marks, drawn as masks so they take the ink of the card they sit on. `brand` is the color on hover. */
export type Logo = { src: string; ratio: number; brand: string }

export const LOGOS: Record<string, Logo> = {
  digicert: { src: '/logos/digicert.svg', ratio: 121.03 / 35, brand: '#0174C3' },
  'facilis-ai': { src: '/logos/facilis.png', ratio: 900 / 184, brand: '#111111' },
  'incorta-dashboards': { src: '/logos/incorta.svg', ratio: 555.63 / 125.85, brand: '#15152B' },
}
