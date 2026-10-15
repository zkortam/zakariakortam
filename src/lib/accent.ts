/**
 * One color per product, used for its marks in charts, its chips and its page's accent. Fixed order, checked as a
 * categorical set for color-vision separation on paper (Surf, Helio, SPICE++, RTL++, Surf Messenger, AiroFind).
 * Text never wears these: a colored mark beside the text carries the identity.
 */
export const ACCENT: Record<string, string> = {
  surf: '#3A6DF0',
  helio: '#E4572E',
  'spice-plus-plus': '#E8A33D',
  'rtl-plus-plus': '#14A3A3',
  'surf-messenger': '#7B61FF',
  airofind: '#2FA866',
}

/** Everything that is not one of the six products. */
export const OTHER = '#B5AEA6'

export function accentOf(id: string): string | undefined {
  return ACCENT[id]
}
