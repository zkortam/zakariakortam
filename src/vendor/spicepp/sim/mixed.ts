/**
 * Mixed-signal coupling: the event-driven digital kernel (src/lib/digital) running inside the
 * analog transient loop (engine.ts).
 *
 * THE CONTRACT
 *   • The digital side only ever consumes ACCEPTED analog steps. The kernel never rolls back, so
 *     it is advanced to an analog time only after the step that reached that time was accepted.
 *   • Every pending digital event is an analog breakpoint. The analog solver lands a timepoint on
 *     it before the kernel processes it, so a digital output that changes at t_e starts moving the
 *     analog circuit at exactly t_e, never at the end of whatever step happened to straddle it.
 *     (When the design has no analog-to-digital bridge the digital side cannot depend on the
 *     analog one, and the kernel runs ahead to the next output change instead: same answer,
 *     far fewer analog steps.)
 *   • An analog-to-digital bridge finds the time its input crosses a threshold by interpolating
 *     inside the step. A step that overshoots a crossing by more than the crossing tolerance is
 *     REJECTED and retried shorter, so the accepted timepoint lands within tolerance after the
 *     crossing; the digital input then changes at the interpolated crossing time, not at the end
 *     of the step. Thresholds have hysteresis: rising at vhi, falling at vlo.
 *   • A digital-to-analog bridge never steps. A change of level is a linear ramp over the rise or
 *     fall time (scaled by the fraction of the swing travelled), through a real output
 *     resistance. Ramp corners are breakpoints and discontinuities (Backward Euler restarts the
 *     integration there, as at any source corner).
 *
 * TIME. The kernel counts integer femtoseconds; the analog solver counts seconds. Conversion is
 * Math.round(t·1e15), exact to 1 fs over the kernel's 9.007 s range.
 *
 * DC. The operating point is a fixed point between the two sides: bridge levels → digital state
 * settled at t = 0 (every delay treated as zero, see KernelOptions.settleAtZero) → D2A levels →
 * analog solve → bridge levels, repeated until the levels stop changing.
 */
import {
  CircuitBuilder, Kernel, toFs, type NetlistIR, type Sig, type PartOptions,
} from "../digital";
import { DigitalSimError } from "../digital/errors";
import { LX, MERGE, BUF } from "../digital/logic";
import type {
  A2DBridge, DigitalDesign, DigitalPartSpec, DigitalResult, DigitalTrace, Netlist, NetlistElement,
} from "./types";

type D2AEl = Extract<NetlistElement, { type: "D2A" }>;

const FS_PER_S = 1e15;
const sec = (fs: number) => fs / FS_PER_S;

// ════════════════════════════════════════════════════════════════════════════════════════════
// Compile: DigitalDesign (plain data, survives postMessage) → kernel NetlistIR
// ════════════════════════════════════════════════════════════════════════════════════════════

/** Every part kind the compiler accepts, with the input / output port names it reads. */
export const DIGITAL_KINDS = [
  "and", "nand", "or", "nor", "xor", "xnor", "not", "buf", "tribuf", "const", "clock", "pattern",
  "dff", "jkff", "tff", "srff", "dlatch", "srlatch", "counter", "shiftreg", "mux", "decoder", "bcd7",
  "adcenc", "sink",
] as const;
export type DigitalKind = (typeof DIGITAL_KINDS)[number];

const GATE_TABLE: Record<string, "and" | "nand" | "or" | "nor" | "xor" | "xnor"> = {
  and: "and", nand: "nand", or: "or", nor: "nor", xor: "xor", xnor: "xnor",
};
/** The input level that leaves a gate's output to its other inputs (AND 1, OR 0). */
const NON_CONTROLLING: Record<string, 0 | 1> = { and: 1, nand: 1, or: 0, nor: 0, xor: 0, xnor: 0 };

/** Seven-segment patterns for hex digits 0..F, bit k = segment a..g (active high). */
export const SEG7_HEX: number[] = [
  0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f, 0x77, 0x7c, 0x39, 0x5e, 0x79, 0x71,
];

export interface CompiledDesign {
  ir: NetlistIR;
  /** Signal names the host drives (A2D outputs). */
  hostSignals: Set<string>;
  /** Info-level notes produced while compiling (unused inputs tied, etc.). */
  notes: string[];
}

function numParam(p: DigitalPartSpec, key: string, dflt: number): number {
  const v = p.params?.[key];
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : dflt;
}
function strParam(p: DigitalPartSpec, key: string, dflt: string): string {
  const v = p.params?.[key];
  return v === undefined || v === null ? dflt : String(v);
}

/** Seconds → femtoseconds for a delay or period, refusing what the kernel cannot represent. */
function fsOf(p: DigitalPartSpec, what: string, seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) throw new DigitalSimError("bad-time", `${p.ref ?? p.name}: ${what} must be a non-negative time; got ${seconds}`);
  return toFs(seconds);
}

export function compileDigital(design: DigitalDesign): CompiledDesign {
  const b = new CircuitBuilder();
  const notes: string[] = [];
  const sigs = new Map<string, Sig>();
  const hostSignals = new Set<string>();
  for (const n of design.nets) {
    if (sigs.has(n.name)) continue;
    if (n.host) { sigs.set(n.name, b.input(n.name)); hostSignals.add(n.name); }
    else sigs.set(n.name, b.wire(n.name));
  }
  const tie0 = b.tie(0, 1), tie1 = b.tie(1, 1), tieX = b.tie("x", 1);
  const sigOf = (name: string | null | undefined): Sig | null => {
    if (!name) return null;
    const s = sigs.get(name);
    if (!s) throw new DigitalSimError("bad-netlist", `digital signal "${name}" is not declared`);
    return s;
  };
  let privates = 0;
  /** An output port: its net, or a private wire when nothing is connected. */
  const outSig = (p: DigitalPartSpec, port: string): Sig => {
    const s = sigOf(p.outs[port]);
    return s ?? b.wire(`${p.name}.${port}#${++privates}`);
  };
  /** An input port: its net, or a constant when nothing is connected. */
  const inSig = (p: DigitalPartSpec, port: string, unconnected: Sig): Sig => sigOf(p.ins[port]) ?? unconnected;
  const optIn = (p: DigitalPartSpec, port: string): Sig | undefined => sigOf(p.ins[port]) ?? undefined;
  const indexed = (rec: Record<string, string | null>, prefix: string): string[] =>
    Object.keys(rec).filter((k) => new RegExp(`^${prefix}\\d+$`).test(k)).sort((a, b2) => Number(a.slice(prefix.length)) - Number(b2.slice(prefix.length)));

  for (const p of design.parts) {
    const delay = fsOf(p, "delay", numParam(p, "delay", 0));
    const o: PartOptions = { name: p.name, src: p.ref, rise: delay, fall: delay, turnoff: delay };
    const init = strParam(p, "init", "0").toLowerCase();
    const initV = init === "1" ? 1 : init === "x" ? "x" : 0;
    const edge = strParam(p, "edge", "rising") === "falling" ? "falling" as const : "rising" as const;
    switch (p.kind) {
      case "and": case "nand": case "or": case "nor": case "xor": case "xnor": {
        const keys = Object.keys(p.ins);
        const nc = NON_CONTROLLING[p.kind] ? tie1 : tie0;
        let unused = 0;
        const ins = keys.map((k) => { const s = sigOf(p.ins[k]); if (!s) unused++; return s ?? nc; });
        if (unused && unused < keys.length) notes.push(`${p.ref ?? p.name}: ${unused} unused input${unused > 1 ? "s" : ""} tied to logic ${NON_CONTROLLING[p.kind]}, which leaves the output to the connected inputs.`);
        b[GATE_TABLE[p.kind]](ins, outSig(p, "Y"), o);
        break;
      }
      case "not": b.not(inSig(p, "A", tieX), outSig(p, "Y"), o); break;
      case "buf": b.buf(inSig(p, "A", tieX), outSig(p, "Y"), o); break;
      case "tribuf":
        b.tribuf(inSig(p, "A", tieX), inSig(p, "EN", strParam(p, "activeLow", "false") === "true" ? tie0 : tie1), outSig(p, "Y"),
          { ...o, activeLow: strParam(p, "activeLow", "false") === "true" });
        break;
      case "const": b.constant(outSig(p, "Y"), numParam(p, "value", 0) ? 1 : 0, o); break;
      case "clock": {
        const period = fsOf(p, "period", numParam(p, "period", 1e-6));
        const duty = Math.min(0.99, Math.max(0.01, numParam(p, "duty", 0.5)));
        let high = Math.round(period * duty);
        if (high <= 0) high = 1;
        if (high >= period) high = period - 1;
        const offset = fsOf(p, "delay", numParam(p, "offset", 0));
        if (period < 2) throw new DigitalSimError("bad-time", `${p.ref ?? p.name}: clock period is too short`);
        b.clock(outSig(p, "Y"), { ...o, period, high, offset, rise: 0, fall: 0, turnoff: 0 });
        break;
      }
      case "pattern": {
        const bits = strParam(p, "bits", "0").replace(/[^01xzXZ]/g, "");
        const step = fsOf(p, "step", numParam(p, "step", 1e-6));
        const offset = fsOf(p, "delay", numParam(p, "offset", 0));
        if (!bits.length) throw new DigitalSimError("bad-netlist", `${p.ref ?? p.name}: pattern needs at least one bit`);
        if (step <= 0) throw new DigitalSimError("bad-time", `${p.ref ?? p.name}: pattern step must be positive`);
        const steps = [...bits].map((ch, i) => ({ at: offset + i * step, value: ch.toLowerCase() }));
        const repeat = strParam(p, "repeat", "true") !== "false";
        b.pattern(outSig(p, "Y"), steps, { ...o, rise: 0, fall: 0, turnoff: 0, ...(repeat ? { repeat: offset + bits.length * step } : {}) });
        break;
      }
      case "dff": case "jkff": case "tff": case "srff": {
        const common = {
          ...o, clk: inSig(p, "CLK", tieX), clkEdge: edge, set: optIn(p, "SET"), reset: optIn(p, "RST"), en: optIn(p, "EN"),
          init: initV, q: outSig(p, "Q"), qn: outSig(p, "QN"),
        };
        if (p.kind === "dff") b.dff({ ...common, d: inSig(p, "D", tieX) });
        else if (p.kind === "jkff") b.jkff({ ...common, j: inSig(p, "J", tieX), k: inSig(p, "K", tieX) });
        else if (p.kind === "tff") b.tff({ ...common, t: optIn(p, "T") });
        else b.srff({ ...common, s: inSig(p, "S", tieX), r: inSig(p, "R", tieX) });
        break;
      }
      case "dlatch":
        b.dlatch({ ...o, d: inSig(p, "D", tieX), en: inSig(p, "EN", tieX), reset: optIn(p, "RST"), init: initV, q: outSig(p, "Q"), qn: outSig(p, "QN") });
        break;
      case "srlatch":
        b.srlatch({ ...o, s: inSig(p, "S", tie0), r: inSig(p, "R", tie0), q: outSig(p, "Q"), qn: outSig(p, "QN"), init: init === "1" ? 1 : init === "x" ? undefined : 0 });
        break;
      case "counter": {
        const qs = indexed(p.outs, "Q").map((k) => outSig(p, k));
        if (!qs.length) throw new DigitalSimError("bad-netlist", `${p.ref ?? p.name}: counter has no outputs`);
        const mod = Math.round(numParam(p, "modulus", 2 ** qs.length));
        const q = b.concat(...qs);
        b.counter({
          ...o, clk: inSig(p, "CLK", tieX), clkEdge: edge, reset: optIn(p, "RST"), en: optIn(p, "EN"), up: optIn(p, "UP"),
          init: 0, q, modulus: Math.max(2, Math.min(2 ** qs.length, mod)), tc: outSig(p, "TC"),
        });
        break;
      }
      case "shiftreg": {
        const qs = indexed(p.outs, "Q").map((k) => outSig(p, k));
        if (!qs.length) throw new DigitalSimError("bad-netlist", `${p.ref ?? p.name}: shift register has no outputs`);
        b.shiftRegister({
          ...o, clk: inSig(p, "CLK", tieX), clkEdge: edge, reset: optIn(p, "RST"), en: optIn(p, "EN"),
          serialIn: inSig(p, "SI", tie0), init: 0, q: b.concat(...qs), dir: strParam(p, "dir", "left") === "right" ? "right" : "left",
        });
        break;
      }
      case "mux": {
        const data = indexed(p.ins, "I").map((k) => inSig(p, k, tieX));
        const sel = indexed(p.ins, "S").map((k) => inSig(p, k, tie0));
        b.mux({ ...o, inputs: data, sel: b.concat(...sel), y: outSig(p, "Y"), en: optIn(p, "EN") });
        break;
      }
      case "decoder": {
        const a = indexed(p.ins, "A").map((k) => inSig(p, k, tie0));
        const ys = indexed(p.outs, "Y").map((k) => outSig(p, k));
        b.decoder({ ...o, a: b.concat(...a), y: b.concat(...ys), en: optIn(p, "EN"), activeLow: strParam(p, "activeLow", "false") === "true" });
        break;
      }
      case "bcd7": {
        const a = ["A", "B", "C", "D"].map((k) => inSig(p, k, tie0));
        const segs = ["a", "b", "c", "d", "e", "f", "g"].map((k) => outSig(p, k));
        const out = new Uint8Array(7);
        b.custom({
          type: "bcd7", name: p.name, src: p.ref, sequential: false,
          inputs: { A: [...b.concat(...a).nets] },
          outputs: { Y: { nets: [...b.concat(...segs).nets], delay: { rise: delay, fall: delay } } },
          create: () => (k, c) => {
            const v = k.read(c.ins[0]);
            const xs: number[] = [];
            let base = 0;
            for (let i = 0; i < 4; i++) { const bv = BUF[v[i]]; if (bv === LX) xs.push(i); else base |= bv << i; }
            // Every completion of the unknown bits; a segment is defined only where they agree.
            let acc = -1;
            for (let m = 0; m < 1 << xs.length; m++) {
              let code = base;
              xs.forEach((bit, j) => { if ((m >> j) & 1) code |= 1 << bit; });
              const pat = SEG7_HEX[code];
              for (let s = 0; s < 7; s++) {
                const sv = (pat >> s) & 1;
                out[s] = acc < 0 ? sv : MERGE[out[s] * 4 + sv];
              }
              acc = 0;
            }
            k.drive(c.outs[0], out);
          },
        });
        break;
      }
      case "adcenc": {
        // Thermometer comparators C1..Cm (from A2D bridges) → binary code. With CLK connected
        // the code is sampled on the clock edge (a sampling ADC); without, it follows the input.
        const cs = indexed(p.ins, "C").map((k) => inSig(p, k, tieX));
        const qs = indexed(p.outs, "Q").map((k) => outSig(p, k));
        const clk = optIn(p, "CLK");
        const w = qs.length;
        const qcat = b.concat(...qs);
        const inputs: Record<string, number[]> = { C: [...b.concat(...cs).nets] };
        if (clk) inputs.CLK = [...clk.nets];
        b.custom({
          type: "adc", name: p.name, src: p.ref, sequential: !!clk, inputs,
          outputs: { Q: { nets: [...qcat.nets], delay: { rise: delay, fall: delay } } },
          create: () => {
            const held = new Uint8Array(w);
            let prevClk = LX as number;
            return (k, c) => {
              const t = k.read(c.ins[0]);
              const code = new Uint8Array(w);
              let n = 0, undef = false;
              for (let i = 0; i < t.length; i++) { const v = BUF[t[i]]; if (v === LX) undef = true; else n += v; }
              for (let i = 0; i < w; i++) code[i] = undef ? LX : (n >> i) & 1;
              if (!clk) { k.drive(c.outs[0], code); return; }
              const ck = BUF[k.bit(c.ins[1][0])];
              const rising = !c.first && prevClk === 0 && ck === 1;
              prevClk = ck;
              if (c.first) { held.set(code); k.drive(c.outs[0], held); return; }
              if (rising) { held.set(code); k.drive(c.outs[0], held); }
            };
          },
        });
        break;
      }
      case "sink": break;
      default:
        throw new DigitalSimError("unknown-cell", `${p.ref ?? p.name}: digital part kind "${p.kind}" is not supported`);
    }
  }
  return { ir: b.build(), hostSignals, notes };
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// D2A output waveform: piecewise-linear level and conductance, built edge by edge
// ════════════════════════════════════════════════════════════════════════════════════════════

interface Seg { t0: number; t1: number; v0: number; v1: number; g0: number; g1: number; }

export class D2AWave {
  private segs: Seg[] = [];
  private vInit = 0;
  private gInit = 1;
  /** Edges applied over the run (for statistics and tests). */
  edges = 0;

  reset(v: number, g: number): void { this.segs = []; this.vInit = v; this.gInit = g; this.edges = 0; }

  /** Level and output conductance at time t. NaN (a DC solve) reads the latest settled value. */
  at(t: number): { v: number; g: number } {
    const s = this.segs;
    if (!s.length) return { v: this.vInit, g: this.gInit };
    if (!Number.isFinite(t)) { const l = s[s.length - 1]; return { v: l.v1, g: l.g1 }; }
    // last segment with t0 <= t
    let lo = 0, hi = s.length - 1, k = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (s[m].t0 <= t) { k = m; lo = m + 1; } else hi = m - 1; }
    if (k < 0) return { v: this.vInit, g: this.gInit };
    const g = s[k];
    if (t >= g.t1) return { v: g.v1, g: g.g1 };
    const f = (t - g.t0) / (g.t1 - g.t0);
    return { v: g.v0 + f * (g.v1 - g.v0), g: g.g0 + f * (g.g1 - g.g0) };
  }

  /**
   * Starts a ramp at time t toward (v, g) and returns its end time (or t when nothing changes).
   * A ramp interrupted by a newer edge is cut where it was: the new ramp starts from the level
   * actually reached, so a short pulse becomes the runt pulse real hardware produces.
   */
  edge(t: number, v: number, g: number, durFor: (dv: number) => number): number {
    const cur = this.at(t);
    if (cur.v === v && cur.g === g) return t;
    const s = this.segs;
    while (s.length && s[s.length - 1].t0 >= t) s.pop();
    if (s.length) { const l = s[s.length - 1]; if (l.t1 > t) { l.v1 = cur.v; l.g1 = cur.g; l.t1 = t; } }
    let dur = durFor(v - cur.v);
    if (!(dur > 0)) dur = 1e-15;
    s.push({ t0: t, t1: t + dur, v0: cur.v, v1: v, g0: cur.g, g1: g });
    this.edges++;
    return t + dur;
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// Runtime
// ════════════════════════════════════════════════════════════════════════════════════════════

export interface Crossing { bridge: number; tc: number; to: 0 | 1; }
export interface Breakpoint { t: number; disc: boolean; }

interface A2DState { br: A2DBridge; ni: number; nr: number; level: 0 | 1 | null; }
interface D2AState { el: D2AEl; wave: D2AWave; swing: number; pending: number[]; }

/** Node index lookup shared with the engine's Indexer (−1 = ground). */
export interface NodeIndex { node(name: string): number; }

export class MixedSim {
  readonly compiled: CompiledDesign;
  readonly design: DigitalDesign;
  kernel: Kernel | null = null;
  private a2d: A2DState[] = [];
  private d2a: D2AState[] = [];
  private stats = { crossings: 0 };
  /** No analog-to-digital bridge: the digital side cannot depend on the analog side. */
  readonly runAhead: boolean;
  private tstopFs = 0;
  private bpOut: Breakpoint[] = [];
  /** Whether the last dcFixedPoint closed (false: the logic and analog loop has no static state). */
  lastDcConsistent = true;
  private discAt: number | null = null;

  constructor(nl: Netlist, ix: NodeIndex) {
    this.design = nl.digital!;
    this.compiled = compileDigital(this.design);
    for (const br of this.design.a2d) this.a2d.push({ br, ni: ix.node(br.node), nr: ix.node(br.ref), level: null });
    for (const el of nl.elements) {
      if (el.type !== "D2A") continue;
      const wave = new D2AWave();
      (el as unknown as { _wave?: D2AWave })._wave = wave;
      const full = Math.abs(el.vstep) * (2 ** el.bits.length - 1);
      this.d2a.push({ el, wave, swing: full > 0 ? full : 1, pending: [] });
    }
    this.runAhead = this.a2d.length === 0;
  }

  get notes(): string[] { return this.compiled.notes; }
  get bridgeCount(): number { return this.a2d.length; }

  private voltage(s: A2DState, x: number[]): number {
    return (s.ni < 0 ? 0 : x[s.ni]) - (s.nr < 0 ? 0 : x[s.nr]);
  }

  /** Bridge levels the analog solution x implies, with hysteresis around `prev`. */
  classify(x: number[], prev: (0 | 1 | null)[] = this.a2d.map((s) => s.level)): (0 | 1)[] {
    return this.a2d.map((s, i) => {
      const v = this.voltage(s, x);
      if (v >= s.br.vhi) return 1;
      if (v <= s.br.vlo) return 0;
      const p = prev[i];
      return p ?? (v >= (s.br.vhi + s.br.vlo) / 2 ? 1 : 0);
    });
  }

  /**
   * A fresh kernel settled at t = 0 with the bridge inputs at `levels` (null = unknown, X), and
   * every D2A output set to the static level that state drives. Used by every DC solve.
   */
  initAtZero(levels: (0 | 1 | null)[]): void {
    const k = new Kernel(this.compiled.ir, { settleAtZero: true });
    this.a2d.forEach((s, i) => { s.level = levels[i]; if (levels[i] !== null) k.setInput(s.br.signal, levels[i]!, 0); });
    k.advanceTo(0);
    this.kernel = k;
    for (const d of this.d2a) {
      const { v, g } = this.levelOf(d, k);
      d.wave.reset(v, g);
      d.pending = [];
    }
  }

  /** Static analog level and conductance a D2A drives for its bits' current values. */
  private levelOf(d: D2AState, k: Kernel, tFs?: number): { v: number; g: number } {
    const el = d.el;
    let code = 0, undef = false, allZ = true;
    for (let i = 0; i < el.bits.length; i++) {
      const lv = tFs === undefined || tFs >= k.now ? k.get(el.bits[i]) : k.valueAt(el.bits[i], tFs);
      const c = lv.bit(0);
      if (c !== 2) allZ = false;
      if (c > 1) undef = true; else code |= c << i;
    }
    const gOn = 1 / Math.max(el.rout, 1e-6);
    const gOff = 1 / Math.max(el.roff, el.rout * 10, 1);
    if (allZ) return { v: d.wave.at(Number.NaN).v, g: gOff };
    return { v: undef ? el.vundef : el.v0 + code * el.vstep, g: gOn };
  }

  /**
   * Fixed point between the digital state and the analog operating point. `solve(seed)` is one
   * analog DC solve with the D2A outputs as they currently stand. Returns the last solution and
   * whether the bridge levels it implies are the ones the digital side was settled with.
   */
  dcFixedPoint<R extends { x: number[] }>(solve: (seed: number[] | null) => R | null, seed: number[] | null): { r: R | null; consistent: boolean; iterations: number } {
    const out = this.fixedPointInner(solve, seed);
    this.lastDcConsistent = out.consistent;
    return out;
  }

  private fixedPointInner<R extends { x: number[] }>(solve: (seed: number[] | null) => R | null, seed: number[] | null): { r: R | null; consistent: boolean; iterations: number } {
    let levels: (0 | 1 | null)[] = this.a2d.map(() => null);
    let r: R | null = null;
    let s = seed;
    const seen = new Set<string>();
    for (let it = 1; it <= 24; it++) {
      this.initAtZero(levels);
      r = solve(s);
      if (!r) return { r: null, consistent: false, iterations: it };
      if (!this.a2d.length) return { r, consistent: true, iterations: it };
      const next = this.classify(r.x, levels);
      if (next.every((v, i) => v === levels[i])) return { r, consistent: true, iterations: it };
      const key = next.join("");
      if (seen.has(key)) {
        // A cycle: the circuit has no static state (an oscillator closed through the analog
        // side). The transient starts from this analog solution with the logic settled on what
        // its bridges READ there; the outputs that disagree with it then move the circuit at
        // t = 0, which is how such a loop starts. No bridge ever begins out of step with the
        // voltage it watches, so nothing downstream sees a phantom edge at the first step.
        this.initAtZero(next);
        return { r, consistent: false, iterations: it };
      }
      seen.add(key);
      levels = next;
      s = r.x;
    }
    return { r, consistent: false, iterations: 24 };
  }

  /** Arms the transient: watchers on every D2A bit, bridge states from the initial solution. */
  beginTransient(x0: number[], tstop: number): void {
    const k = this.kernel;
    if (!k) throw new DigitalSimError("halted", "digital side was not initialised before the transient");
    this.tstopFs = toFs(Math.max(0, tstop));
    // UIC (or a fixed point that did not close) can leave a bridge level the solution disagrees
    // with: the state the kernel was settled with is the truth, and the first step corrects it.
    for (const d of this.d2a) {
      for (const b of d.el.bits) k.onChange(b, (_v, tFs) => { const p = d.pending; if (p[p.length - 1] !== tFs) p.push(tFs); });
    }
    void x0;
  }

  /** Next time (s) the digital side needs the analog solver to land on, or null. */
  nextEventTime(): number | null {
    const k = this.kernel;
    if (!k) return null;
    const t = k.nextEventTime();
    if (t === null || t > this.tstopFs) return null;
    return sec(t);
  }

  /** Earliest threshold crossing in (t0, t1], by linear interpolation of the bridge voltage. */
  findCrossing(t0: number, x0: number[], t1: number, x1: number[]): Crossing | null {
    let best: Crossing | null = null;
    for (let i = 0; i < this.a2d.length; i++) {
      const s = this.a2d[i];
      const v0 = this.voltage(s, x0), v1 = this.voltage(s, x1);
      let th: number, to: 0 | 1;
      if (s.level !== 1 && v1 >= s.br.vhi) { th = s.br.vhi; to = 1; }
      else if (s.level !== 0 && v1 <= s.br.vlo) { th = s.br.vlo; to = 0; }
      else continue;
      const dv = v1 - v0;
      let f = dv !== 0 ? (th - v0) / dv : 1;
      if (!(f >= 0)) f = 0;
      if (f > 1) f = 1;
      const tc = t0 + f * (t1 - t0);
      if (!best || tc < best.tc) best = { bridge: i, tc, to };
    }
    return best;
  }

  /** Every crossing inside an accepted step, in time order. */
  private crossingsIn(t0: number, x0: number[], t1: number, x1: number[]): Crossing[] {
    const out: Crossing[] = [];
    for (let i = 0; i < this.a2d.length; i++) {
      const s = this.a2d[i];
      const v0 = this.voltage(s, x0), v1 = this.voltage(s, x1);
      let th: number, to: 0 | 1;
      if (s.level !== 1 && v1 >= s.br.vhi) { th = s.br.vhi; to = 1; }
      else if (s.level !== 0 && v1 <= s.br.vlo) { th = s.br.vlo; to = 0; }
      else continue;
      const dv = v1 - v0;
      let f = dv !== 0 ? (th - v0) / dv : 1;
      if (!(f >= 0)) f = 0;
      if (f > 1) f = 1;
      out.push({ bridge: i, tc: t0 + f * (t1 - t0), to });
    }
    return out.sort((a, b) => a.tc - b.tc);
  }

  /**
   * The analog step t0 → t1 was accepted. Applies its crossings at their interpolated times,
   * advances the kernel to t1 and turns every digital output change into a D2A ramp.
   * Returns the breakpoints the ramps need and whether a ramp started at or before t1 (the
   * next step then starts at a discontinuity).
   */
  accept(t0: number, x0: number[], t1: number, x1: number[]): { bps: Breakpoint[]; discNow: boolean } {
    const k = this.kernel!;
    this.bpOut = [];
    this.discAt = null;
    const t1Fs = Math.min(toFs(t1), this.tstopFs);
    for (const c of this.crossingsIn(t0, x0, t1, x1)) {
      const s = this.a2d[c.bridge];
      s.level = c.to;
      this.stats.crossings++;
      const at = Math.max(k.now, Math.min(toFs(c.tc), t1Fs));
      k.setInput(s.br.signal, c.to, at);
    }
    if (t1Fs >= k.now) k.advanceTo(t1Fs);
    this.flushEdges(t1);
    if (this.runAhead) this.runAheadToNextEdge(t1);
    return { bps: this.bpOut, discNow: this.discAt !== null && this.discAt <= t1 + 1e-18 };
  }

  /** Breakpoints needed before the first step (the first output change, when running ahead). */
  prime(): Breakpoint[] {
    this.bpOut = [];
    this.discAt = null;
    if (this.runAhead) this.runAheadToNextEdge(0);
    return this.bpOut;
  }

  /** With no A2D bridge, step the kernel until a D2A output changes (or the run ends). */
  private runAheadToNextEdge(t1: number): void {
    const k = this.kernel!;
    for (let guard = 0; guard < 5_000_000; guard++) {
      if (this.bpOut.some((b) => b.t > t1)) return;
      const nt = k.nextEventTime();
      if (nt === null || nt > this.tstopFs) return;
      k.step();
      this.flushEdges(t1);
    }
  }

  /** Turns queued D2A bit changes into ramps; records breakpoints for their corners. */
  private flushEdges(t1: number): void {
    const k = this.kernel!;
    for (const d of this.d2a) {
      if (!d.pending.length) continue;
      const times = d.pending; d.pending = [];
      for (const tFs of times) {
        const t = sec(tFs);
        const { v, g } = this.levelOf(d, k, tFs);
        const el = d.el;
        const tEnd = d.wave.edge(t, v, g, (dv) => (dv >= 0 ? el.tr : el.tf) * Math.max(Math.abs(dv) / d.swing, 1e-3));
        if (tEnd <= t) continue;
        // The ramp's corners are landed on (and the ramp gets at least four steps) but they are
        // NOT discontinuities: the level is continuous and only its slope changes, which the
        // trapezoidal rule integrates to second order. Forcing Backward Euler there would put a
        // first-order error of (step × slope change) into every node the output drives.
        const dur = tEnd - t;
        if (t > t1) this.bpOut.push({ t, disc: false });
        for (let q = 1; q < 4; q++) if (t + (q * dur) / 4 > t1) this.bpOut.push({ t: t + (q * dur) / 4, disc: false });
        if (tEnd > t1) this.bpOut.push({ t: tEnd, disc: false });
      }
    }
  }

  /** Runs the digital side alone to `tstop` (a circuit with no analog part). */
  runDigitalOnly(tstop: number): void {
    const k = this.kernel!;
    k.advanceTo(toFs(Math.max(0, tstop)));
  }

  result(): DigitalResult {
    const k = this.kernel;
    const traces: DigitalTrace[] = [];
    let events = 0, steps = 0, d2aEdges = 0;
    if (k) {
      events = k.stats.events; steps = k.stats.steps;
      for (const s of k.signals()) {
        if (s.hidden || s.name.includes("#")) continue;
        const tr = k.getTrace(s.name);
        const net = this.design.netOf?.[s.name];
        traces.push({
          name: s.name, width: s.width,
          t: tr.times.map(sec), v: tr.values.map((v) => v.toString()),
          ...(net && net !== s.name ? { net } : {}),
        });
      }
    }
    for (const d of this.d2a) d2aEdges += d.wave.edges;
    return {
      traces,
      analyzers: this.design.analyzers ?? [],
      displays: this.design.displays ?? [],
      stats: { events, steps, crossings: this.stats.crossings, d2aEdges },
    };
  }
}

/** The D2A wave attached to an element by MixedSim (undefined outside a mixed run). */
export function d2aWaveOf(el: NetlistElement): D2AWave | undefined {
  return (el as unknown as { _wave?: D2AWave })._wave;
}

/** Plain-language form of a kernel failure for the result's error list. */
export function digitalErrorMessage(e: unknown): string {
  if (e instanceof DigitalSimError) {
    if (e.code === "delta-overflow") return `Digital: ${e.message}. A loop of zero-delay logic never settles; give the gates in the loop a propagation delay.`;
    return `Digital: ${e.message}`;
  }
  return `Digital: ${String((e as Error)?.message ?? e)}`;
}
