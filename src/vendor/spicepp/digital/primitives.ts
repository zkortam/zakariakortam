/**
 * Primitive part library and the builder that wires parts into a netlist.
 *
 * These are the parts a schematic places: gates of any input count, tri-state buffers, pulls,
 * flip-flops, latches, counters, shift registers, multiplexers, decoders and sources. Each
 * output takes rise / fall (and turn-off) delays in femtoseconds, inertial by default.
 *
 * X handling is hardware-pessimistic but exact: an output is X only when the unknown inputs
 * could really make it differ. Gates use the Verilog 3-valued tables (0 AND x = 0); sequential
 * parts evaluate every 0/1 completion of their unknown controls and merge the outcomes, so a
 * JK flop with J=1, K=0 sets even from an unknown state, while an unknown clock edge or enable
 * leaves only the bits that agree. A Z on any input reads as X.
 */

import { DigitalSimError } from "./errors";
import type { CellDef, CellEval, DelaySpec, NetlistIR, OutputDef, SignalDef, SignalKind, Kernel, Cell } from "./kernel";
import { AND, BUF, L0, L1, LX, LZ, MERGE, NOT, OR, Strength, XOR, bigToCodes, codesToBig, toCodes, type ValueLike } from "./logic";

/** A handle on a group of nets (a wire, a bus, a slice or a concatenation). */
export interface Sig {
  readonly name: string;
  readonly nets: readonly number[];
  readonly width: number;
}

export interface PartOptions extends DelaySpec {
  /** Instance name (unique within the circuit); generated when omitted. */
  name?: string;
  /** Source location or schematic reference, carried into change records. */
  src?: string;
  /** Drive strength of a 0 / 1 output (default Strong). HighZ makes that level float. */
  strength0?: Strength;
  strength1?: Strength;
}

export type Edge = "rising" | "falling";

interface SeqCommon extends PartOptions {
  clk: Sig;
  clkEdge?: Edge;
  /** Asynchronous set / reset, active high unless `setActive` / `resetActive` is 0. */
  set?: Sig;
  reset?: Sig;
  setActive?: 0 | 1;
  resetActive?: 0 | 1;
  /** Treat `set` / `reset` as synchronous (sampled at the clock edge) instead. */
  syncSetReset?: boolean;
  /** Clock enable, active high unless `enActive` is 0. */
  en?: Sig;
  enActive?: 0 | 1;
  /** Power-on state; X when omitted. */
  init?: ValueLike;
  q: Sig;
  qn?: Sig;
}

const sigOf = (name: string, nets: readonly number[]): Sig => ({ name, nets, width: nets.length });

export class CircuitBuilder {
  private netCount = 4;
  private readonly signals: SignalDef[] = [];
  private readonly cells: CellDef[] = [];
  private readonly used = new Set<string>();
  private readonly counters = new Map<string, number>();

  // ─────────────── nets and signals ───────────────

  private newSignal(name: string, width: number, kind: SignalKind, src?: string): Sig {
    if (!Number.isInteger(width) || width < 1) throw new DigitalSimError("bad-netlist", `signal "${name}" needs a positive integer width; got ${width}`);
    if (this.used.has(name)) throw new DigitalSimError("bad-netlist", `name "${name}" is already used`, { name });
    this.used.add(name);
    const nets: number[] = [];
    for (let i = 0; i < width; i++) nets.push(this.netCount++);
    this.signals.push({ name, nets, kind, src });
    return sigOf(name, nets);
  }

  /** An internal wire or bus. */
  wire(name: string, width = 1): Sig { return this.newSignal(name, width, "wire"); }
  /** A design input, driven from outside with `setInput` (starts X). */
  input(name: string, width = 1): Sig { return this.newSignal(name, width, "input"); }
  /** A design output (a wire that hosts should read). */
  output(name: string, width = 1): Sig { return this.newSignal(name, width, "output"); }
  /** A bidirectional pin: driven from outside with `setInput` (starts released, Z) and from inside. */
  inout(name: string, width = 1): Sig { return this.newSignal(name, width, "inout"); }

  /** A constant tie (no cell): bits of `value` map onto the constant nets 0/1/Z/X. */
  tie(value: ValueLike, width: number): Sig {
    const c = toCodes(value, width);
    return sigOf(`tie(${Array.from(c).reverse().map(v => "01zx"[v]).join("")})`, Array.from(c));
  }

  /** Bits [lo, lo+len) of a signal. */
  slice(s: Sig, lo: number, len = 1): Sig {
    if (lo < 0 || len < 1 || lo + len > s.width) throw new DigitalSimError("bad-netlist", `slice [${lo}+:${len}] is outside "${s.name}" (width ${s.width})`);
    return sigOf(len === 1 ? `${s.name}[${lo}]` : `${s.name}[${lo + len - 1}:${lo}]`, s.nets.slice(lo, lo + len));
  }

  /** Concatenation, LSB part first. */
  concat(...parts: Sig[]): Sig { return sigOf(`{${parts.map(p => p.name).reverse().join(",")}}`, parts.flatMap(p => [...p.nets])); }

  // ─────────────── cell plumbing ───────────────

  private autoName(kind: string, name?: string): string {
    if (name !== undefined) {
      if (this.used.has(name)) throw new DigitalSimError("bad-netlist", `name "${name}" is already used`, { name });
      this.used.add(name);
      return name;
    }
    let n = this.counters.get(kind) ?? 0;
    let nm: string;
    do nm = `${kind}${++n}`; while (this.used.has(nm));
    this.counters.set(kind, n);
    this.used.add(nm);
    return nm;
  }

  private out(s: Sig, o: PartOptions): OutputDef {
    return { nets: [...s.nets], delay: { delay: o.delay, rise: o.rise, fall: o.fall, turnoff: o.turnoff, transport: o.transport }, s0: o.strength0, s1: o.strength1 };
  }

  private add(type: string, o: PartOptions, inputs: Record<string, Sig | undefined>, outputs: Record<string, Sig | undefined>, create: () => CellEval, sequential = false): string {
    const name = this.autoName(type, o.name);
    const ins: Record<string, number[]> = {};
    for (const [k, v] of Object.entries(inputs)) if (v) ins[k] = [...v.nets];
    const outs: Record<string, OutputDef> = {};
    for (const [k, v] of Object.entries(outputs)) if (v) outs[k] = this.out(v, o);
    this.cells.push({ type, name, src: o.src, inputs: ins, outputs: outs, sequential, create });
    return name;
  }

  private sameWidth(what: string, w: number, ...ss: (Sig | undefined)[]): void {
    for (const s of ss) if (s && s.width !== w) throw new DigitalSimError("bad-netlist", `${what}: "${s.name}" is ${s.width} bits, expected ${w}`, { signal: s.name, width: s.width, expected: w });
  }

  private oneBit(what: string, ...ss: (Sig | undefined)[]): void { this.sameWidth(what, 1, ...ss); }

  // ─────────────── combinational gates ───────────────

  private gate(kind: string, table: Uint8Array | null, invert: boolean, inputs: Sig[], y: Sig, o: PartOptions): string {
    if (inputs.length < (kind === "not" || kind === "buf" ? 1 : 2) || ((kind === "not" || kind === "buf") && inputs.length !== 1))
      throw new DigitalSimError("bad-netlist", `${kind} gate needs ${kind === "not" || kind === "buf" ? "exactly one input" : "at least two inputs"}`);
    this.sameWidth(kind, y.width, ...inputs);
    const named: Record<string, Sig> = {};
    inputs.forEach((s, i) => { named[`A${i}`] = s; });
    return this.add(kind, o, named, { Y: y }, () => {
      const out = new Uint8Array(y.width);
      return (k, c) => {
        const ins = c.ins, w = out.length;
        if (w === 1) {
          // Scalar fast path: no buffers at all.
          let v = BUF[k.bit(ins[0][0])];
          for (let j = 1; j < ins.length; j++) v = table![v * 4 + k.bit(ins[j][0])];
          out[0] = invert ? NOT[v] : v;
        } else {
          for (let i = 0; i < w; i++) out[i] = BUF[k.bit(ins[0][i])];
          for (let j = 1; j < ins.length; j++) { const nets = ins[j]; for (let i = 0; i < w; i++) out[i] = table![out[i] * 4 + k.bit(nets[i])]; }
          if (invert) for (let i = 0; i < w; i++) out[i] = NOT[out[i]];
        }
        k.drive(c.outs[0], out);
      };
    });
  }

  and(inputs: Sig[], y: Sig, o: PartOptions = {}): string { return this.gate("and", AND, false, inputs, y, o); }
  nand(inputs: Sig[], y: Sig, o: PartOptions = {}): string { return this.gate("nand", AND, true, inputs, y, o); }
  or(inputs: Sig[], y: Sig, o: PartOptions = {}): string { return this.gate("or", OR, false, inputs, y, o); }
  nor(inputs: Sig[], y: Sig, o: PartOptions = {}): string { return this.gate("nor", OR, true, inputs, y, o); }
  xor(inputs: Sig[], y: Sig, o: PartOptions = {}): string { return this.gate("xor", XOR, false, inputs, y, o); }
  xnor(inputs: Sig[], y: Sig, o: PartOptions = {}): string { return this.gate("xnor", XOR, true, inputs, y, o); }
  not(a: Sig, y: Sig, o: PartOptions = {}): string { return this.gate("not", null, true, [a], y, o); }
  buf(a: Sig, y: Sig, o: PartOptions = {}): string { return this.gate("buf", null, false, [a], y, o); }

  /** Tri-state buffer: y = en ? a : Z (en active high unless `activeLow`). An unknown enable gives X. */
  tribuf(a: Sig, en: Sig, y: Sig, o: PartOptions & { activeLow?: boolean } = {}): string {
    this.sameWidth("tribuf", y.width, a);
    this.oneBit("tribuf enable", en);
    const low = !!o.activeLow;
    return this.add("tribuf", o, { A: a, EN: en }, { Y: y }, () => {
      const out = new Uint8Array(y.width);
      return (k, c) => {
        const v = k.read(c.ins[0]);
        let e = BUF[k.bit(c.ins[1][0])];
        if (low) e = NOT[e];
        for (let i = 0; i < out.length; i++) out[i] = e === 1 ? BUF[v[i]] : e === 0 ? LZ : LX;
        k.drive(c.outs[0], out);
      };
    });
  }

  /** Weak/pull driver to 1 (`pullup`) or 0 (`pulldown`); default strength Pull. */
  pullup(y: Sig, o: PartOptions & { strength?: Strength } = {}): string { return this.pull(y, 1, o); }
  pulldown(y: Sig, o: PartOptions & { strength?: Strength } = {}): string { return this.pull(y, 0, o); }
  private pull(y: Sig, v: 0 | 1, o: PartOptions & { strength?: Strength }): string {
    const s = o.strength ?? Strength.Pull;
    return this.constCell(v ? "pullup" : "pulldown", y, new Uint8Array(y.width).fill(v), { ...o, strength0: s, strength1: s });
  }

  // ─────────────── sources ───────────────

  /** Drives a fixed value from time zero. */
  constant(y: Sig, value: ValueLike, o: PartOptions = {}): string {
    return this.constCell("const", y, toCodes(value, y.width), o);
  }

  private constCell(kind: string, y: Sig, codes: Uint8Array, o: PartOptions): string {
    return this.add(kind, o, {}, { Y: y }, () => (k, c) => { if (c.first) k.drive(c.outs[0], codes); }, true);
  }

  /**
   * Square-wave clock: low until `offset`, then high for `high` fs and low for `period - high`
   * fs, repeating (for `cycles` periods when given). All times are integer femtoseconds.
   */
  clock(y: Sig, p: { period: number; high?: number; offset?: number; cycles?: number } & PartOptions): string {
    this.oneBit("clock", y);
    const high = p.high ?? p.period / 2;
    const offset = p.offset ?? 0;
    for (const [k, v] of [["period", p.period], ["high", high], ["offset", offset]] as const)
      if (!Number.isSafeInteger(v) || v < 0) throw new DigitalSimError("bad-time", `clock ${k} must be a non-negative integer number of femtoseconds; got ${v}`);
    if (!(high > 0 && high < p.period)) throw new DigitalSimError("bad-time", `clock high time ${high} must lie strictly inside the period ${p.period}`);
    const cycles = p.cycles ?? Infinity;
    return this.add("clock", p, {}, { Y: y }, () => {
      let n = 0; // edges emitted
      const lvl = new Uint8Array(1);
      return (k, c) => {
        if (c.first) {
          lvl[0] = 0; k.drive(c.outs[0], lvl);
          if (cycles > 0) k.wake(c, offset);
          return;
        }
        const period = Math.floor(n / 2);
        const rising = n % 2 === 0;
        const due = offset + period * p.period + (rising ? 0 : high);
        if (k.now !== due) return; // woken by something else (cannot happen: no inputs)
        lvl[0] = rising ? 1 : 0;
        k.drive(c.outs[0], lvl);
        n++;
        if (!rising && period + 1 >= cycles) return;
        k.wake(c, rising ? offset + period * p.period + high : offset + (period + 1) * p.period);
      };
    }, true);
  }

  /**
   * Arbitrary stimulus: value `steps[i].value` from time `steps[i].at` on (times strictly
   * increasing). With `repeat`, the whole list restarts every `repeat` fs.
   */
  pattern(y: Sig, steps: { at: number; value: ValueLike }[], o: PartOptions & { repeat?: number } = {}): string {
    if (!steps.length) throw new DigitalSimError("bad-netlist", "pattern needs at least one step");
    const vals = steps.map(s => toCodes(s.value, y.width));
    steps.forEach((s, i) => {
      if (!Number.isSafeInteger(s.at) || s.at < 0) throw new DigitalSimError("bad-time", `pattern step ${i} time must be a non-negative integer; got ${s.at}`);
      if (i && s.at <= steps[i - 1].at) throw new DigitalSimError("bad-time", "pattern step times must be strictly increasing");
    });
    const rep = o.repeat;
    if (rep !== undefined && (!Number.isSafeInteger(rep) || rep <= steps[steps.length - 1].at))
      throw new DigitalSimError("bad-time", `pattern repeat ${rep} must be an integer longer than the last step time`);
    const times = steps.map(s => s.at);
    return this.add("pattern", o, {}, { Y: y }, () => {
      let i = 0, base = 0;
      return (k, c) => {
        if (c.first) { k.wake(c, times[0]); return; }
        if (k.now !== base + times[i]) return;
        k.drive(c.outs[0], vals[i]);
        i++;
        if (i === times.length) { if (rep === undefined) return; i = 0; base += rep; }
        k.wake(c, base + times[i]);
      };
    }, true);
  }

  // ─────────────── sequential parts ───────────────

  private seqCheck(kind: string, p: SeqCommon, data: (Sig | undefined)[]): number {
    const w = p.q.width;
    this.sameWidth(kind, w, p.qn, ...data);
    this.oneBit(`${kind} control`, p.clk, p.set, p.reset, p.en);
    return w;
  }

  /** D flip-flop with optional enable and async (or sync) set/reset. Set and reset both active give X. */
  dff(p: SeqCommon & { d: Sig }): string {
    const w = this.seqCheck("dff", p, [p.d]);
    return this.seqPart("dff", p, w, { D: p.d }, (q, ins) => ins.D.slice(0, w));
  }

  /** JK flip-flop: 00 hold, 10 set, 01 reset, 11 toggle. */
  jkff(p: SeqCommon & { j: Sig; k: Sig }): string {
    const w = this.seqCheck("jkff", p, [p.j, p.k]);
    return this.seqPart("jkff", p, w, { J: p.j, K: p.k }, (q, ins) => {
      const out = new Uint8Array(w);
      for (let i = 0; i < w; i++) out[i] = exact3([ins.J[i], ins.K[i], q[i]], ([j, kk, qq]) => (j && kk ? 1 - qq : j ? 1 : kk ? 0 : qq));
      return out;
    });
  }

  /**
   * Clocked SR flip-flop: on an active edge S sets, R resets, neither holds, and both together
   * is the forbidden input, which loads X (real parts give a race whose outcome is not defined).
   */
  srff(p: SeqCommon & { s: Sig; r: Sig }): string {
    const w = this.seqCheck("srff", p, [p.s, p.r]);
    return this.seqPart("srff", p, w, { S: p.s, R: p.r }, (q, ins) => {
      const out = new Uint8Array(w);
      for (let i = 0; i < w; i++) out[i] = exact3([ins.S[i], ins.R[i], q[i]], ([s, r, qq]) => (s && r ? LX : s ? 1 : r ? 0 : qq));
      return out;
    });
  }

  /** Toggle flip-flop (toggles on every active edge when `t` is omitted). */
  tff(p: SeqCommon & { t?: Sig }): string {
    const w = this.seqCheck("tff", p, [p.t]);
    return this.seqPart("tff", p, w, { T: p.t }, (q, ins) => {
      const out = new Uint8Array(w);
      for (let i = 0; i < w; i++) out[i] = XOR[(ins.T ? BUF[ins.T[i]] : 1) * 4 + q[i]];
      return out;
    });
  }

  /**
   * Shared edge-triggered machinery. `next(q, inputs)` gives the clocked next state for a
   * definite edge with the enable on; this wrapper adds enable, set/reset (async or sync),
   * unknown edges and unknown controls by merging the possible outcomes.
   */
  private seqPart(kind: string, p: SeqCommon, w: number, data: Record<string, Sig | undefined>, next: (q: Uint8Array, ins: Record<string, Uint8Array>) => Uint8Array, extraOut: Record<string, Sig | undefined> = {}, extra?: (q: Uint8Array, ins: Record<string, Uint8Array>) => Record<string, Uint8Array>): string {
    const falling = p.clkEdge === "falling";
    const init = p.init !== undefined ? toCodes(p.init, w) : new Uint8Array(w).fill(LX);
    const setHigh = p.setActive ?? 1, rstHigh = p.resetActive ?? 1, enHigh = p.enActive ?? 1;
    const sync = !!p.syncSetReset;
    const inputs: Record<string, Sig | undefined> = { CLK: p.clk, SET: p.set, RST: p.reset, EN: p.en, ...data };
    const dataNames = Object.keys(data).filter(n => data[n]);
    const extraNames = Object.keys(extraOut).filter(n => extraOut[n]);
    return this.add(kind, p, inputs, { Q: p.q, QN: p.qn, ...extraOut }, () => {
      // Everything the evaluation needs is resolved once, so an evaluation without an active
      // edge allocates nothing (clocks wake every flop on both edges).
      const q = init.slice(), qn = new Uint8Array(w), loaded = new Uint8Array(w), held = new Uint8Array(w);
      const ins: Record<string, Uint8Array> = {};
      let prevClk: number = LX;
      let iClk = -1, iSet = -1, iRst = -1, iEn = -1;
      let dataPorts: Int32Array[] = [];
      return (k, c) => {
        if (c.first) {
          iClk = c.inNames.indexOf("CLK"); iSet = c.inNames.indexOf("SET"); iRst = c.inNames.indexOf("RST"); iEn = c.inNames.indexOf("EN");
          dataPorts = dataNames.map(n => c.inPort(n));
          dataNames.forEach((n, j) => { ins[n] = new Uint8Array(dataPorts[j].length); });
        }
        // During a time-zero settle (Kernel `settleAtZero`) a control still at X has simply not
        // been driven yet, so it reads as inactive instead of merging the power-on state with X.
        const settling = k.initializing;
        const clk = BUF[k.bit(c.ins[iClk][0])];
        let s = iSet < 0 ? 0 : activeLevel(k.bit(c.ins[iSet][0]), setHigh);
        let r = iRst < 0 ? 0 : activeLevel(k.bit(c.ins[iRst][0]), rstHigh);
        let en = iEn < 0 ? 1 : activeLevel(k.bit(c.ins[iEn][0]), enHigh);
        if (settling) { if (s === LX) s = 0; if (r === LX) r = 0; if (en === LX) en = 0; }
        for (let j = 0; j < dataNames.length; j++) { const buf = ins[dataNames[j]]; k.read(dataPorts[j], buf); for (let i = 0; i < buf.length; i++) buf[i] = BUF[buf[i]]; }
        let edge = c.first ? 0 : edgeOf(prevClk, clk, falling); // 0 none, 1 definite, 2 possible
        if (settling && edge === 2) edge = 0;
        prevClk = clk;
        if (edge) {
          const nq = next(q, ins);
          for (let i = 0; i < w; i++) loaded[i] = en === 1 ? nq[i] : en === 0 ? q[i] : MERGE[q[i] * 4 + nq[i]];
          if (sync) {
            held.set(q); q.set(loaded);
            applySetReset(q, s, r);
            if (edge === 2) for (let i = 0; i < w; i++) q[i] = MERGE[held[i] * 4 + q[i]];
          } else if (edge === 2) for (let i = 0; i < w; i++) q[i] = MERGE[q[i] * 4 + loaded[i]];
          else q.set(loaded);
        }
        if (!sync) applySetReset(q, s, r);
        k.drive(c.outs[0], q);
        if (p.qn) { for (let i = 0; i < w; i++) qn[i] = NOT[q[i]]; k.drive(c.outs[1], qn); }
        if (extra) { const e = extra(q, ins); let oi = p.qn ? 2 : 1; for (const n of extraNames) k.drive(c.outs[oi++], e[n]); }
      };
    }, true);
  }

  /** Level-sensitive D latch: transparent while `en` is active; optional async reset. */
  dlatch(p: PartOptions & { d: Sig; en: Sig; q: Sig; qn?: Sig; enActive?: 0 | 1; reset?: Sig; resetActive?: 0 | 1; init?: ValueLike }): string {
    const w = p.q.width;
    this.sameWidth("dlatch", w, p.d, p.qn);
    this.oneBit("dlatch control", p.en, p.reset);
    const init = p.init !== undefined ? toCodes(p.init, w) : new Uint8Array(w).fill(LX);
    const enHigh = p.enActive ?? 1, rstHigh = p.resetActive ?? 1;
    return this.add("dlatch", p, { D: p.d, EN: p.en, RST: p.reset }, { Q: p.q, QN: p.qn }, () => {
      const q = init.slice();
      return (k, c) => {
        const d = k.read(c.ins[0]);
        let e = BUF[k.bit(c.ins[1][0])];
        if (!enHigh) e = NOT[e];
        if (k.initializing && e === LX) e = 0;
        for (let i = 0; i < w; i++) { const dv = BUF[d[i]]; q[i] = e === 1 ? dv : e === 0 ? q[i] : MERGE[q[i] * 4 + dv]; }
        if (p.reset) {
          let r = BUF[k.bit(c.ins[2][0])];
          if (!rstHigh) r = NOT[r];
          if (k.initializing && r === LX) r = 0;
          if (r === 1) q.fill(0); else if (r === LX) for (let i = 0; i < w; i++) q[i] = MERGE[q[i] * 4];
        }
        k.drive(c.outs[0], q);
        if (p.qn) k.drive(c.outs[1], q.map(v => NOT[v]));
      };
    }, true);
  }

  /**
   * SR latch (NOR style, active-high inputs unless `activeLow`): S sets, R resets, both active
   * drive Q = QN = 0 (active-low / NAND style: both 1), and releasing both together from that
   * state leaves Q unknown, as in hardware.
   */
  srlatch(p: PartOptions & { s: Sig; r: Sig; q: Sig; qn?: Sig; activeLow?: boolean; init?: 0 | 1 }): string {
    this.oneBit("srlatch", p.s, p.r, p.q, p.qn);
    const low = !!p.activeLow;
    return this.add("srlatch", p, { S: p.s, R: p.r }, { Q: p.q, QN: p.qn }, () => {
      let q: number = p.init ?? LX, qn: number = p.init === undefined ? LX : 1 - p.init;
      const one = new Uint8Array(1);
      return (k, c) => {
        let s = BUF[k.bit(c.ins[0][0])], r = BUF[k.bit(c.ins[1][0])];
        if (low) { s = NOT[s]; r = NOT[r]; }
        if (k.initializing) { if (s === LX) s = 0; if (r === LX) r = 0; }
        const both = low ? 1 : 0;
        const nq = exact3([s, r], ([ss, rr]) => (ss && rr ? both : ss ? 1 : rr ? 0 : q === qn ? LX : q));
        const nqn = exact3([s, r], ([ss, rr]) => (ss && rr ? both : ss ? 0 : rr ? 1 : q === qn ? LX : qn));
        q = nq; qn = nqn;
        one[0] = q; k.drive(c.outs[0], one);
        if (p.qn) { one[0] = qn; k.drive(c.outs[1], one); }
      };
    }, true);
  }

  /**
   * Binary counter on `q` (width = q.width). On an active edge: `load` active loads `d`;
   * otherwise `en` (default on) counts up (or down while `up` is 0) modulo `modulus`
   * (default 2^width). `reset` is asynchronous unless `syncSetReset`. `tc` is the terminal
   * count: q == modulus-1 counting up, q == 0 counting down.
   */
  counter(p: SeqCommon & { d?: Sig; load?: Sig; up?: Sig; modulus?: number; tc?: Sig }): string {
    const w = this.seqCheck("counter", p, [p.d]);
    this.oneBit("counter control", p.load, p.up, p.tc);
    if (p.load && !p.d) throw new DigitalSimError("bad-netlist", "counter load needs a d input");
    const mod = BigInt(p.modulus ?? 2 ** w);
    if (mod < 2n || mod > 1n << BigInt(w)) throw new DigitalSimError("bad-netlist", `counter modulus ${p.modulus} must be within 2..2^${w}`);
    const wrap = (v: bigint) => ((v % mod) + mod) % mod;
    const maxCodes = big(mod - 1n, w);
    // 3-valued q == target: 0 if a defined bit differs, X if only unknown bits could, else 1.
    const matches = (q: Uint8Array, target: Uint8Array | null): number => {
      let und = false;
      for (let i = 0; i < w; i++) { const v = q[i]; if (v > 1) und = true; else if (v !== (target ? target[i] : 0)) return 0; }
      return und ? LX : 1;
    };
    const tcBuf = new Uint8Array(1), tcOut = { TC: tcBuf }; // drive() copies, so one scratch buffer is safe
    return this.seqPart("counter", p, w, { D: p.d, LOAD: p.load, UP: p.up }, (q, ins) => {
      const up = ins.UP ? ins.UP[0] : 1, ld = ins.LOAD ? ins.LOAD[0] : 0;
      const v = codesBig(q);
      const counted = v === null ? new Uint8Array(w).fill(LX)
        : up === LX ? mergeVec(big(wrap(v + 1n), w), big(wrap(v - 1n), w))
        : big(wrap(up ? v + 1n : v - 1n), w);
      return ld === 1 ? ins.D.slice() : ld === 0 ? counted : mergeVec(ins.D, counted);
    }, { TC: p.tc }, p.tc ? (q, ins) => {
      const up = ins.UP ? ins.UP[0] : 1;
      const isMax = up === 0 ? 0 : matches(q, maxCodes), isZero = up === 1 ? 0 : matches(q, null);
      tcBuf[0] = up === 1 ? isMax : up === 0 ? isZero : MERGE[isMax * 4 + isZero];
      return tcOut;
    } : undefined);
  }

  /**
   * Shift register on `q`: on an active edge `load` loads `d` in parallel, otherwise (when
   * enabled) shifts toward the MSB taking `serialIn` into bit 0 ("left", default), or toward the
   * LSB taking it into the MSB ("right"). Serial out is q's MSB (left) or LSB (right).
   */
  shiftRegister(p: SeqCommon & { serialIn?: Sig; d?: Sig; load?: Sig; dir?: "left" | "right" }): string {
    const w = this.seqCheck("shiftreg", p, [p.d]);
    this.oneBit("shiftreg serial in / load", p.serialIn, p.load);
    if (p.load && !p.d) throw new DigitalSimError("bad-netlist", "shift register load needs a d input");
    const right = p.dir === "right";
    return this.seqPart("shiftreg", p, w, { SI: p.serialIn, D: p.d, LOAD: p.load }, (q, ins) => {
      const si = ins.SI ? ins.SI[0] : 0;
      const sh = new Uint8Array(w);
      if (right) { for (let i = 0; i < w - 1; i++) sh[i] = q[i + 1]; sh[w - 1] = si; }
      else { for (let i = w - 1; i > 0; i--) sh[i] = q[i - 1]; sh[0] = si; }
      const ld = ins.LOAD ? ins.LOAD[0] : 0;
      return ld === 1 ? ins.D.slice() : ld === 0 ? sh : mergeVec(ins.D, sh);
    });
  }

  // ─────────────── selection ───────────────

  /** y = inputs[sel]. An unknown select merges every input it could pick; an index past the
   *  last input gives X. Optional active-high enable (y = 0 when disabled). */
  mux(p: PartOptions & { inputs: Sig[]; sel: Sig; y: Sig; en?: Sig }): string {
    const w = p.y.width;
    if (p.inputs.length < 2) throw new DigitalSimError("bad-netlist", "mux needs at least two inputs");
    if (p.inputs.length > 2 ** p.sel.width) throw new DigitalSimError("bad-netlist", `mux select "${p.sel.name}" (${p.sel.width} bits) cannot address ${p.inputs.length} inputs`);
    this.sameWidth("mux", w, ...p.inputs);
    this.oneBit("mux enable", p.en);
    const named: Record<string, Sig | undefined> = { S: p.sel, EN: p.en };
    p.inputs.forEach((s, i) => { named[`I${i}`] = s; });
    const n = p.inputs.length;
    return this.add("mux", p, named, { Y: p.y }, () => {
      const out = new Uint8Array(w);
      return (k, c) => {
        const sel = k.read(c.ins[0]).map(v => BUF[v]);
        const firstData = p.en ? 2 : 1;
        let started = false;
        for (let i = 0; i < 2 ** sel.length; i++) {
          let ok = true;
          for (let b = 0; b < sel.length && ok; b++) if (sel[b] < 2 && sel[b] !== ((i >> b) & 1)) ok = false;
          if (!ok) continue;
          const cand = i < n ? k.read(c.ins[firstData + i]) : null;
          for (let j = 0; j < w; j++) {
            const v = cand ? BUF[cand[j]] : LX;
            out[j] = started ? MERGE[out[j] * 4 + v] : v;
          }
          started = true;
        }
        if (p.en) { const e = BUF[k.bit(c.ins[1][0])]; for (let j = 0; j < w; j++) out[j] = AND[e * 4 + out[j]]; }
        k.drive(c.outs[0], out);
      };
    });
  }

  /** Binary to one-hot: y[i] = (a == i) && en. Unknown address bits give X on every output they
   *  could select and 0 elsewhere. `activeLow` inverts every output. */
  decoder(p: PartOptions & { a: Sig; y: Sig; en?: Sig; activeLow?: boolean }): string {
    if (p.y.width > 2 ** p.a.width) throw new DigitalSimError("bad-netlist", `decoder output (${p.y.width} bits) exceeds 2^${p.a.width}`);
    this.oneBit("decoder enable", p.en);
    const w = p.y.width;
    return this.add("decoder", p, { A: p.a, EN: p.en }, { Y: p.y }, () => {
      const out = new Uint8Array(w);
      return (k, c) => {
        const a = k.read(c.ins[0]).map(v => BUF[v]);
        const e = p.en ? BUF[k.bit(c.ins[1][0])] : 1;
        for (let i = 0; i < w; i++) {
          let m = 1;
          for (let b = 0; b < a.length; b++) { const want = (i >> b) & 1; m = AND[m * 4 + (a[b] < 2 ? (a[b] === want ? 1 : 0) : LX)]; }
          const y = AND[m * 4 + e];
          out[i] = p.activeLow ? NOT[y] : y;
        }
        k.drive(c.outs[0], out);
      };
    });
  }

  /** Adds a cell with a custom behaviour (escape hatch for parts not in this library). */
  custom(def: Omit<CellDef, "name"> & { name?: string }): string {
    const name = this.autoName(def.type, def.name);
    this.cells.push({ ...def, name });
    return name;
  }

  build(): NetlistIR {
    return { netCount: this.netCount, signals: this.signals.map(s => ({ ...s, nets: [...s.nets] })), cells: [...this.cells] };
  }
}

// ─────────────── helpers ───────────────

/** Edge classification after normalising Z to X: 1 definite, 2 possible (involves X), 0 none. */
export function edgeOf(prev: number, cur: number, falling: boolean): 0 | 1 | 2 {
  const from = falling ? 1 : 0, to = falling ? 0 : 1;
  if (prev === from && cur === to) return 1;
  if ((prev === from && cur === LX) || (prev === LX && cur === to)) return 2;
  return 0;
}

/**
 * Exact 3-valued evaluation of a boolean function of a few inputs: evaluates f on every 0/1
 * completion of the unknown inputs and merges the results (0 or 1 if they all agree, else X).
 * f may return X itself (e.g. for a hold of an unknown state).
 */
export function exact3(vals: number[], f: (v: number[]) => number): number {
  const xs: number[] = [];
  vals.forEach((v, i) => { if (v > 1) xs.push(i); });
  let acc = -1;
  const cur = vals.slice();
  for (let m = 0; m < 1 << xs.length; m++) {
    xs.forEach((p, b) => { cur[p] = (m >> b) & 1; });
    const r = f(cur);
    acc = acc < 0 ? r : MERGE[acc * 4 + r];
    if (acc === LX) return LX;
  }
  return acc;
}

function mergeVec(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = MERGE[a[i] * 4 + b[i]];
  return out;
}

const codesBig = (q: Uint8Array): bigint | null => codesToBig(q, 0, q.length);
const big = (v: bigint, w: number): Uint8Array => bigToCodes(v, w, new Uint8Array(w));

/** A control input as a 3-valued "is active" level (Z reads as X). */
function activeLevel(code: number, activeHigh: number): number { return activeHigh ? BUF[code] : NOT[code]; }

/** Asynchronous (or, at the edge, synchronous) set / reset under 3-valued conditions: both
 *  active gives X; an unknown one merges the forced value into the bits it could change. */
function applySetReset(q: Uint8Array, s: number, r: number): void {
  if (s === 1 && r === 1) { q.fill(LX); return; }
  if (s === LX && r === LX) { q.fill(LX); return; }
  forceTo(q, r, 0);
  forceTo(q, s, 1);
}

function forceTo(q: Uint8Array, cond: number, v: number): void {
  if (cond === 1) q.fill(v);
  else if (cond === LX) for (let i = 0; i < q.length; i++) q[i] = MERGE[q[i] * 4 + v];
}

export type { Kernel, Cell };
export { L0, L1 };
