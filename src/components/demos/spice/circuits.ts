import { exampleDoc } from '@/vendor/spicepp/schematic/examples'
import type { SchematicDoc } from '@/vendor/spicepp/schematic/types'

/**
 * The SPICE++ example circuits this demo opens, exactly as the app ships them
 * (src/lib/schematic/examples.ts), with the titles and one-line descriptions its Launchpad shows
 * (src/components/Shell/Launchpad.tsx, EXAMPLE_META). The mixed-signal counter example is left out:
 * its 7-segment display is drawn by parts of the canvas this demo does not port.
 */
export const EXAMPLES = [
  { key: 'rc-lowpass', title: 'RC low-pass', proves: '−3 dB corner near 1 kHz' },
  { key: 'half-wave-rectifier', title: 'Half-wave rectifier', proves: '60 Hz sine, clipped below one diode drop' },
  { key: 'inverting-amplifier', title: 'Inverting amplifier', proves: 'Gain of −10 across the audio band' },
  { key: 'voltage-divider', title: 'Voltage divider', proves: '2.5 V at OUT from a 5 V rail' },
] as const

export type ExampleKey = (typeof EXAMPLES)[number]['key']

/** The demo opens on the RC low-pass with its AC sweep in front, as the app's own screenshots do. */
export const FIRST: ExampleKey = 'rc-lowpass'

/** A fresh copy of the template, as the Launchpad opens it. */
export const openExample = (key: ExampleKey): SchematicDoc => exampleDoc(key)
