import type { DiodeModel, Netlist } from '@/vendor/spicepp/sim/types'

/** The three circuits the demo can switch between, as SPICE++ netlists. */

export type CircuitId = 'rlc' | 'rc' | 'rect'

export type Knob = { key: string; label: string; unit: string; min: number; max: number; def: number }

export type Circuit = {
  id: CircuitId
  name: string
  analysis: 'tran' | 'ac'
  knobs: Knob[]
  netlist: (v: Record<string, number>) => Netlist
  /** Signals the plot and the readouts need. */
  want: string[]
}

/** 1N4001, from the SPICE++ parts library (onsemi and Diodes Inc. card). */
export const D1N4001: DiodeModel = { Is: 14.1e-9, N: 1.984, Rs: 0.0339, Cjo: 25.9e-12, Vj: 0.3245, M: 0.44, Bv: 75, Ibv: 10e-6, Tnom: 27, XTI: 3, Eg: 1.11 }

export const RLC_STEP = 5
export const RLC_TSTOP = 0.005
export const RECT_F = 60
export const RECT_TSTOP = 5 / RECT_F

export const CIRCUITS: Circuit[] = [
  {
    id: 'rlc',
    name: 'RLC step',
    analysis: 'tran',
    knobs: [
      { key: 'r', label: 'Resistance', unit: 'Ω', min: 2, max: 400, def: 20 },
      { key: 'l', label: 'Inductance', unit: 'H', min: 1e-3, max: 50e-3, def: 10e-3 },
      { key: 'c', label: 'Capacitance', unit: 'F', min: 0.1e-6, max: 10e-6, def: 1e-6 },
    ],
    want: ['V(in)', 'V(out)', 'I(L1)'],
    netlist: ({ r, l, c }) => ({
      nodes: ['in', 'a', 'out'],
      errors: [],
      elements: [
        { type: 'V', name: 'V1', n1: 'in', n2: '0', dc: 0, tran: { kind: 'pulse', v1: 0, v2: RLC_STEP, td: 0.0002, tr: 1e-6, tf: 1e-6, pw: 0.0026, per: 0.01 } },
        { type: 'R', name: 'R1', n1: 'in', n2: 'a', value: r },
        { type: 'L', name: 'L1', n1: 'a', n2: 'out', value: l },
        { type: 'C', name: 'C1', n1: 'out', n2: '0', value: c },
      ],
      analyses: [{ kind: 'tran', tstep: 4e-6, tstop: RLC_TSTOP, tstart: 0, uic: false }],
    }),
  },
  {
    id: 'rc',
    name: 'RC low pass',
    analysis: 'ac',
    knobs: [
      { key: 'r', label: 'Resistance', unit: 'Ω', min: 100, max: 100e3, def: 1.6e3 },
      { key: 'c', label: 'Capacitance', unit: 'F', min: 1e-9, max: 10e-6, def: 100e-9 },
    ],
    want: ['V(out)'],
    netlist: ({ r, c }) => ({
      nodes: ['in', 'out'],
      errors: [],
      elements: [
        { type: 'V', name: 'V1', n1: 'in', n2: '0', dc: 0, ac: { mag: 1, phase: 0 } },
        { type: 'R', name: 'R1', n1: 'in', n2: 'out', value: r },
        { type: 'C', name: 'C1', n1: 'out', n2: '0', value: c },
      ],
      analyses: [{ kind: 'ac', sweep: 'dec', n: 40, fstart: 1, fstop: 10e6 }],
    }),
  },
  {
    id: 'rect',
    name: 'Rectifier',
    analysis: 'tran',
    knobs: [
      { key: 'a', label: 'Source amplitude', unit: 'V', min: 2, max: 24, def: 12 },
      { key: 'c', label: 'Smoothing capacitor', unit: 'F', min: 10e-6, max: 1000e-6, def: 100e-6 },
      { key: 'r', label: 'Load', unit: 'Ω', min: 100, max: 10e3, def: 1e3 },
    ],
    want: ['V(in)', 'V(out)', 'I(D1)'],
    netlist: ({ a, c, r }) => ({
      nodes: ['in', 'out'],
      errors: [],
      elements: [
        { type: 'V', name: 'V1', n1: 'in', n2: '0', dc: 0, tran: { kind: 'sin', voff: 0, vamp: a, freq: RECT_F, td: 0, theta: 0, phase: 0 } },
        { type: 'D', name: 'D1', nA: 'in', nK: 'out', model: D1N4001 },
        { type: 'C', name: 'C1', n1: 'out', n2: '0', value: c },
        { type: 'R', name: 'R1', n1: 'out', n2: '0', value: r },
      ],
      analyses: [{ kind: 'tran', tstep: 25e-6, tstop: RECT_TSTOP, tstart: 0, uic: false }],
    }),
  },
]

// Log-scaled sliders: position 0..1000 to value.
export const toValue = (k: Knob, p: number) => k.min * Math.pow(k.max / k.min, p / 1000)
export const toPos = (k: Knob, v: number) => (1000 * Math.log(v / k.min)) / Math.log(k.max / k.min)

export const fmt = (v: number, unit: string) => {
  const a = Math.abs(v) * 1.0005
  const [m, s] = a >= 1e6 ? [1e-6, 'M'] : a >= 1e3 ? [1e-3, 'k'] : a >= 1 ? [1, ''] : a >= 1e-3 ? [1e3, 'm'] : a >= 1e-6 ? [1e6, 'µ'] : [1e9, 'n']
  const n = Math.round(v * m * 1000) / 1000
  const an = Math.abs(n)
  return `${an >= 100 ? n.toFixed(0) : an >= 10 ? n.toFixed(1) : n.toFixed(2)} ${s}${unit}`
}
