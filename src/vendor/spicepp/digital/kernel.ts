/**
 * Event-driven 4-state simulation kernel.
 *
 * Model
 *   - A net is one bit. Nets 0..3 are the constants 0, 1, Z, X (net id === its logic code).
 *     Multi-bit signals are ordered lists of nets, so arbitrary slicing and concatenation in
 *     a netlist (Yosys connects bit lists, not words) costs nothing.
 *   - A cell reads input nets and owns output ports. Every output bit is a driver; a net's
 *     value is the strength resolution of its drivers (strongest wins; disagreement at the
 *     winning strength gives X; no active driver gives Z).
 *   - Values change only through scheduled events, so causality is recorded exactly: every
 *     net change stores the id of the cell whose driver produced it.
 *
 * Time
 *   Integer femtoseconds held in a JS number. Every time and delay must be a safe integer, so
 *   arithmetic is exact up to 2^53 - 1 fs ≈ 9.007 s of simulated time; past that the kernel
 *   throws `time-overflow` instead of rounding. Bigint time would lift the cap but costs an
 *   allocation per comparison in the hottest loop.
 *
 * Scheduling and determinism
 *   - Events carry (time, seq); seq is a global counter incremented per scheduled event, so
 *     equal-time events apply in the order they were scheduled.
 *   - A time step runs delta cycles. Each delta applies all of its events first, then
 *     evaluates every cell whose inputs changed (or that asked to wake), each exactly once,
 *     in ascending cell id. Cell ids follow netlist order. Zero-delay outputs land in the next
 *     delta; positive delays go to the future queue. The same netlist and stimulus therefore
 *     produce the identical event order, run after run.
 *   - A step that exceeds `maxDeltas` throws `delta-overflow`, naming the nets that were still
 *     changing and the cells evaluating them (a zero-delay loop that never settles).
 *
 * Delay semantics per output port
 *   - inertial (default, Verilog gate/continuous-assign style): a new target for a bit cancels
 *     a pending transition to a different value; if the output already holds the new target the
 *     pending pulse is simply dropped, so pulses shorter than the delay never appear. A pending
 *     transition to the same target is kept, not pushed out.
 *   - transport (VHDL style): every transition is kept, except pending ones at or after the new
 *     transition's time, which it supersedes.
 *   Delay chosen per bit from the transition: to 1 → rise, to 0 → fall, to Z → turnoff,
 *   to X → the smallest of the three.
 *
 * The kernel never rolls back: anything scheduled before `now` is rejected. A mixed-signal host
 * advances it with `nextEventTime()` / `advanceTo(t)` and injects edges with `setInput(.., t)`.
 */

import { DigitalSimError } from "./errors";
import { LogicVec, Strength, driven, LZ, LX, toCodes, type Logic, type ValueLike } from "./logic";

// ─────────────────────────────── netlist IR ───────────────────────────────

export interface DelaySpec {
  /** Shorthand for rise = fall = turnoff. */
  delay?: number;
  rise?: number;
  fall?: number;
  /** Delay of a transition to Z; defaults to min(rise, fall). */
  turnoff?: number;
  /** Transport instead of inertial semantics. */
  transport?: boolean;
}

export interface OutputDef {
  nets: number[];
  delay?: DelaySpec;
  /** Strength used when driving 0 / 1. A HighZ strength turns that value into Z (open drain). */
  s0?: Strength;
  s1?: Strength;
}

/** The per-cell behaviour: called whenever an input changed or a requested wake time arrived. */
export type CellEval = (k: Kernel, cell: Cell) => void;

export interface CellDef {
  type: string;
  name: string;
  src?: string;
  inputs: Record<string, number[]>;
  outputs: Record<string, OutputDef>;
  /** True when outputs are not a combinational function of inputs (flip-flops, memories with
   *  clocked ports, sources). Only used by the static loop analysis. */
  sequential?: boolean;
  /** Creates fresh behaviour state; called once per simulator instance. */
  create: () => CellEval;
}

export type SignalKind = "input" | "output" | "inout" | "wire";

export interface SignalDef {
  name: string;
  nets: number[];
  kind: SignalKind;
  src?: string;
  /** Internal (auto-generated) name: listed, but never used to name a net in messages. */
  hidden?: boolean;
}

export interface NetlistIR {
  /** Total net count including the four constant nets. */
  netCount: number;
  signals: SignalDef[];
  cells: CellDef[];
  warnings?: string[];
}

export interface KernelOptions {
  /** Delta cycles allowed per time step before `delta-overflow`. Default 10000. */
  maxDeltas?: number;
  /** Record per-net change history: true (default), false, or a predicate on signal names
   *  (a net is recorded when any signal containing it passes). */
  record?: boolean | ((signalName: string) => boolean);
  /**
   * Settle the design at time zero as if it had been powered with its time-zero inputs forever:
   * the first time step (the initialisation step at time 0) runs with every delay treated as
   * zero, so gates show their static value at t = 0 instead of X for one propagation delay.
   * Mixed-signal hosts need this to find a DC operating point; later steps use the real delays.
   */
  settleAtZero?: boolean;
  /**
   * Strength of the stimulus that setInput applies to an inout port (default Strong). A replay of
   * a bus another simulator resolved uses Pull, so the design's own strong drive always decides
   * while it drives and the replayed value only shows once the design lets go, exactly as the
   * resolved value was formed.
   */
  inoutStrength?: Strength;
}

// ─────────────────────────────── runtime objects ───────────────────────────────

export class OutPort {
  readonly cell: Cell;
  readonly name: string;
  readonly width: number;
  /** Driver id of bit 0; bit i is driver base + i. */
  readonly base: number;
  readonly rise: number;
  readonly fall: number;
  readonly turnoff: number;
  readonly toX: number;
  readonly transport: boolean;
  /** Stimulus ports (design inputs) apply every event in order with no inertial filtering. */
  readonly stimulus: boolean;
  /** Inertial: the pending event per bit and its target. */
  readonly pend: (Ev | null)[];
  readonly pendVal: Uint8Array;
  /** Transport: pending events per bit in time order, with their targets. */
  readonly tpend: Ev[][];
  readonly tpendVal: number[][];

  constructor(cell: Cell, name: string, width: number, base: number, d: DelaySpec | undefined, stimulus: boolean) {
    this.cell = cell; this.name = name; this.width = width; this.base = base; this.stimulus = stimulus;
    const dd = d?.delay ?? 0;
    this.rise = d?.rise ?? dd;
    this.fall = d?.fall ?? dd;
    this.turnoff = d?.turnoff ?? (d?.delay !== undefined ? dd : Math.min(this.rise, this.fall));
    this.toX = Math.min(this.rise, this.fall, this.turnoff);
    for (const [k, v] of [["rise", this.rise], ["fall", this.fall], ["turnoff", this.turnoff]] as const)
      if (!Number.isSafeInteger(v) || v < 0)
        throw new DigitalSimError("bad-time", `cell "${cell.name}" port ${name}: ${k} delay must be a non-negative integer number of femtoseconds; got ${v}`, { cell: cell.name, port: name, [k]: v });
    this.transport = !!d?.transport;
    this.pend = this.transport || stimulus ? [] : new Array<Ev | null>(width).fill(null);
    this.pendVal = new Uint8Array(this.transport || stimulus ? 0 : width);
    this.tpend = [];
    this.tpendVal = [];
    if (this.transport && !stimulus) for (let i = 0; i < width; i++) { this.tpend.push([]); this.tpendVal.push([]); }
  }

  delayFor(to: number): number {
    return to === 1 ? this.rise : to === 0 ? this.fall : to === LZ ? this.turnoff : this.toX;
  }
}

export class Cell {
  readonly id: number;
  readonly type: string;
  readonly name: string;
  readonly src: string | undefined;
  readonly sequential: boolean;
  readonly inNames: string[];
  readonly ins: Int32Array[];
  readonly outNames: string[];
  readonly outs: OutPort[] = [];
  /** True during the cell's first evaluation (time-zero initialisation). */
  first = true;
  evaluate!: CellEval;

  constructor(id: number, def: CellDef) {
    this.id = id; this.type = def.type; this.name = def.name; this.src = def.src; this.sequential = !!def.sequential;
    this.inNames = Object.keys(def.inputs);
    this.ins = this.inNames.map(n => Int32Array.from(def.inputs[n]));
    this.outNames = Object.keys(def.outputs);
  }

  inPort(name: string): Int32Array {
    const i = this.inNames.indexOf(name);
    if (i < 0) throw new Error(`cell ${this.name} has no input ${name}`);
    return this.ins[i];
  }
}

/** A scheduled event: new values for some bits of one output port, or a wake-up of one cell. */
export class Ev {
  constructor(
    readonly time: number,
    readonly seq: number,
    readonly port: OutPort | null,
    readonly cell: Cell | null,
    readonly idx: number[],
    readonly vals: number[],
  ) {}
}

class EventHeap {
  private a: Ev[] = [];
  get size(): number { return this.a.length; }
  peek(): Ev | undefined { return this.a[0]; }
  private less(x: Ev, y: Ev): boolean { return x.time < y.time || (x.time === y.time && x.seq < y.seq); }
  push(e: Ev): void {
    const a = this.a;
    let i = a.length;
    a.push(e);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(e, a[p])) break;
      a[i] = a[p]; i = p;
    }
    a[i] = e;
  }
  pop(): Ev | undefined {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length && last) {
      let i = 0;
      const n = a.length;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && this.less(a[r], a[l]) ? r : l;
        if (!this.less(a[c], last)) break;
        a[i] = a[c]; i = c;
      }
      a[i] = last;
    }
    return top;
  }
}

class NetTrace {
  t = new Float64Array(4);
  v = new Uint8Array(4);
  c = new Int32Array(4);
  n = 0;
  grow(): void {
    const m = this.t.length * 2;
    const t = new Float64Array(m); t.set(this.t); this.t = t;
    const v = new Uint8Array(m); v.set(this.v); this.v = v;
    const c = new Int32Array(m); c.set(this.c); this.c = c;
  }
}

export interface CellInfo {
  id: number;
  name: string;
  type: string;
  src?: string;
}

export interface DriverInfo extends CellInfo {
  port: string;
  bit: number;
}

export interface NetChange {
  time: number;
  value: Logic;
  /** Cell whose driver produced the change. */
  cause: CellInfo;
}

export interface SignalInfo {
  name: string;
  width: number;
  kind: SignalKind;
  nets: readonly number[];
  src?: string;
  hidden: boolean;
}

export interface VectorTrace {
  /** Strictly increasing; the first entry is the value at time 0. */
  times: number[];
  values: LogicVec[];
}

export interface KernelStats {
  /** Events applied (stale, cancelled ones excluded). */
  events: number;
  /** Delta cycles run in total. */
  deltas: number;
  /** Most delta cycles any single time step needed. */
  maxDeltasInStep: number;
  /** Cell evaluations. */
  evaluations: number;
  /** Time steps processed. */
  steps: number;
}

export type SignalRef = string | SignalInfo;

const CONST_NAMES = ["1'b0", "1'b1", "1'bz", "1'bx"];

function checkTime(t: number, what: string): void {
  if (typeof t !== "number" || !Number.isInteger(t) || t < 0)
    throw new DigitalSimError("bad-time", `${what} must be a non-negative integer number of femtoseconds; got ${t}`, { value: t });
  if (t > Number.MAX_SAFE_INTEGER)
    throw new DigitalSimError("time-overflow", `${what} ${t} fs is beyond the exact range of the kernel (2^53 - 1 fs ≈ 9.007 s)`, { value: t });
}

// ─────────────────────────────── kernel ───────────────────────────────

export class Kernel {
  /** Current simulation time in femtoseconds. */
  now = 0;
  readonly netCount: number;
  readonly cells: Cell[] = [];
  readonly warnings: string[];

  /** Resolved value / strength per net. */
  private readonly val: Uint8Array;
  private readonly str: Uint8Array;
  private readonly initVal: Uint8Array;
  // drivers
  private readonly drvVal: Uint8Array;
  private readonly drvNet: Int32Array;
  private readonly drvS0: Uint8Array;
  private readonly drvS1: Uint8Array;
  private readonly drvPort: OutPort[];
  private readonly netDrvStart: Int32Array;
  private readonly netDrv: Int32Array;
  // fanout
  private readonly foStart: Int32Array;
  private readonly fo: Int32Array;
  // scheduling
  private readonly heap = new EventHeap();
  private nextDelta: Ev[] = [];
  private seq = 0;
  private initPending = true;
  private readonly maxDeltas: number;
  private evalMark: Int32Array;
  private deltaSerial = 0;
  private evalList: number[] = [];
  private deltaChanged: number[] = [];
  private halted: DigitalSimError | null = null;
  private inStep = false;
  private readonly settleAtZero: boolean;
  /** True while the time-zero initialisation step runs under `settleAtZero`. */
  private zeroDelay = false;
  // recording / notification
  private readonly rec: Uint8Array;
  private readonly traces: (NetTrace | null)[];
  private stepId = 0;
  private readonly stepMark: Int32Array;
  private readonly stepStart: Uint8Array;
  private touched: number[] = [];
  private readonly signalDefs: SignalDef[];
  private readonly sigByName = new Map<string, SignalDef>();
  private readonly inputCell = new Map<string, Cell>();
  private netNames: string[] | null = null;
  private readonly stepListeners = new Set<(time: number, nets: readonly number[]) => void>();
  private readonly netWatch = new Map<number, Set<Watch>>();

  readonly stats: KernelStats = { events: 0, deltas: 0, maxDeltasInStep: 0, evaluations: 0, steps: 0 };

  constructor(ir: NetlistIR, opts: KernelOptions = {}) {
    if (!Number.isInteger(ir.netCount) || ir.netCount < 4) throw new DigitalSimError("bad-netlist", "netCount must include the four constant nets");
    this.netCount = ir.netCount;
    this.maxDeltas = opts.maxDeltas ?? 10000;
    this.settleAtZero = !!opts.settleAtZero;
    this.warnings = [...(ir.warnings ?? [])];
    this.signalDefs = ir.signals;
    for (const s of ir.signals) {
      for (const n of s.nets) this.checkNet(n, `signal "${s.name}"`);
      if (!this.sigByName.has(s.name)) this.sigByName.set(s.name, s);
    }

    // Design inputs get a stimulus driver cell each, so external values have a cause too.
    const defs: CellDef[] = [...ir.cells];
    const inputDefs: [SignalDef, number][] = [];
    for (const s of ir.signals) {
      if (s.kind !== "input" && s.kind !== "inout") continue;
      inputDefs.push([s, defs.length]);
      const weak = s.kind === "inout" && opts.inoutStrength !== undefined ? { s0: opts.inoutStrength, s1: opts.inoutStrength } : {};
      defs.push({ type: "$input", name: s.name, src: s.src, inputs: {}, outputs: { Y: { nets: s.nets, ...weak } }, sequential: true, create: () => () => {} });
    }

    // Cells, ports and drivers.
    let nDrv = 0;
    for (const d of defs) for (const o of Object.values(d.outputs)) nDrv += o.nets.length;
    this.drvVal = new Uint8Array(nDrv).fill(LX);
    this.drvNet = new Int32Array(nDrv);
    this.drvS0 = new Uint8Array(nDrv);
    this.drvS1 = new Uint8Array(nDrv);
    this.drvPort = new Array<OutPort>(nDrv);
    const netDrvCount = new Int32Array(this.netCount);
    let di = 0;
    for (let ci = 0; ci < defs.length; ci++) {
      const d = defs[ci];
      const cell = new Cell(ci, d);
      for (const nets of cell.ins) for (const n of nets) this.checkNet(n, `cell "${d.name}" input`);
      const stimulus = d.type === "$input";
      for (const pn of cell.outNames) {
        const o = d.outputs[pn];
        const port = new OutPort(cell, pn, o.nets.length, di, o.delay, stimulus);
        cell.outs.push(port);
        for (let i = 0; i < o.nets.length; i++, di++) {
          const n = o.nets[i];
          this.checkNet(n, `cell "${d.name}" output ${pn}`);
          this.drvNet[di] = n;
          this.drvS0[di] = o.s0 ?? Strength.Strong;
          this.drvS1[di] = o.s1 ?? Strength.Strong;
          this.drvPort[di] = port;
          if (n >= 4) netDrvCount[n]++;
        }
      }
      cell.evaluate = d.create();
      this.cells.push(cell);
    }
    for (const [s, ci] of inputDefs) {
      const c = this.cells[ci];
      this.inputCell.set(s.name, c);
      // An inout starts released (Z) so the design's own drivers decide; an input starts X.
      if (s.kind === "inout") for (let i = 0; i < c.outs[0].width; i++) this.drvVal[c.outs[0].base + i] = LZ;
    }

    this.netDrvStart = new Int32Array(this.netCount + 1);
    for (let n = 0; n < this.netCount; n++) this.netDrvStart[n + 1] = this.netDrvStart[n] + netDrvCount[n];
    this.netDrv = new Int32Array(this.netDrvStart[this.netCount]);
    const fill = this.netDrvStart.slice(0, this.netCount);
    for (let d = 0; d < nDrv; d++) { const n = this.drvNet[d]; if (n >= 4) this.netDrv[fill[n]++] = d; }

    // Fanout (deduplicated per net, ascending cell id).
    const foCount = new Int32Array(this.netCount);
    const lastSeen = new Int32Array(this.netCount).fill(-1);
    for (const c of this.cells) for (const nets of c.ins) for (const n of nets) if (n >= 4 && lastSeen[n] !== c.id) { lastSeen[n] = c.id; foCount[n]++; }
    this.foStart = new Int32Array(this.netCount + 1);
    for (let n = 0; n < this.netCount; n++) this.foStart[n + 1] = this.foStart[n] + foCount[n];
    this.fo = new Int32Array(this.foStart[this.netCount]);
    const fofill = this.foStart.slice(0, this.netCount);
    lastSeen.fill(-1);
    for (const c of this.cells) for (const nets of c.ins) for (const n of nets) if (n >= 4 && lastSeen[n] !== c.id) { lastSeen[n] = c.id; this.fo[fofill[n]++] = c.id; }

    // Initial resolved values.
    this.val = new Uint8Array(this.netCount);
    this.str = new Uint8Array(this.netCount);
    for (let n = 0; n < 4; n++) { this.val[n] = n; this.str[n] = n === LZ ? Strength.HighZ : Strength.Supply; }
    for (let n = 4; n < this.netCount; n++) this.resolveInto(n);
    this.initVal = this.val.slice();

    this.evalMark = new Int32Array(this.cells.length).fill(-1);
    this.stepMark = new Int32Array(this.netCount).fill(-1);
    this.stepStart = new Uint8Array(this.netCount);

    // Recording selection.
    this.rec = new Uint8Array(this.netCount);
    const r = opts.record ?? true;
    if (r === true) this.rec.fill(1);
    else if (typeof r === "function") for (const s of ir.signals) if (r(s.name)) for (const n of s.nets) this.rec[n] = 1;
    for (let n = 0; n < 4; n++) this.rec[n] = 0;
    this.traces = new Array<NetTrace | null>(this.netCount).fill(null);
  }

  private checkNet(n: number, where: string): void {
    if (!Number.isInteger(n) || n < 0 || n >= this.netCount)
      throw new DigitalSimError("bad-netlist", `${where} references net ${n}, outside 0..${this.netCount - 1}`, { net: n });
  }

  // ─────────────── services for cell behaviours ───────────────

  /** Current codes of `nets` (Z and X are passed through; cells decide how to treat Z). */
  read(nets: Int32Array, out: Uint8Array = new Uint8Array(nets.length)): Uint8Array {
    const v = this.val;
    for (let i = 0; i < nets.length; i++) out[i] = v[nets[i]];
    return out;
  }

  bit(net: number): number { return this.val[net]; }

  /**
   * True during the time-zero settle of a kernel created with `settleAtZero`. Nets are still
   * passing through X there only because their drivers have not run yet, so state-holding cells
   * read an unknown control as "inactive" instead of merging their power-on state with X.
   */
  get initializing(): boolean { return this.zeroDelay; }

  /**
   * Schedules `codes` onto an output port using the port's delays and delay mode. Bits whose
   * target equals what the port already drives (or is already scheduled to drive, inertial)
   * produce no event.
   */
  drive(port: OutPort, codes: ArrayLike<number>): void {
    const now = this.now;
    const base = port.base;
    // The delay depends only on the target value, so bits are bucketed by target code (no
    // closures or per-call objects: this runs once per output per evaluation).
    if (port.width === 1 && !port.transport) {
      // Scalar inertial fast path (the common gate output).
      const t = codes[0];
      if (port.pend[0] !== null) {
        if (port.pendVal[0] === t) return;
        port.pend[0] = null;
      }
      if (this.drvVal[base] !== t) this.emit(port, this.zeroDelay ? 0 : port.delayFor(t), [0], [t]);
      return;
    }
    let b0: number[] | null = null, b1: number[] | null = null, b2: number[] | null = null, b3: number[] | null = null;
    for (let i = 0; i < port.width; i++) {
      const t = codes[i];
      if (port.transport) {
        // VHDL transport: the new transaction removes every pending one at or after its time,
        // then is scheduled unless the projected value already equals it.
        const list = port.tpend[i], lv = port.tpendVal[i];
        const at = now + (this.zeroDelay ? 0 : port.delayFor(t));
        while (list.length && list[list.length - 1].time >= at) { list.pop(); lv.pop(); }
        if ((list.length ? lv[lv.length - 1] : this.drvVal[base + i]) === t) continue;
      } else {
        if (port.pend[i] !== null) {
          if (port.pendVal[i] === t) continue;
          port.pend[i] = null;
        }
        if (this.drvVal[base + i] === t) continue;
      }
      if (t === 0) (b0 ??= []).push(i);
      else if (t === 1) (b1 ??= []).push(i);
      else if (t === 2) (b2 ??= []).push(i);
      else (b3 ??= []).push(i);
    }
    if (b0 === null && b1 === null && b2 === null && b3 === null) return;
    // One event per distinct delay.
    const buckets = [b0, b1, b2, b3];
    for (let c = 0; c < 4; c++) {
      const bc = buckets[c];
      if (bc === null) continue;
      const d = this.zeroDelay ? 0 : port.delayFor(c);
      const idx = bc, vals: number[] = new Array<number>(bc.length).fill(c);
      for (let c2 = c + 1; c2 < 4; c2++) {
        const b = buckets[c2];
        if (b === null || (this.zeroDelay ? 0 : port.delayFor(c2)) !== d) continue;
        for (const i of b) { idx.push(i); vals.push(c2); }
        buckets[c2] = null;
      }
      this.emit(port, d, idx, vals);
    }
  }

  private emit(port: OutPort, d: number, idx: number[], vals: number[]): void {
    const at = this.now + d;
    if (at > Number.MAX_SAFE_INTEGER) throw new DigitalSimError("time-overflow", `an event at ${at} fs is beyond the exact time range`, { cell: port.cell.name });
    const ev = new Ev(at, this.seq++, port, null, idx, vals);
    if (port.transport) for (let k = 0; k < idx.length; k++) { port.tpend[idx[k]].push(ev); port.tpendVal[idx[k]].push(vals[k]); }
    else for (let k = 0; k < idx.length; k++) { port.pend[idx[k]] = ev; port.pendVal[idx[k]] = vals[k]; }
    if (d === 0) this.nextDelta.push(ev); else this.heap.push(ev);
  }

  /** Asks for `cell` to be evaluated again at time `t` (>= now). Used by sources and timers. */
  wake(cell: Cell, t: number): void {
    checkTime(t, "wake time");
    if (t < this.now) throw new DigitalSimError("past-time", `cell "${cell.name}" asked to wake at ${t} fs, before now (${this.now} fs)`, { cell: cell.name, time: t, now: this.now });
    const ev = new Ev(t, this.seq++, null, cell, [], []);
    if (t === this.now) this.nextDelta.push(ev); else this.heap.push(ev);
  }

  // ─────────────── resolution and event application ───────────────

  /** Resolves net n from its drivers into val/str; returns true when the value changed. */
  private resolveInto(n: number): boolean {
    const s = this.netDrvStart[n], e = this.netDrvStart[n + 1];
    let v: number = LZ, st: number = Strength.HighZ;
    if (e - s === 1) {
      const d = this.netDrv[s];
      const dv = this.drvVal[d];
      st = driven(dv, this.drvS0[d], this.drvS1[d]);
      v = st === Strength.HighZ ? LZ : dv;
    } else {
      for (let k = s; k < e; k++) {
        const d = this.netDrv[k];
        const dv = this.drvVal[d];
        const ds = driven(dv, this.drvS0[d], this.drvS1[d]);
        if (ds === Strength.HighZ) continue;
        if (ds > st) { st = ds; v = dv; }
        else if (ds === st && dv !== v) v = LX;
      }
    }
    this.str[n] = st;
    if (v === this.val[n]) return false;
    this.val[n] = v;
    return true;
  }

  private applyEvent(ev: Ev): void {
    if (ev.cell) { this.markEval(ev.cell.id); return; }
    const port = ev.port!;
    const cause = port.cell.id;
    let applied = false;
    for (let k = 0; k < ev.idx.length; k++) {
      const i = ev.idx[k];
      if (!port.stimulus) {
        if (port.transport) {
          const list = port.tpend[i];
          if (list[0] !== ev) continue;
          list.shift(); port.tpendVal[i].shift();
        } else {
          if (port.pend[i] !== ev) continue;
          port.pend[i] = null;
        }
      }
      applied = true;
      const v = ev.vals[k];
      const d = port.base + i;
      if (this.drvVal[d] === v) continue;
      this.drvVal[d] = v;
      const n = this.drvNet[d];
      if (n < 4) continue;
      const old = this.val[n];
      if (!this.resolveInto(n)) continue;
      this.netChanged(n, old, cause);
    }
    if (applied) this.stats.events++;
  }

  private netChanged(n: number, old: number, cause: number): void {
    const v = this.val[n];
    if (this.stepMark[n] !== this.stepId) { this.stepMark[n] = this.stepId; this.stepStart[n] = old; this.touched.push(n); }
    this.deltaChanged.push(n);
    if (this.rec[n]) this.record(n, v, cause);
    for (let k = this.foStart[n]; k < this.foStart[n + 1]; k++) this.markEval(this.fo[k]);
  }

  private markEval(ci: number): void {
    if (this.evalMark[ci] === this.deltaSerial) return;
    this.evalMark[ci] = this.deltaSerial;
    this.evalList.push(ci);
  }

  /** One entry per (net, time): later deltas at the same time overwrite, and a same-time
   *  return to the previous value removes the entry, so traces hold no zero-width glitches. */
  private record(n: number, v: number, cause: number): void {
    let tr = this.traces[n];
    if (!tr) tr = this.traces[n] = new NetTrace();
    const k = tr.n;
    if (k > 0 && tr.t[k - 1] === this.now) {
      const prev = k > 1 ? tr.v[k - 2] : this.initVal[n];
      if (prev === v) tr.n--;
      else { tr.v[k - 1] = v; tr.c[k - 1] = cause; }
      return;
    }
    if (k === tr.t.length) tr.grow();
    tr.t[k] = this.now; tr.v[k] = v; tr.c[k] = cause; tr.n = k + 1;
  }

  // ─────────────── time advance ───────────────

  /** Earliest time with pending work (>= now), or null when nothing is scheduled. */
  nextEventTime(): number | null {
    if (this.initPending || this.nextDelta.length) return this.now;
    // Drop cancelled events at the top so a host never stops for activity that will not happen.
    let top = this.heap.peek();
    while (top && this.isStale(top)) { this.heap.pop(); top = this.heap.peek(); }
    return top ? top.time : null;
  }

  /** True when every bit of an event was cancelled or superseded (wake-ups never are). */
  private isStale(ev: Ev): boolean {
    const port = ev.port;
    if (!port || port.stimulus) return false;
    for (const i of ev.idx) {
      if (port.transport ? port.tpend[i].includes(ev) : port.pend[i] === ev) return false;
    }
    return true;
  }

  /** Processes every event with time <= t, then sets now = t. Never moves backwards. */
  advanceTo(t: number): void {
    this.assertLive();
    checkTime(t, "advanceTo time");
    if (t < this.now) throw new DigitalSimError("past-time", `cannot advance to ${t} fs: already at ${this.now} fs (the kernel never rolls back)`, { time: t, now: this.now });
    for (;;) {
      const nt = this.nextEventTime();
      if (nt === null || nt > t) break;
      this.processStep(nt);
    }
    this.now = t;
  }

  /** Runs until time `until` (alias of advanceTo) and returns the running statistics. */
  run(until: number): KernelStats { this.advanceTo(until); return this.stats; }

  /** Processes the next time step with pending work; returns its time, or null if idle. */
  step(): number | null {
    this.assertLive();
    const nt = this.nextEventTime();
    if (nt === null) return null;
    this.processStep(nt);
    return nt;
  }

  /** Runs pending delta cycles at the current time. */
  settle(): void { this.advanceTo(this.now); }

  private assertLive(): void {
    if (this.halted) throw new DigitalSimError("halted", `simulation halted earlier: ${this.halted.message}`, { cause: this.halted.code, ...this.halted.details });
    if (this.inStep) throw new DigitalSimError("bad-time", "the simulator cannot be advanced from inside a cell evaluation or change callback");
  }

  private processStep(t: number): void {
    this.now = t;
    let cur = this.nextDelta;
    this.nextDelta = [];
    // Inputs set at `now` after the previous step and queued events due now merge in seq order.
    const queuedNow = cur.length > 0;
    for (let top = this.heap.peek(); top && top.time === t; top = this.heap.peek()) cur.push(this.heap.pop()!);
    if (queuedNow && cur.length > 1) cur.sort((x, y) => x.seq - y.seq);
    this.stepId++;
    this.touched.length = 0;
    this.stats.steps++;
    this.inStep = true;
    this.zeroDelay = this.settleAtZero && this.initPending && t === 0;
    let delta = 0;
    try {
      while (cur.length || this.initPending) {
        if (++delta > this.maxDeltas) throw this.deltaOverflow(delta - 1);
        this.deltaSerial++;
        this.deltaChanged.length = 0;
        this.evalList.length = 0;
        if (this.initPending) { this.initPending = false; for (let i = 0; i < this.cells.length; i++) this.markEval(i); }
        for (let i = 0; i < cur.length; i++) this.applyEvent(cur[i]);
        const list = this.evalList;
        if (list.length > 1) list.sort((a, b) => a - b);
        for (let i = 0; i < list.length; i++) {
          const c = this.cells[list[i]];
          c.evaluate(this, c);
          c.first = false;
        }
        this.stats.evaluations += list.length;
        this.stats.deltas++;
        cur = this.nextDelta;
        this.nextDelta = [];
      }
    } catch (e) {
      // A failure mid-step leaves nets half-updated: refuse to continue from that state.
      this.halted = e instanceof DigitalSimError ? e : new DigitalSimError("halted", `cell evaluation failed: ${(e as Error)?.message ?? e}`);
      this.inStep = false;
      this.zeroDelay = false;
      throw e;
    }
    this.zeroDelay = false;
    if (delta > this.stats.maxDeltasInStep) this.stats.maxDeltasInStep = delta;
    // Listeners may queue inputs but not advance time (inStep stays set while they run).
    try { this.notify(); } finally { this.inStep = false; }
  }

  private deltaOverflow(deltas: number): DigitalSimError {
    const nets = [...new Set(this.deltaChanged)].slice(0, 32);
    const cells = this.evalList.slice(0, 32).map(ci => this.cellInfo(ci));
    const loops = this.combinationalLoops().filter(l => l.some(c => this.evalMark[c.id] === this.deltaSerial));
    return new DigitalSimError(
      "delta-overflow",
      `no stable value after ${deltas} delta cycles at ${this.now} fs: a zero-delay loop is oscillating through ${nets.slice(0, 6).map(n => this.netName(n)).join(", ")}`,
      { time: this.now, deltas, nets: nets.map(n => ({ net: n, name: this.netName(n), value: this.val[n] })), cells, loops },
    );
  }

  private notify(): void {
    const changed: number[] = [];
    for (const n of this.touched) if (this.val[n] !== this.stepStart[n]) changed.push(n);
    if (!changed.length) return;
    if (this.stepListeners.size) for (const l of [...this.stepListeners]) l(this.now, changed);
    if (this.netWatch.size) {
      const hit = new Set<Watch>();
      for (const n of changed) { const ws = this.netWatch.get(n); if (ws) for (const w of ws) hit.add(w); }
      for (const w of [...hit].sort((a, b) => a.order - b.order)) w.cb(this.valueOf(w.nets), this.now);
    }
  }

  // ─────────────── stimulus ───────────────

  /**
   * Drives a design input (or inout) to `value` at time `at` (default: now). Several values may
   * be queued for future times; they apply in time order. `at` may equal now even after the
   * step at now has run: the new value then starts another delta round at the same time.
   */
  setInput(ref: SignalRef, value: ValueLike, at: number = this.now): void {
    if (this.halted) this.assertLive();
    const s = this.sig(ref);
    const c = this.inputCell.get(s.name);
    if (!c) throw new DigitalSimError("not-an-input", `"${s.name}" is a ${s.kind}, not a design input`, { signal: s.name, kind: s.kind });
    checkTime(at, "input time");
    if (at < this.now) throw new DigitalSimError("past-time", `cannot set "${s.name}" at ${at} fs: already at ${this.now} fs (the kernel never rolls back)`, { signal: s.name, time: at, now: this.now });
    let codes: Uint8Array;
    try { codes = toCodes(value, s.nets.length); }
    catch (e) { throw new DigitalSimError("bad-value", `bad value for "${s.name}": ${(e as Error).message}`, { signal: s.name, width: s.nets.length }); }
    const port = c.outs[0];
    const idx: number[] = [], vals: number[] = [];
    for (let i = 0; i < codes.length; i++) { idx.push(i); vals.push(codes[i]); }
    const ev = new Ev(at, this.seq++, port, null, idx, vals);
    if (at === this.now) this.nextDelta.push(ev); else this.heap.push(ev);
  }

  // ─────────────── inspection ───────────────

  private sig(ref: SignalRef): SignalDef {
    const name = typeof ref === "string" ? ref : ref.name;
    const s = this.sigByName.get(name);
    if (!s) throw new DigitalSimError("unknown-signal", `no signal named "${name}"`, { signal: name });
    return s;
  }

  signal(ref: SignalRef): SignalInfo {
    const s = this.sig(ref);
    return { name: s.name, width: s.nets.length, kind: s.kind, nets: s.nets, src: s.src, hidden: !!s.hidden };
  }

  signals(): SignalInfo[] { return [...this.sigByName.values()].map(s => this.signal(s.name)); }

  hasSignal(name: string): boolean { return this.sigByName.has(name); }

  private netsOf(ref: SignalRef | number): readonly number[] {
    return typeof ref === "number" ? (this.checkNet(ref, "query"), [ref]) : this.sig(ref).nets;
  }

  private valueOf(nets: readonly number[]): LogicVec {
    const c = new Uint8Array(nets.length);
    for (let i = 0; i < nets.length; i++) c[i] = this.val[nets[i]];
    return LogicVec.fromCodes(c);
  }

  /** Current value of a signal (or of a single net). */
  get(ref: SignalRef | number): LogicVec { return this.valueOf(this.netsOf(ref)); }

  /** Resolved drive strength of a net right now (e.g. to tell a pull-up from a push-pull 1). */
  strengthOf(net: number): Strength { this.checkNet(net, "query"); return this.str[net] as Strength; }

  private traceIndex(n: number, t: number): number {
    const tr = this.traces[n];
    if (!tr) return -1;
    let lo = 0, hi = tr.n - 1, ans = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (tr.t[m] <= t) { ans = m; lo = m + 1; } else hi = m - 1;
    }
    return ans;
  }

  private assertRecorded(n: number): void {
    if (n >= 4 && !this.rec[n]) throw new DigitalSimError("unknown-signal", `net ${this.netName(n)} is not recorded (see the record option)`, { net: n });
  }

  /** Value of one net after all activity at time t (t > now answers with the present value). */
  bitAt(net: number, t: number): Logic {
    this.checkNet(net, "query");
    if (net < 4) return net as Logic;
    if (t >= this.now) return this.val[net] as Logic;
    this.assertRecorded(net);
    const i = this.traceIndex(net, t);
    return (i < 0 ? this.initVal[net] : this.traces[net]!.v[i]) as Logic;
  }

  /** Value of a signal (or net) after all activity at time t. */
  valueAt(ref: SignalRef | number, t: number): LogicVec {
    const nets = this.netsOf(ref);
    const c = new Uint8Array(nets.length);
    for (let i = 0; i < nets.length; i++) c[i] = this.bitAt(nets[i], t);
    return LogicVec.fromCodes(c);
  }

  /** Value just before time t, i.e. before any activity at t (what a flop samples at an edge at t). */
  valueBefore(ref: SignalRef | number, t: number): LogicVec {
    return t <= 0 ? this.valueOf(this.netsOf(ref).map(n => (n < 4 ? n : this.initVal[n]))) : this.valueAt(ref, t - 1);
  }

  /** The change that set net's value as of time t, with the cell that caused it; null if the net
   *  still holds its initial value. */
  changeAt(net: number, t: number): NetChange | null {
    this.checkNet(net, "query");
    if (net < 4) return null;
    this.assertRecorded(net);
    const i = this.traceIndex(net, t);
    if (i < 0) return null;
    const tr = this.traces[net]!;
    return { time: tr.t[i], value: tr.v[i] as Logic, cause: this.cellInfo(tr.c[i]) };
  }

  /** Raw change list of one net (views into the store: copy before keeping them). */
  netTrace(net: number): { times: Float64Array; values: Uint8Array; causes: Int32Array; initial: Logic } {
    this.checkNet(net, "query");
    this.assertRecorded(net);
    const tr = this.traces[net];
    const init = (net < 4 ? net : this.initVal[net]) as Logic;
    if (!tr) return { times: new Float64Array(0), values: new Uint8Array(0), causes: new Int32Array(0), initial: init };
    return { times: tr.t.subarray(0, tr.n), values: tr.v.subarray(0, tr.n), causes: tr.c.subarray(0, tr.n), initial: init };
  }

  /** Change list of a whole signal: one entry per time any bit changed, starting at time 0. */
  getTrace(ref: SignalRef | number): VectorTrace {
    const nets = this.netsOf(ref);
    const cur = new Uint8Array(nets.length);
    const trs = nets.map((n, i) => { cur[i] = n < 4 ? n : this.initVal[n]; if (n >= 4) this.assertRecorded(n); return n < 4 ? null : this.traces[n]; });
    const pos = new Int32Array(nets.length);
    const times: number[] = [0];
    const values: LogicVec[] = [LogicVec.fromCodes(cur)];
    for (;;) {
      let t = Infinity;
      for (let i = 0; i < trs.length; i++) { const tr = trs[i]; if (tr && pos[i] < tr.n && tr.t[pos[i]] < t) t = tr.t[pos[i]]; }
      if (t === Infinity) break;
      for (let i = 0; i < trs.length; i++) { const tr = trs[i]; if (tr && pos[i] < tr.n && tr.t[pos[i]] === t) cur[i] = tr.v[pos[i]++]; }
      const v = LogicVec.fromCodes(cur);
      if (times[times.length - 1] === t) values[values.length - 1] = v;
      else if (!v.equals(values[values.length - 1])) { times.push(t); values.push(v); }
    }
    return { times, values };
  }

  cellInfo(id: number): CellInfo {
    const c = this.cells[id];
    if (!c) throw new DigitalSimError("bad-netlist", `no cell with id ${id}`, { id });
    return c.src !== undefined ? { id, name: c.name, type: c.type, src: c.src } : { id, name: c.name, type: c.type };
  }

  /** Connectivity of a cell: net lists per input and output port. */
  cellPorts(id: number): { inputs: Record<string, number[]>; outputs: Record<string, number[]> } {
    const c = this.cells[id];
    if (!c) throw new DigitalSimError("bad-netlist", `no cell with id ${id}`, { id });
    const inputs: Record<string, number[]> = {}, outputs: Record<string, number[]> = {};
    c.inNames.forEach((n, i) => { inputs[n] = [...c.ins[i]]; });
    for (const p of c.outs) outputs[p.name] = Array.from({ length: p.width }, (_, i) => this.drvNet[p.base + i]);
    return { inputs, outputs };
  }

  /** Every driver of a net, or of every bit of a signal. */
  driversOf(ref: SignalRef | number): DriverInfo[] {
    const out: DriverInfo[] = [];
    for (const n of this.netsOf(ref)) {
      if (n < 4) continue;
      for (let k = this.netDrvStart[n]; k < this.netDrvStart[n + 1]; k++) {
        const d = this.netDrv[k];
        const p = this.drvPort[d];
        out.push({ ...this.cellInfo(p.cell.id), port: p.name, bit: d - p.base });
      }
    }
    return out;
  }

  /** Readable name of a net: the first public signal bit it belongs to. */
  netName(net: number): string {
    if (net < 4) return CONST_NAMES[net];
    if (!this.netNames) {
      const names = new Array<string>(this.netCount);
      for (const pass of [false, true]) for (const s of this.signalDefs) {
        if (!!s.hidden !== pass) continue;
        s.nets.forEach((n, i) => { if (names[n] === undefined && n >= 4) names[n] = s.nets.length === 1 ? s.name : `${s.name}[${i}]`; });
      }
      this.netNames = names;
    }
    return this.netNames[net] ?? `net${net}`;
  }

  /**
   * Static combinational loop analysis: strongly connected components of the cell graph with
   * sequential cells removed. A loop here is legal if it settles (an SR latch from gates), but
   * it is where a delta-overflow comes from.
   */
  combinationalLoops(): CellInfo[][] {
    const N = this.cells.length;
    const succ = (ci: number): number[] => {
      const out: number[] = [];
      const c = this.cells[ci];
      for (const p of c.outs) for (let i = 0; i < p.width; i++) {
        const n = this.drvNet[p.base + i];
        if (n < 4) continue;
        for (let k = this.foStart[n]; k < this.foStart[n + 1]; k++) { const s = this.fo[k]; if (!this.cells[s].sequential) out.push(s); }
      }
      return out;
    };
    // Iterative Tarjan.
    const index = new Int32Array(N).fill(-1), low = new Int32Array(N), onStack = new Uint8Array(N);
    const stack: number[] = [];
    const loops: CellInfo[][] = [];
    let counter = 0;
    for (let root = 0; root < N; root++) {
      if (index[root] >= 0 || this.cells[root].sequential) continue;
      const work: [number, number[], number][] = [[root, succ(root), 0]];
      index[root] = low[root] = counter++; stack.push(root); onStack[root] = 1;
      while (work.length) {
        const fr = work[work.length - 1];
        const [v, ss] = fr;
        if (fr[2] < ss.length) {
          const w = ss[fr[2]++];
          if (index[w] < 0) { index[w] = low[w] = counter++; stack.push(w); onStack[w] = 1; work.push([w, succ(w), 0]); }
          else if (onStack[w]) low[v] = Math.min(low[v], index[w]);
          continue;
        }
        work.pop();
        if (work.length) { const u = work[work.length - 1][0]; low[u] = Math.min(low[u], low[v]); }
        if (low[v] === index[v]) {
          const comp: number[] = [];
          let w: number;
          do { w = stack.pop()!; onStack[w] = 0; comp.push(w); } while (w !== v);
          if (comp.length > 1 || ss.includes(v)) loops.push(comp.sort((a, b) => a - b).map(ci => this.cellInfo(ci)));
        }
      }
    }
    return loops;
  }

  // ─────────────── listeners ───────────────

  /** Called after every time step that changed any net, with the nets whose value differs from
   *  the start of the step (delta glitches that returned to the old value are not reported). */
  onStep(cb: (time: number, nets: readonly number[]) => void): () => void {
    this.stepListeners.add(cb);
    return () => this.stepListeners.delete(cb);
  }

  private watchOrder = 0;

  /** Called after a time step in which the signal's value changed, with its settled value. */
  onChange(ref: SignalRef | number, cb: (value: LogicVec, time: number) => void): () => void {
    const nets = this.netsOf(ref);
    const w: Watch = { nets, cb, order: this.watchOrder++ };
    for (const n of nets) { let s = this.netWatch.get(n); if (!s) this.netWatch.set(n, (s = new Set())); s.add(w); }
    return () => { for (const n of nets) { const s = this.netWatch.get(n); if (s) { s.delete(w); if (!s.size) this.netWatch.delete(n); } } };
  }
}

interface Watch {
  nets: readonly number[];
  cb: (value: LogicVec, time: number) => void;
  order: number;
}
