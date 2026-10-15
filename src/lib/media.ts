export interface Img {
  src: string
  w: number
  h: number
  alt: string
}

export type Composition = 'card' | 'phone-right' | 'phone-left' | 'bleed' | 'results'

export interface PlateSpec {
  id: string
  ground: string
  tone: 'dark' | 'light'
  titleLines: string[]
  composition: Composition
  ambient?: { src: string; dur: number }
  primary: Img
  /** Art-directed crop for phones (< 768). */
  mobile?: Img
  /** Light texture under the composition (AiroFind earth). */
  earth?: { desktop: Img; mobile: Img }
  stills: { a: Img; b1: Img; b2: Img; b2Phone?: boolean }
}

const helioApp: Img = {
  src: '/work/hd/helio-app.webp',
  w: 2880,
  h: 1302,
  alt: "Helio's whiteboard solving 3(x minus 2) equals 2x plus 5, with x equals 11 circled",
}
const surfApp: Img = {
  src: '/work/hd/surf-app.webp',
  w: 1296,
  h: 2752,
  alt: "Surf's home feed on a phone, with stories and a photo post",
}
const messengerApp: Img = {
  src: '/work/hd/surf-messenger-app.webp',
  w: 1296,
  h: 2752,
  alt: 'A Surf Messenger chat thread on a phone',
}
const airoResults: Img = {
  src: '/work/derived/airofind-results.webp',
  w: 1277,
  h: 1760,
  alt: 'AiroFind results for San Francisco to New York, November 10 to 24',
}

export const PLATES: Record<string, PlateSpec> = {
  helio: {
    id: 'helio',
    ground: '#F6F1EA url(/light/ground-helio.webp) center / cover no-repeat',
    tone: 'light',
    titleLines: ['Helio'],
    composition: 'card',
    primary: helioApp,
    mobile: { src: '/work/derived/helio-card-m.webp', w: 1086, h: 1146, alt: helioApp.alt },
    stills: {
      a: { src: '/work/hd/helio-desktop.webp', w: 2880, h: 1800, alt: "Helio's home page with the tutor demo board" },
      b1: { src: '/work/hd/helio-mobile.webp', w: 1170, h: 2532, alt: 'Helio on a phone, the board showing x equals 11' },
      b2: helioApp,
    },
  },
  surf: {
    id: 'surf',
    ground: '#05070C',
    tone: 'dark',
    titleLines: ['Surf'],
    composition: 'phone-right',
    ambient: { src: '/light/ambient-surf.webp', dur: 40 },
    primary: surfApp,
    stills: {
      a: { src: '/work/derived/surf-desktop.webp', w: 2880, h: 1800, alt: "Surf's home page: Social media you control" },
      b1: { src: '/work/hd/surf-mobile.webp', w: 1170, h: 2532, alt: "Surf's home page on a phone" },
      b2: surfApp,
      b2Phone: true,
    },
  },
  'surf-messenger': {
    id: 'surf-messenger',
    ground: '#06071A',
    tone: 'dark',
    titleLines: ['Surf', 'Messenger'],
    composition: 'phone-left',
    ambient: { src: '/light/ambient-surf-messenger.webp', dur: 46 },
    primary: messengerApp,
    stills: {
      a: {
        src: '/work/hd/surf-messenger-desktop.webp',
        w: 2880,
        h: 1800,
        alt: "Surf Messenger's home page: Messages nobody else can read",
      },
      b1: { src: '/work/hd/surf-messenger-mobile.webp', w: 1170, h: 2532, alt: "Surf Messenger's home page on a phone" },
      b2: messengerApp,
      b2Phone: true,
    },
  },
  'spice-plus-plus': {
    id: 'spice-plus-plus',
    ground: '#07090F',
    tone: 'dark',
    titleLines: ['SPICE++'],
    composition: 'card',
    primary: {
      src: '/work/hd/spice-plus-plus-app.webp',
      w: 3200,
      h: 2000,
      alt: 'SPICE++ designing a Sallen-Key low-pass filter: the schematic, its Bode plot, and the agent verifying the 2 kHz cutoff',
    },
    mobile: { src: '/work/derived/spice-bode-m.webp', w: 1560, h: 890, alt: 'SPICE++ Bode plot of a Sallen-Key low-pass filter' },
    stills: {
      a: { src: '/work/hd/spice-plus-plus-desktop.webp', w: 2880, h: 1800, alt: "SPICE++'s home page, The engineering agent for analog circuits" },
      b1: { src: '/work/hd/spice-plus-plus-mobile.webp', w: 1170, h: 2532, alt: 'SPICE++ home page on a phone' },
      b2: { src: '/work/hd/spice-plus-plus-sim.webp', w: 3200, h: 2000, alt: 'SPICE++ editor with an RC circuit and an AC sweep' },
    },
  },
  'rtl-plus-plus': {
    id: 'rtl-plus-plus',
    ground: '#EEF0F0 url(/light/ground-rtl.webp) center / cover no-repeat',
    tone: 'light',
    titleLines: ['RTL++'],
    composition: 'card',
    primary: {
      src: '/work/hd/rtlpp-app.webp',
      w: 2304,
      h: 1612,
      alt: 'RTL++ explaining a failing counter test: the source line, the trace of why count is 0 at 100 ns, and the waveform',
    },
    mobile: { src: '/work/derived/rtlpp-wave-m.webp', w: 1500, h: 572, alt: 'RTL++ waveform of the counter test, failing at 100 ns' },
    stills: {
      a: { src: '/work/hd/rtlpp-desktop.webp', w: 2880, h: 1800, alt: "RTL++'s home page, Digital logic in the browser" },
      b1: { src: '/work/hd/rtlpp-mobile.webp', w: 1170, h: 2532, alt: 'RTL++ home page on a phone' },
      b2: { src: '/work/hd/rtlpp-app.webp', w: 2304, h: 1612, alt: 'RTL++ trace of a failing test with its waveform' },
    },
  },
  airofind: {
    id: 'airofind',
    ground: '#000000',
    tone: 'dark',
    titleLines: ['AiroFind'],
    composition: 'results',
    primary: airoResults,
    earth: {
      desktop: { src: '/work/derived/airofind-earth.webp', w: 2880, h: 530, alt: '' },
      mobile: { src: '/work/derived/airofind-earth-m.webp', w: 1170, h: 820, alt: '' },
    },
    stills: {
      a: { src: '/work/hd/airofind-desktop.webp', w: 2880, h: 1800, alt: "AiroFind's home page over the night earth" },
      b1: { src: '/work/hd/airofind-app-mobile.webp', w: 1170, h: 2532, alt: 'AiroFind results on a phone' },
      b2: { src: '/work/hd/airofind-app.webp', w: 2880, h: 1800, alt: airoResults.alt },
    },
  },
}
