/**
 * Volt simulation engine - Modified Nodal Analysis (MNA), dense.
 * Supports: .op, .dc sweep, .tran (Backward Euler first step + Trapezoidal), .ac,
 *           .noise (adjoint small-signal noise - see src/lib/sim/noise.ts),
 *           and a nested .step/.temp sweep driver over any of them.
 * Elements: R, C, L, V, I, D (Shockley + Newton + junction limiting), E/G/F/H (controlled sources),
 *           OPAMP (high-gain VCVS), M (MOSFET Level 1, NMOS/PMOS), Q (BJT), B (behavioural), K.
 * Nonlinear devices are linearized per Newton iteration; gmin is shunted to ground.
 *
 * DC continuation ladder (in order, DC/op context only - a transient step already has the
 * previous timepoint as a warm start and its own ÷4 retry):
 *     direct Newton → gmin stepping → source stepping (λ-scaled sources)
 *                   → pseudo-transient (per-node shunt C, BE-integrated to steady state)
 * and, when all of them fail, a ConvergenceReport that NAMES the guilty device and suggests a
 * `.nodeset` instead of printing "singular matrix". `.nodeset V(n)=v` seeds the initial guess.
 */
import {
  Netlist, NetlistElement, Analysis, SimResult, SimError, SimOptions, DEFAULT_OPTIONS, VT, Complex, TransientSource, ACSpec,
  ComponentReadout, ConvergenceReport, StepSpec, SwitchModel, VdmosModel, DiodeModel,
} from "./types";
import { solveReal, solveComplex } from "./matrix";
import { compileExpr, evalAndJacobian, type CompiledBExpr } from "./bsource";
import { runNoise } from "./noise";
import { MixedSim, d2aWaveOf, digitalErrorMessage, type Breakpoint } from "./mixed";

// ---------- index bookkeeping ----------
export class Indexer {
  nodeIndex = new Map<string, number>();   // node name -> row (ground "0" -> -1)
  nNodes = 0;
  branchOf = new Map<string, number>();    // a key (e.g. "V:V1", "L:L1", "E:E1", "H:H1", "OP:U1", "Q:Q1") -> row
  nBranch = 0;
  constructor(nodes: string[]) {
    this.nodeIndex.set("0", -1);
    for (const n of nodes) if (n !== "0" && !this.nodeIndex.has(n)) this.nodeIndex.set(n, this.nNodes++);
  }
  node(n: string): number { const i = this.nodeIndex.get(n); return i === undefined ? -1 : i; }
  /** Allocate (or fetch) an internal (synthetic) node - used for device parasitic resistances. */
  internal(key: string): number {
    let i = this.nodeIndex.get(key);
    if (i === undefined) { i = this.nNodes++; this.nodeIndex.set(key, i); }
    return i;
  }
  /** allocate (or get) a branch row, returns its column index in the full system (nNodes + b). */
  branch(key: string): number {
    let b = this.branchOf.get(key);
    if (b === undefined) { b = this.nBranch++; this.branchOf.set(key, b); }
    return this.nNodes + b;
  }
  get size() { return this.nNodes + this.nBranch; }
}

// ---------- transient source evaluation ----------
export function evalSource(src: TransientSource | undefined, dc: number, t: number): number {
  if (!src) return dc;
  switch (src.kind) {
    case "dc": return src.v;
    case "pulse": {
      const { v1, v2, td, tr, tf, pw, per } = src;
      if (t < td) return v1;
      let tt = t - td;
      if (per > 0) { if (src.ncycles && tt >= per * src.ncycles) return v1; tt = tt % per; }
      const Tr = Math.max(tr, 1e-15), Tf = Math.max(tf, 1e-15);
      if (tt < Tr) return v1 + (v2 - v1) * (tt / Tr);
      if (tt < Tr + pw) return v2;
      if (tt < Tr + pw + Tf) return v2 + (v1 - v2) * ((tt - Tr - pw) / Tf);
      return v1;
    }
    case "sin": {
      const { voff, vamp, freq, td, theta, phase } = src;
      if (t < td) return voff + vamp * Math.sin((phase * Math.PI) / 180);
      const tt = t - td;
      return voff + vamp * Math.exp(-tt * theta) * Math.sin(2 * Math.PI * freq * tt + (phase * Math.PI) / 180);
    }
    case "exp": {
      const { v1, v2, td1, tau1, td2, tau2 } = src;
      if (t < td1) return v1;
      let v = v1 + (v2 - v1) * (1 - Math.exp(-(t - td1) / Math.max(tau1, 1e-15)));
      if (t >= td2) v -= (v2 - v1) * (1 - Math.exp(-(t - td2) / Math.max(tau2, 1e-15)));
      return v;
    }
    case "pwl": {
      let pts = src.points;
      if (pts.length === 0) return dc;
      // Defensive sort - netlist parser sorts, but a PWL coming straight from code might not.
      // We mutate-in-place once; subsequent calls hit a pre-sorted array.
      if (pts.length > 1) {
        for (let i = 1; i < pts.length; i++) if (pts[i][0] < pts[i - 1][0]) { pts = pts.slice().sort((a, b) => a[0] - b[0]); (src as { points: [number, number][] }).points = pts; break; }
      }
      if (t <= pts[0][0]) return pts[0][1];
      for (let i = 0; i < pts.length - 1; i++) {
        const [t0, v0] = pts[i], [t1, v1] = pts[i + 1];
        if (t >= t0 && t <= t1) {
          // Vertical step: pts[i].t == pts[i+1].t - the user encoded a discontinuity. Match
          // LTspice convention: AT the breakpoint we still return v0 (the LEFT value); only
          // strictly past t0 do we switch to v1. The previous code returned v1 unconditionally,
          // making vertical PWL edges trigger one sample early.
          if (t1 === t0) return t > t0 ? v1 : v0;
          return v0 + (v1 - v0) * ((t - t0) / (t1 - t0));
        }
      }
      return pts[pts.length - 1][1];
    }
    case "sffm": {
      // v(t) = voff + vamp * sin(2π*fc*t + mdi * sin(2π*fs*t))    [SPICE3 single-frequency-FM]
      const { voff, vamp, fc, mdi, fs } = src;
      return voff + vamp * Math.sin(2 * Math.PI * fc * t + mdi * Math.sin(2 * Math.PI * fs * t));
    }
    case "am": {
      // v(t) = vamp * (voff + sin(2π*fm*(t-td))) * sin(2π*fc*(t-td))   [SPICE3 amplitude modulation]
      const { vamp, voff, fm, fc, td } = src;
      if (t < td) return 0;
      const tt = t - td;
      return vamp * (voff + Math.sin(2 * Math.PI * fm * tt)) * Math.sin(2 * Math.PI * fc * tt);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// TRANSIENT STEP CONTROL - local truncation error, divergence detection
//
// WHY THIS EXISTS. The transient loop used to run a FIXED timestep: `h` was computed once from
// `.tran tstep` and never adapted. On a hard-switching converter that is fatal twice over. A
// 200 kHz buck has a 5 µs period and a 20 ns gate edge; at the "generous" tstep = T/50 = 100 ns
// the entire gate transition - the part of the cycle where every node moves - is ONE step, or
// none. That is the accuracy problem (a badly wrong dI/dt, hence a wrong ripple and a wrong
// Vout) AND the convergence problem (Newton is handed a starting point a full transition away
// from the answer, stalls, and the ÷4 retry ladder is the only thing between that and an
// aborted run).
//
// The principled fix is a variable step driven by the LOCAL TRUNCATION ERROR: extrapolate the
// solution to the new timepoint with a polynomial of the same order as the integrator, solve,
// and compare. The difference is an asymptotically correct estimate of the step's own error
// (Milne's device). Too big ⇒ the step is redone smaller; comfortably small ⇒ the step grows.
//
// CONSERVATISM, DELIBERATE AND LOAD-BEARING:
//   • `tstep` becomes a CEILING, never a floor. The controller can only ever REFINE the grid
//     the fixed-step loop would have produced, so a circuit that was already well resolved
//     takes exactly the same steps at exactly the same times and produces bit-identical
//     numbers. Every existing waveform assertion is therefore untouched by construction.
//   • It engages only for circuits containing a switching/semiconductor device. A linear RLC
//     network has no stiffness to discover, and its grid is depended on by the order-of-
//     convergence and linearity suites, which measure e(h) ∝ hᵖ and require the h they asked
//     for.
//   • A per-run refinement budget bounds the extra work; past it the controller stops
//     refining for accuracy (it still refines to rescue a failing Newton) and SAYS SO in the
//     result rather than silently running for minutes.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** SPICE3's TRTOL. The predictor-corrector difference over-estimates the true LTE by roughly
 *  this factor, so the raw norm is compared against it rather than against 1. Raising it makes
 *  the controller lazier (fewer, bigger steps); lowering it makes it refine harder. */
const TRTOL = 7;
/** Absolute sanity bound on any node voltage / branch current, in V or A.
 *  This is NOT a physical plausibility check - boost converters, flybacks, charge pumps and
 *  unsnubbed inductive turn-off all legitimately reach many times their supply, and refusing
 *  those would be its own confidently-wrong answer. A gigavolt is not a circuit any person
 *  simulates; past here the iteration is running away and continuing to plot it is worse than
 *  stopping with an honest error. */
const DIVERGE_ABS = 1e9;
/** How many times one timepoint may be redone for ACCURACY before the step is taken anyway.
 *  A step that will not meet tolerance is an accuracy limitation, not a divergence, and must
 *  never be reported as one - so the ladder ends in an accepted (small) step, not an abort. */
const MAX_LTE_REJECTS = 10;

/** True when every entry is finite AND inside the runaway bound. */
function sampleIsSane(xx: number[]): boolean {
  for (let i = 0; i < xx.length; i++) {
    const v = xx[i];
    if (!Number.isFinite(v) || Math.abs(v) > DIVERGE_ABS) return false;
  }
  return true;
}

/** Index of the first non-finite / runaway entry, or -1. Used only to NAME the guilty row. */
function firstInsaneRow(xx: number[]): number {
  for (let i = 0; i < xx.length; i++) if (!Number.isFinite(xx[i]) || Math.abs(xx[i]) > DIVERGE_ABS) return i;
  return -1;
}

/** Human name for a solution row: the node it belongs to, or the branch unknown. */
function rowName(ix: Indexer, row: number): string {
  if (row < ix.nNodes) {
    for (const [n, i] of ix.nodeIndex) if (i === row) return `V(${n})`;
    return `node #${row}`;
  }
  const b = row - ix.nNodes;
  for (const [k, i] of ix.branchOf) if (i === b) return `I(${k})`;
  return `branch #${b}`;
}

/**
 * Quadratic (2nd-order) extrapolation of the solution to `tn`, through the last three accepted
 * timepoints, in Newton divided-difference form so a NON-UNIFORM grid is handled exactly:
 *
 *     p(t) = x0 + (t−t0)·f[t0,t1] + (t−t0)(t−t1)·f[t0,t1,t2]
 *
 * The trapezoidal corrector is also 2nd order, so |corrector − predictor| is proportional to
 * the same h³·y‴ term that IS the local truncation error - which is what makes the difference
 * usable as an error estimate rather than just a plausibility check.
 */
function predictQuadratic(x0: number[], x1: number[], x2: number[], t0: number, t1: number, t2: number, tn: number): number[] {
  const d01 = t0 - t1, d12 = t1 - t2, d02 = t0 - t2;
  const out = new Array(x0.length);
  // Degenerate spacing (repeated timepoint) ⇒ fall back to the linear predictor rather than
  // dividing by zero and handing the controller a NaN error norm.
  const safe = Math.abs(d01) > 1e-30 && Math.abs(d12) > 1e-30 && Math.abs(d02) > 1e-30;
  for (let i = 0; i < x0.length; i++) {
    const dd1a = safe ? (x0[i] - x1[i]) / d01 : 0;
    if (!safe) { out[i] = x0[i]; continue; }
    const dd1b = (x1[i] - x2[i]) / d12;
    const dd2 = (dd1a - dd1b) / d02;
    out[i] = x0[i] + (tn - t0) * dd1a + (tn - t0) * (tn - t1) * dd2;
  }
  return out;
}

/**
 * Normalised local-truncation-error estimate. Returns max over all rows of
 *
 *     |x_corrector − x_predictor| / (reltol·max(|xc|, |xp|, xRef) + floor)
 *
 * `xRef` is the largest magnitude that row has reached so far in the run, and including it is
 * what makes the estimate usable at all. Without it, a node that swings 5 V but is momentarily
 * passing through zero gets a tolerance of `vntol` = 1 µV - BELOW the Newton convergence floor
 * that produced both numbers. The estimate then never falls under 1 no matter how small the
 * step, the controller shrinks h forever chasing its own solver noise, and the run is declared
 * divergent. (Observed exactly that on the full-wave bridge in scripts/sim_verify.ts: the error
 * plateaued at ≈2.08 from h = 5e-5 all the way down to h = 3e-11.) Normalising by the signal's
 * own scale asks the only question worth asking - is this step accurate RELATIVE TO THE SIGNAL.
 *
 * Branch (current) rows floor at 1 nA rather than the 1 pA `abstol`: abstol is a convergence
 * criterion, and reusing it here would make every zero-crossing inductor current demand a
 * picosecond step for no accuracy gain.
 */
function lteNorm(xc: number[], xp: number[], ix: Indexer, opt: SimOptions, xRef: number[]): number {
  let worst = 0;
  const iFloor = Math.max(opt.abstol, 1e-9);
  for (let i = 0; i < xc.length; i++) {
    const scale = Math.max(Math.abs(xc[i]), Math.abs(xp[i]), xRef[i] ?? 0);
    const tol = opt.reltol * scale + (i < ix.nNodes ? opt.vntol : iFloor);
    const e = Math.abs(xc[i] - xp[i]) / tol;
    if (e > worst) worst = e;
  }
  return worst;
}

/** Largest independent-source magnitude anywhere in the netlist, over the whole run. Used only
 *  to decide whether a node excursion deserves a "check for a missing freewheel path" note -
 *  never to clamp or discard a sample. */
function largestSourceMagnitude(els: NetlistElement[]): number {
  let m = 0;
  const bump = (v: number) => { if (Number.isFinite(v)) m = Math.max(m, Math.abs(v)); };
  for (const el of els) {
    if (el.type !== "V" && el.type !== "I") continue;
    bump(el.dc);
    const s = el.tran;
    if (!s) continue;
    switch (s.kind) {
      case "dc": bump(s.v); break;
      case "pulse": bump(s.v1); bump(s.v2); break;
      case "sin": bump(Math.abs(s.voff) + Math.abs(s.vamp)); break;
      case "exp": bump(s.v1); bump(s.v2); break;
      case "pwl": for (const [, v] of s.points) bump(v); break;
      case "sffm": bump(Math.abs(s.voff) + Math.abs(s.vamp)); break;
      case "am": bump(Math.abs(s.vamp) * (Math.abs(s.voff) + 1)); break;
    }
  }
  return m;
}

/**
 * Source breakpoints - the times where a stimulus has a slope/value discontinuity
 * (PULSE corners, PWL vertices, EXP knees, SIN/AM delay start). SPICE3/ngspice place
 * an exact timepoint on each breakpoint and take a Backward-Euler step across it; this
 * is what damps the well-known trapezoidal "2× ringing" artifact when a reactive
 * network is hit by a fast edge. Returns a sorted, de-duplicated list in (0, tstop].
 */
function collectBreakpoints(els: NetlistElement[], tstop: number): number[] {
  const bps: number[] = [];
  const CAP = 200000; // guard against a fast periodic source over a long run
  const add = (t: number) => { if (t > 1e-18 && t < tstop - 1e-18 && bps.length < CAP) bps.push(t); };
  for (const el of els) {
    const src = (el as { tran?: TransientSource }).tran;
    if (!src) continue;
    switch (src.kind) {
      case "pulse": {
        const { td, tr, tf, pw, per } = src;
        const Tr = Math.max(tr, 1e-15), Tf = Math.max(tf, 1e-15);
        const edges = (base: number) => { add(base); add(base + Tr); add(base + Tr + pw); add(base + Tr + pw + Tf); };
        if (per > 0) {
          const maxCyc = src.ncycles && src.ncycles > 0 ? src.ncycles : Math.ceil((tstop - td) / per) + 1;
          for (let k = 0; k < maxCyc && td + k * per < tstop && bps.length < CAP; k++) edges(td + k * per);
        } else edges(td);
        break;
      }
      case "pwl": for (const [pt] of src.points) add(pt); break;
      case "exp": add(src.td1); add(src.td2); break;
      case "sin": add(src.td); break;
      case "am": add(src.td); break;
      // dc / sffm are C∞ over the run - no breakpoints.
    }
  }
  if (bps.length === 0) return bps;
  bps.sort((a, b) => a - b);
  const out: number[] = [bps[0]];
  for (let i = 1; i < bps.length; i++) if (bps[i] - out[out.length - 1] > 1e-15) out.push(bps[i]);
  return out;
}

// ---------- nonlinear device state ----------
/** Min-heap of run-time breakpoints, ordered by time. */
class BreakpointHeap {
  private a: Breakpoint[] = [];
  get size(): number { return this.a.length; }
  peek(): Breakpoint | undefined { return this.a[0]; }
  push(b: Breakpoint): void {
    const a = this.a;
    a.push(b);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p].t <= a[i].t) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop(): Breakpoint | undefined {
    const a = this.a;
    if (!a.length) return undefined;
    const top = a[0], last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].t < a[m].t) m = l;
        if (r < a.length && a[r].t < a[m].t) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

interface NLState { lastV: Record<string, number>; } // remembers last terminal voltages for limiting

/**
 * Travelling-wave history for one transmission line.
 *
 * `p1`/`p2` are the incident-wave samples a(t) = v(t) + Z0·i(t) at each port, kept as parallel
 * time/value arrays in increasing time. `seed1`/`seed2` are the values to use for any lookup
 * that falls before t = 0 — i.e. the DC bias the line was sitting at before the transient began.
 * Without that seed a biased line would launch a step of its own bias voltage at t = 0.
 */
type TLineHistory = { t: number[]; p1: number[]; p2: number[]; seed1: number; seed2: number };

/**
 * Value of a wave history at an arbitrary past time, linearly interpolated.
 *
 * Interpolation is not a refinement here, it is the requirement: the timestep is adaptive, so
 * t − TD almost never lands on a stored point, and snapping to the nearest one would jitter the
 * delay by up to a full timestep and smear every edge the line is supposed to carry intact.
 */
function tlineSample(hist: TLineHistory, port: 1 | 2, want: number): number {
  const ts = hist.t;
  const vals = port === 1 ? hist.p1 : hist.p2;
  const seed = port === 1 ? hist.seed1 : hist.seed2;
  const n = ts.length;
  if (n === 0 || want <= ts[0]) return seed;
  if (want >= ts[n - 1]) return vals[n - 1];
  // Binary search for the bracketing pair. Histories run to thousands of points on a long run,
  // and a linear scan per Newton iteration would dominate the solve.
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ts[mid] <= want) lo = mid; else hi = mid; }
  const dt = ts[hi] - ts[lo];
  if (dt <= 0) return vals[lo];
  const f = (want - ts[lo]) / dt;
  return vals[lo] + f * (vals[hi] - vals[lo]);
}

const limitJunction = (vnew: number, vold: number, vt: number, vcrit: number): number => {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / vt;
      return arg > 0 ? vold + vt * Math.log(arg) : vcrit;
    }
    // Cold-start (vold ≤ 0): use the Colon–Pederson critical-voltage limiter referenced against
    // Vcrit, not Vt. Previously this returned vt*log(vnew/vt) which is dimensionally wrong and
    // could leave a diode forever stuck when warming up from a zero initial guess.
    return vcrit + vt * Math.log(Math.max(vnew, vt) / vcrit);
  }
  // Forward → reverse crossing. The intent is to stop Newton from hurling a CONDUCTING junction
  // deep into reverse in one step; the cap is "come down by at most 2·Vt from where you were".
  //
  // The guard on the size of the raw step is essential and was missing. Without it, a junction
  // sitting at +3.7 µV whose next iterate is −0.4 µV - a 4 µV move - was slammed to vold − 2·Vt
  // ≈ −54 mV, i.e. the "limiter" MOVED THE ITERATE FOUR ORDERS OF MAGNITUDE FURTHER than Newton
  // asked. The junction then swung back next iteration, and the pair oscillated until itl1 ran
  // out. That is the whole story behind "Transient: failed to converge" on a buck converter
  // whose catch diode is momentarily sitting at ~0 V (switch open, inductor current near zero):
  // nothing was wrong with the circuit or the timestep - the limiter was the instability.
  // A limiter must never move the solution further than the step it is limiting.
  if (vnew < 0 && vold > 0 && vold - vnew > 2 * vt) return Math.min(0, vold - 2 * vt);
  return vnew;
};

// ---------- the core linear-system assembler & DC/transient solver ----------
interface StampCtx {
  ix: Indexer;
  G: number[][];
  b: number[];
  x: number[];                 // current solution guess (length ix.size); voltages then branch currents
  opt: SimOptions;
  time: number;                // transient time (NaN for pure DC)
  h: number;                   // transient step (0 for DC / .op)
  beStep: boolean;             // use Backward Euler this step (else Trapezoidal)
  caps: Map<string, { vPrev: number; iPrev: number }>;     // per-cap history
  inds: Map<string, { iPrev: number; vPrev: number }>;     // per-inductor history
  /** per-device reactive history for diode/MOSFET/BJT junction capacitances */
  dCaps: Map<string, { vPrev: number; iPrev: number; qPrev: number }>;
  acFreq?: number;             // set during AC build (we reuse stamping but in a complex pass elsewhere)
  nonlinHit: boolean;          // set if any nonlinear element stamped
  nlState: NLState;
  els: NetlistElement[];       // full element list (needed for cross-element coupling like K)
  limitActive: boolean;        // set during a stamp pass when a junction/Vds limiter clipped a step
}

function nodeV(ctx: StampCtx, name: string): number {
  const i = ctx.ix.node(name); return i < 0 ? 0 : ctx.x[i];
}
function addG(ctx: StampCtx, a: number, c: number, v: number) { if (a < 0 || c < 0) return; ctx.G[a][c] += v; }
function addB(ctx: StampCtx, a: number, v: number) { if (a < 0) return; ctx.b[a] += v; }

/** Stamp a 2-terminal conductance g between nodes na, nb. */
function stampG2(ctx: StampCtx, na: number, nb: number, g: number) {
  if (na >= 0) ctx.G[na][na] += g;
  if (nb >= 0) ctx.G[nb][nb] += g;
  if (na >= 0 && nb >= 0) { ctx.G[na][nb] -= g; ctx.G[nb][na] -= g; }
}
/** Stamp a current source value `iv` flowing from na to nb (Norton companion current). */
function stampI2(ctx: StampCtx, na: number, nb: number, iv: number) { addB(ctx, na, -iv); addB(ctx, nb, +iv); }
/** Stamp a VCVS-type branch: v(na)-v(nb) = expr; row at column `brow` (full index). expr terms supplied via callback. */
function stampVbranch(ctx: StampCtx, na: number, nb: number, brow: number, rhs: number, extra?: (row: number) => void) {
  if (na >= 0) { ctx.G[na][brow] += 1; ctx.G[brow][na] += 1; }
  if (nb >= 0) { ctx.G[nb][brow] -= 1; ctx.G[brow][nb] -= 1; }
  ctx.b[brow] += rhs;
  if (extra) extra(brow);
}

// ---------- switch (S / W) geometry ----------
/**
 * Where the switch's conductance transition sits, and how wide it is, for the CURRENT latch
 * state. Split out of the stamp so the state-commit pass (commitSwitchStates) uses byte-identical
 * arithmetic - two copies of this would let the reported state disagree with the stamped
 * conductance, which is exactly the class of silent wrongness this engine must not produce.
 *
 *   s(ctrl) = ½(1 + tanh((ctrl − centre)/w))          smooth 0…1
 *   g(ctrl) = Goff · (Gon/Goff)^s                     logistic in LOG conductance
 *
 * The log interpolation matters: Ron and Roff are typically 12 decades apart, and a LINEAR blend
 * would spend almost the whole transition at a conductance indistinguishable from Gon, i.e. the
 * "off" half of the transition would be physically absent.
 *
 * HYSTERESIS. The transition is centred on the SPICE threshold for the current latch state:
 * Vt+Vh while open, Vt−Vh while closed. So a control excursion that stays inside the band
 * [Vt−Vh, Vt+Vh] leaves the switch where it was - at ±0.7·Vh from centre the logistic is still
 * within 1 % of its rail, which is what "hysteresis prevents chatter" has to mean to be worth
 * anything. The latch itself only fires once the transition is COMPLETE (s ≥ 0.999 / ≤ 0.001),
 * which is what keeps g continuous across it: re-centring at that moment moves s from 0.999 to
 * 1−1e-17, i.e. changes R by ~1 %. With Vh = 0 there is no latch and the transition is centred
 * on Vt, so the hysteretic and non-hysteretic forms are the same expression.
 */
interface SwitchGeom { Gon: number; Goff: number; w: number; centre: number; hyst: boolean; }
const SW_LATCH_K = 3.45338;                        // atanh(0.998): u where s = 0.999
export function switchGeometry(m: SwitchModel, isVoltage: boolean, state: 0 | 1): SwitchGeom {
  const Ron = Math.max(Math.abs(m.Ron) || 1, 1e-9);
  const Roff = Math.max(Math.abs(m.Roff) || 1e12, Ron * 1.0000001);
  const Vh = Math.max(m.Vh ?? 0, 0);
  const hyst = Vh > 1e-15;
  // Fallback transition width. A current-controlled switch's control quantity is in amps, so a
  // "1 V"-scaled default would be nonsense there; scale off |Vt| when it is non-zero and off a
  // per-kind unit scale when it is not. Documented in types.ts SwitchModel.
  const scale = Math.abs(m.Vt) > 0 ? Math.abs(m.Vt) : (isVoltage ? 1 : 1e-3);
  const w = Math.max(m.Vtr && m.Vtr > 0 ? m.Vtr : (hyst ? Vh / 8 : 0.05 * scale), 1e-12);
  const centre = hyst ? (state ? m.Vt - Vh : m.Vt + Vh) : m.Vt;
  return { Gon: 1 / Ron, Goff: 1 / Roff, w, centre, hyst };
}
/** Conductance, its derivative w.r.t. the control quantity, and the 0…1 "on-ness" s. */
function switchSense(geo: SwitchGeom, ctrl: number): { g: number; dgdc: number; s: number } {
  const u = Math.max(-40, Math.min(40, (ctrl - geo.centre) / geo.w));
  const th = Math.tanh(u);
  const s = 0.5 * (1 + th);
  const lnRatio = Math.log(geo.Gon / geo.Goff);
  const g = geo.Goff * Math.exp(s * lnRatio);
  const dgdc = (g * lnRatio * 0.5 * (1 - th * th)) / geo.w;
  return { g, dgdc, s };
}
/** The control quantity of an S/W element read out of a solution vector. */
function switchControl(ix: Indexer, el: NetlistElement & { type: "S" | "W" }, x: number[]): number {
  if (el.type === "S") {
    const p = ix.node(el.nc1), q = ix.node(el.nc2);
    return (p >= 0 ? x[p] : 0) - (q >= 0 ? x[q] : 0);
  }
  const b = ix.branchOf.get(`V:${el.vsrc}`);
  return b === undefined ? 0 : x[ix.nNodes + b];
}
/**
 * Commit the hysteresis latch after an ACCEPTED solution (a converged transient step, or a
 * converged .dc sweep point). The latch must NOT move inside the Newton loop: a state that
 * flips mid-iteration turns the residual discontinuous and Newton stops being Newton.
 *
 * The latch fires only once the transition has COMPLETED (s ≥ 0.999 / s ≤ 0.001), so re-centring
 * the logistic on the opposite threshold cannot step the conductance - see switchGeometry.
 */
export function commitSwitchStates(ix: Indexer, els: NetlistElement[], x: number[]) {
  for (const el of els) {
    if (el.type !== "S" && el.type !== "W") continue;
    const e = el as unknown as { _swState?: 0 | 1 };
    const st: 0 | 1 = e._swState ?? 0;
    const geo = switchGeometry(el.model, el.type === "S", st);
    if (!geo.hyst) { e._swState = 0; continue; }
    const { s } = switchSense(geo, switchControl(ix, el, x));
    if (s >= 0.999) e._swState = 1;
    else if (s <= 0.001) e._swState = 0;
  }
}

function stampElement(ctx: StampCtx, el: NetlistElement) {
  const ix = ctx.ix;
  const N = (n: string) => ix.node(n);
  switch (el.type) {
    case "R": {
      // R(T) = R0 * (1 + TC1*(T-Tnom) + TC2*(T-Tnom)^2)  (SPICE3 resistor temperature scaling)
      const T = ctx.opt.temp, Tnom = el.tnom ?? 27, dT = T - Tnom;
      const tcScale = 1 + (el.tc1 ?? 0) * dT + (el.tc2 ?? 0) * dT * dT;
      // Preserve SIGN. A negative resistor (negative-impedance converter, tunnel-diode
      // small-signal model, behavioural source) is a legitimate element; the previous
      // Math.abs() silently rectified it to +|R|, yielding a plausible-but-WRONG solution
      // with no warning (e.g. +1k in series with −2k reported V=1.33 V instead of 4 V).
      // Only the MAGNITUDE is floored away from zero so the conductance stays finite.
      const Rnom = el.value * Math.max(tcScale, 1e-9);
      const Reff = Math.abs(Rnom) < 1e-12 ? (Rnom < 0 ? -1e-12 : 1e-12) : Rnom;
      (el as unknown as { _Reff?: number })._Reff = Reff;
      stampG2(ctx, N(el.n1), N(el.n2), 1 / Reff);
      break;
    }
    case "I": {
      const i = ctx.h > 0 || isFinite(ctx.time) ? evalSource(el.tran, el.dc, ctx.time) : el.dc;
      stampI2(ctx, N(el.n1), N(el.n2), i);
      break;
    }
    case "V": {
      const brow = ix.branch(`V:${el.name}`);
      const v = (ctx.h > 0 || isFinite(ctx.time)) ? evalSource(el.tran, el.dc, ctx.time) : el.dc;
      stampVbranch(ctx, N(el.n1), N(el.n2), brow, v);
      break;
    }
    case "C": {
      const C = Math.max(Math.abs(el.value), 1e-18);
      const esr = Math.max(el.esr ?? 0, 0);
      const rpar = el.rpar && el.rpar > 0 ? el.rpar : 0;            // optional parallel leakage
      // parallel leakage is always present (DC and tran)
      if (rpar > 0) stampG2(ctx, N(el.n1), N(el.n2), 1 / rpar);
      if (ctx.h <= 0 || !isFinite(ctx.time)) break;                  // DC: pure C is open
      // With ESR, treat as { n1 - Rser - int - C - n2 }; int = ix.internal("Cint:" + name).
      const hist = ctx.caps.get(el.name) ?? { vPrev: el.ic ?? 0, iPrev: 0 };
      let Geq: number, Ieq: number;
      if (ctx.beStep) { Geq = C / ctx.h; Ieq = -Geq * hist.vPrev; }
      else { Geq = (2 * C) / ctx.h; Ieq = -(Geq * hist.vPrev + hist.iPrev); }
      if (esr > 0) {
        const internal = ix.internal(`Cint:${el.name}`);
        stampG2(ctx, N(el.n1), internal, 1 / esr);                   // series ESR
        stampG2(ctx, internal, N(el.n2), Geq);                       // companion conductance over C
        stampI2(ctx, internal, N(el.n2), Ieq);
      } else {
        stampG2(ctx, N(el.n1), N(el.n2), Geq);
        stampI2(ctx, N(el.n1), N(el.n2), Ieq);
      }
      (el as any)._Geq = Geq; (el as any)._Ieq = Ieq;
      break;
    }
    case "L": {
      const Lv = Math.max(Math.abs(el.value), 1e-15);
      const rser = Math.max(el.rser ?? 0, 0);
      const brow = ix.branch(`L:${el.name}`);
      if (ctx.h <= 0 || !isFinite(ctx.time)) {
        // DC: v(n1) - v(n2) = rser * I(L) (a small resistance, or short if rser=0)
        stampVbranch(ctx, N(el.n1), N(el.n2), brow, 0, (row) => { if (rser > 0) ctx.G[row][brow] -= rser; });
      } else {
        const hist = ctx.inds.get(el.name) ?? { iPrev: el.ic ?? 0, vPrev: 0 };
        // The branch equation stamped below is  v(n1) − v(n2) − (Req + rser)·I = rhs,  where the
        // integrator is applied to the INDUCTIVE voltage only:  v = v_L + rser·I.
        //
        // Backward-Euler: v_L,n = (L/h)(I_n − I_{n-1})
        //     ⟹ rhs = −Req·I_{n-1}
        // Trapezoidal:    v_L,n = (2L/h)(I_n − I_{n-1}) − v_L,{n-1}
        //     ⟹ rhs = −(Req·I_{n-1} + v_L,{n-1})
        //
        // `hist.vPrev` is the TOTAL branch voltage v_{n-1} (updateReactiveHistory records the
        // port voltage), so the inductive part has to be recovered as v_{n-1} − rser·I_{n-1}.
        // Omitting that correction — as this did — leaves rhs too negative by rser·I_{n-1}, and
        // in steady state (I_n = I_{n-1} = I, v_n = v_{n-1} = V) the branch equation collapses to
        // 2V = rser·I, i.e. the winding resistance is modelled at HALF its value. Measured on a
        // 4 Ω-DCR inductor feeding a 6 Ω load from 1 V: .tran settled at 0.750 V (implied DCR
        // 2 Ω) where .op, Backward-Euler and the exact answer all give 0.600 V. Trapezoidal is
        // the DEFAULT method, so every transient with a lossy inductor — every switching
        // converter's conduction loss and output droop — was affected.
        let Req: number, rhs: number;
        if (ctx.beStep) { Req = Lv / ctx.h; rhs = -Req * hist.iPrev; }
        else { Req = (2 * Lv) / ctx.h; rhs = -(Req * hist.iPrev + (hist.vPrev - rser * hist.iPrev)); }
        stampVbranch(ctx, N(el.n1), N(el.n2), brow, rhs, (row) => { ctx.G[row][brow] -= (Req + rser); });
        (el as any)._Req = Req; (el as any)._Veq = rhs;
      }
      break;
    }
    case "K": {
      // mutual coupling between L1 and L2. v(L1) = L1·di1/dt + M·di2/dt ; symmetric for L2; M = k·√(L1·L2)
      if (ctx.h <= 0 || !isFinite(ctx.time)) break; // mutual coupling has no DC effect (just shorts)
      const b1 = ctx.ix.branch(`L:${el.l1}`), b2 = ctx.ix.branch(`L:${el.l2}`);
      // Cache the two inductor ELEMENTS, never their values. The O(n) name lookup is what is
      // worth avoiding per Newton iteration; the inductance itself has to be re-read every time,
      // because `.step`/`.param` rewrite `el.value` in place between sweep points and a memoised
      // number would keep stamping the mutual inductance of the FIRST point for the whole sweep
      // (M = k·√(L1·L2), so a stale L1 is a wrong transformer at every step after the first).
      //
      // Case-insensitive lookup so a user-typed `K1 l1 L2 0.99` finds inductors named L1/l1
      // whichever case the schematic refdes uses.
      type LRef = Extract<NetlistElement, { type: "L" }>;
      let Lp1 = (el as any)._L1ref as LRef | undefined, Lp2 = (el as any)._L2ref as LRef | undefined;
      if (!Lp1 || !Lp2) {
        const u1 = el.l1.toUpperCase(), u2 = el.l2.toUpperCase();
        Lp1 = ctx.els.find(e => e.type === "L" && e.name.toUpperCase() === u1) as LRef | undefined;
        Lp2 = ctx.els.find(e => e.type === "L" && e.name.toUpperCase() === u2) as LRef | undefined;
        if (!Lp1 || !Lp2) break;
        (el as any)._L1ref = Lp1; (el as any)._L2ref = Lp2;
      }
      const L1v = Math.max(Math.abs(Lp1.value), 1e-15);
      const L2v = Math.max(Math.abs(Lp2.value), 1e-15);
      const M = Math.max(-1, Math.min(1, el.k)) * Math.sqrt(L1v * L2v);
      // Backward-Euler / Trap companion for the cross terms
      const kf = ctx.beStep ? 1 : 2;
      const Meq = (kf * M) / ctx.h;
      // Mutual-flux history: the previous currents of both inductors. Keyed off the RESOLVED
      // elements' own names — `el.l1`/`el.l2` are the K card's references, which the parser
      // upper-cases, so looking `ctx.inds` up with them missed entirely for a lower-case refdes
      // and silently substituted iPrev = 0 (i.e. no mutual history at all).
      const hist1 = ctx.inds.get(Lp1.name) ?? { iPrev: 0, vPrev: 0 };
      const hist2 = ctx.inds.get(Lp2.name) ?? { iPrev: 0, vPrev: 0 };
      ctx.G[b1][b2] -= Meq;
      ctx.G[b2][b1] -= Meq;
      // Mutual-flux history. Discretising the coupled branch equation
      //   v1 = d/dt(L1·i1 + M·i2)   (trap: v1_n = (2/h)(φ1_n−φ1_{n-1}) − v1_{n-1};
      //                              BE:   v1_n = (1/h)(φ1_n−φ1_{n-1}))
      // the L self-stamp already contributes its self term −Req1·i1_{n-1} and (for
      // trap) the FULL previous port voltage −v1_{n-1} (which includes the mutual
      // part, since vPrev is stored as the total branch voltage). The only term K
      // must still inject is the explicit mutual history −Meq·i_other,{n-1}, and it
      // is required for BOTH Backward-Euler and trapezoidal. The previous code
      // applied it only for trap AND with the wrong sign (+=), which is a non-passive
      // discretisation - it diverged to ~1e305 for any k≠0 (all transformers /
      // coupled inductors). Correct sign is −Meq·i_other_prev in both modes.
      ctx.b[b1] -= Meq * hist2.iPrev;
      ctx.b[b2] -= Meq * hist1.iPrev;
      break;
    }
    case "E": { // VCVS: v(n1)-v(n2) = gain*(v(nc1)-v(nc2))
      const brow = ix.branch(`E:${el.name}`);
      stampVbranch(ctx, N(el.n1), N(el.n2), brow, 0, (row) => {
        const a = N(el.nc1), c = N(el.nc2);
        if (a >= 0) ctx.G[row][a] -= el.gain;
        if (c >= 0) ctx.G[row][c] += el.gain;
      });
      break;
    }
    case "OPAMP": {
      // Saturating op-amp: v(out_internal) = vmid + Asym · tanh(A · (v(in+) - v(in-)) / Asym)
      //   vmid = (vmax + vmin) / 2,  Asym = (vmax - vmin) / 2
      // Newton companion (linearized around the current iterate):
      //   v(out_internal) - g_loc · v_diff = vmid + Asym·tanh(u^k) - g_loc · v_diff^k    (RHS)
      // where u = A · v_diff / Asym  and  g_loc = A · (1 - tanh²(u^k))
      //
      // Static-network refinements (active when rin/rout > 0):
      //   • rin       - differential input resistance, stamped as a conductance between in+ and in-.
      //                 Default 1e12Ω → effectively open (matches an ideal op-amp). Lowering it
      //                 lets a real op-amp's bias current be observed.
      //   • rout      - output series resistance. The driven branch goes to an INTERNAL node
      //                 "OPout:<name>", then a resistor rout to the external nOut node. This is
      //                 the textbook "ideal source + series R" Thévenin model.
      //   • slew      - output slew-rate limit (V/s). Active in TRANSIENT only: at each step,
      //                 |Δv_out|/h is capped to slew. Implemented via per-element state
      //                 (_vOutPrev) that tracks the last converged output. The Newton companion
      //                 still linearizes around the unclamped ideal vSat - clamping shifts the
      //                 EFFECTIVE vSat, which Newton re-converges around. Doesn't affect .op/.ac.
      //   • gbw       - gain-bandwidth product. Active in AC analysis only (see solveAC's OPAMP
      //                 stamp): the open-loop gain rolls off at -20 dB/dec above ωp = 2π·gbw/A0
      //                 via a 1/(1 + jω/ωp) factor on the controlled-source gain. In transient
      //                 the dominant-pole filter is approximated by the slew clamp + a heuristic
      //                 first-order response - see "_vOutLpf" below.
      ctx.nonlinHit = true;
      const A = Math.max(el.gain, 1);
      const vmax = el.vmax, vmin = el.vmin;
      const vmid = (vmax + vmin) / 2, Asym = Math.max((vmax - vmin) / 2, 1e-6);
      const p = N(el.nInP), m = N(el.nInN), o = N(el.nOut);
      const vp = p >= 0 ? ctx.x[p] : 0, vm = m >= 0 ? ctx.x[m] : 0;
      const vdiff = vp - vm;
      const u = (A * vdiff) / Asym;
      const uClamped = Math.max(Math.min(u, 40), -40);
      const th = Math.tanh(uClamped);
      // Residual-slope floor. tanh saturates so hard that (1−th²) underflows to EXACTLY
      // 0 in float64 for |u|≳20, which fully decouples the op-amp's controlled-source
      // branch from its inputs in the Newton Jacobian - in a feedback loop the iterate
      // then chatters between the two rails and never converges (transient aborts the
      // instant the output first clips). Every production op-amp macromodel (Boyle, …)
      // keeps a small finite open-loop slope in saturation for exactly this reason; a
      // real op-amp does too. The floor is physically negligible (≪ any measurement)
      // and never triggers in the linear region where 1−th²≈1, so it cannot perturb
      // the verified linear-operation results - it only gives Newton a consistent
      // descent direction through hard clipping (comparators, Schmitt, rail-limited
      // oscillators). Same rationale for glocx (output buffer) and gin (gm stage) below.
      const gloc = Math.max(A * (1 - th * th), 1e-3);
      let vSat = vmid + Asym * th;
      // rin: differential input conductance (every mode; default 1e12Ω ⇒ skipped).
      if (el.rin > 0 && el.rin < 1e11) stampG2(ctx, p, m, 1 / Math.max(el.rin, 1e-9));
      const useRout = el.rout > 1e-3;
      const driven = useRout ? ix.internal(`OPout:${el.name}`) : o;
      const brow = ix.branch(`OP:${el.name}`);
      const xN = ix.internal(`OPx:${el.name}`);
      // The compensation node always carries a gmin shunt so it is never singular when the
      // macromodel is inactive (.op/.ac/ideal op-amp) - there it stays decoupled at 0 V and
      // does not perturb the rest of the system.
      if (xN >= 0) ctx.G[xN][xN] += Math.max(ctx.opt.gmin, 1e-12);

      const macro = ctx.h > 0 && isFinite(ctx.time) && el.gbw > 0;
      if (macro && xN >= 0) {
        // ---- Single-pole gm–C op-amp macromodel (finite-GBW transient) ----------------
        // Input gm stage with a hard ±Imax current clamp charges the compensation node x
        // (R1‖C1 to ground); a saturating unity buffer drives the output. Then:
        //     GBW = gm1/(2π·C1),   DC gain = gm1·R1 = A0,   slew = Imax/C1.
        // Small-signal bandwidth (pole) and large-signal rate (slew) are now INDEPENDENT,
        // so the linear pole no longer throttles the saturated output - the exact defect
        // shared by the old scalar GBW filter and the naive in-loop pole.
        const C1 = 1e-6;
        const gm1 = 2 * Math.PI * el.gbw * C1;                 // sets GBW
        const R1 = A / gm1;                                     // sets DC gain (gm1·R1 = A0)
        const Imax = el.slew > 0 ? el.slew * C1 : Infinity;     // sets slew (Imax/C1)
        // clamped VCCS  i = clamp(gm1·v_diff, ±Imax) injected into x  (Newton companion)
        const uin = gm1 * vdiff;
        let iin: number, gin: number;
        if (Math.abs(uin) < Imax) { iin = uin; gin = gm1; }
        else { iin = uin >= 0 ? Imax : -Imax; gin = gm1 * 1e-6; } // tiny residual gm in slew clamp (Jacobian stays coupled to the input - see gloc note)
        if (p >= 0) ctx.G[xN][p] -= gin;
        if (m >= 0) ctx.G[xN][m] += gin;
        ctx.b[xN] += iin - gin * vdiff;                         // Norton constant part
        ctx.G[xN][xN] += 1 / R1;                                // R1 → ground
        const Geq = C1 / ctx.h;                                 // C1 → ground, Backward-Euler
        ctx.G[xN][xN] += Geq;
        ctx.b[xN] += Geq * ((el as { _vxPrev?: number })._vxPrev ?? 0);
        // Saturating unity output buffer:  v(driven) = vmid + Asym·tanh(V(x)/Asym)
        const vx = ctx.x[xN];
        const thx = Math.tanh(Math.max(Math.min(vx / Asym, 40), -40));
        const glocx = Math.max(1 - thx * thx, 1e-4);            // d(out)/dV(x), slope-floored (see gloc note)
        const vSatOut = vmid + Asym * thx;
        stampVbranch(ctx, driven, -1, brow, vSatOut - glocx * vx, (row) => {
          ctx.G[row][xN] -= glocx;
        });
        (el as any)._vSat = vSatOut;
        (el as any)._region = (thx > 0.98) ? 1 : (thx < -0.98) ? 2 : 0;
      } else {
        // ---- Instantaneous saturating VCVS (.op / .ac pre-solve / ideal infinite-GBW) ---
        // Slew clamp retained for the finite-slew + infinite-GBW transient case.
        if (ctx.h > 0 && isFinite(ctx.time) && el.slew > 0) {
          const prev = (el as { _vOutPrev?: number })._vOutPrev;
          if (typeof prev === "number") {
            const maxDelta = el.slew * ctx.h;
            if (vSat > prev + maxDelta) vSat = prev + maxDelta;
            else if (vSat < prev - maxDelta) vSat = prev - maxDelta;
          }
        }
        stampVbranch(ctx, driven, -1, brow, vSat - gloc * vdiff, (row) => {
          if (p >= 0) ctx.G[row][p] -= gloc;
          if (m >= 0) ctx.G[row][m] += gloc;
        });
        (el as any)._vSat = vSat;
        (el as any)._region = (th > 0.98) ? 1 : (th < -0.98) ? 2 : 0;
      }
      if (useRout) stampG2(ctx, driven, o, 1 / Math.max(el.rout, 1e-9));
      (el as any)._gloc = gloc;
      (el as any)._vDiff = vdiff;
      break;
    }
    case "G": { // VCCS: i(n1->n2) = gm*(v(nc1)-v(nc2))
      const a = N(el.n1), c = N(el.n2), p = N(el.nc1), q = N(el.nc2), gm = el.gain;
      if (a >= 0 && p >= 0) ctx.G[a][p] += gm;
      if (a >= 0 && q >= 0) ctx.G[a][q] -= gm;
      if (c >= 0 && p >= 0) ctx.G[c][p] -= gm;
      if (c >= 0 && q >= 0) ctx.G[c][q] += gm;
      break;
    }
    case "F": { // CCCS: i(n1->n2) = gain * I(Vsrc)
      const mcol = ix.branch(`V:${el.vsrc}`);   // controlling source's branch column
      const a = N(el.n1), c = N(el.n2);
      if (a >= 0) ctx.G[a][mcol] += el.gain;
      if (c >= 0) ctx.G[c][mcol] -= el.gain;
      break;
    }
    case "H": { // CCVS: v(n1)-v(n2) = r * I(Vsrc)
      const brow = ix.branch(`H:${el.name}`);
      const mcol = ix.branch(`V:${el.vsrc}`);
      stampVbranch(ctx, N(el.n1), N(el.n2), brow, 0, (row) => { ctx.G[row][mcol] -= el.gain; });
      break;
    }
    case "D": {
      ctx.nonlinHit = true;
      const m = el.model;
      const area = el.area && el.area > 0 ? el.area : 1;
      const T = ctx.opt.temp + 273.15, Tnom = (m.Tnom ?? 27) + 273.15;
      // SPICE3 temperature scaling: Is(T) = Is·(T/Tnom)^(XTI/N) · exp((T/Tnom - 1)·Eg/(N·Vt(T)))
      const VtT = m.N * VT(ctx.opt.temp);
      const isT = m.Is * area * Math.pow(T / Tnom, (m.XTI ?? 3) / Math.max(m.N, 1e-6))
        * Math.exp(((T / Tnom - 1) * (m.Eg ?? 1.11)) / Math.max(VtT, 1e-30));
      const vcrit = VtT * Math.log(VtT / (Math.max(isT, 1e-30) * Math.SQRT2));
      const a = N(el.nA), k = N(el.nK);
      // If Rs > 0 we route through an internal anode-prime node (allocated in precount).
      const useRs = (m.Rs ?? 0) > 1e-9;
      const ap = useRs ? ix.internal(`Dint:${el.name}`) : a;
      if (useRs) {
        const gRs = 1 / Math.max(m.Rs / Math.max(area, 1e-9), 1e-9);
        stampG2(ctx, a, ap, gRs);
      }
      let vd = (ap >= 0 ? ctx.x[ap] : 0) - (k >= 0 ? ctx.x[k] : 0);
      const vdRaw = vd;                          // un-limited value for the convergence check
      const key = `D:${el.name}`;
      // Cold-start: seed vold from vcrit (the textbook "warm" forward voltage) instead of 0.
      // The previous default of 0 made the first-iter limiter aggressively clip diodes that
      // would naturally sit at ~0.7 V, costing a few extra Newton iterations on rectifier OPs.
      // Seeding from vcrit puts us right at the knee where the limiter doesn't kick in.
      const vold = ctx.nlState.lastV[key] ?? vcrit;
      const Bv = m.Bv && m.Bv > 0 ? m.Bv : 0;
      // Forward limit (positive Vd jumping up exponentially)
      vd = limitJunction(vd, vold, VtT, vcrit);
      // Reverse-breakdown limit: prevent Vd from jumping deep into breakdown in one Newton step.
      if (Bv > 0) {
        const Ibv = Math.max(m.Ibv ?? 1e-3, 1e-12);
        const vbrCrit = -Bv - VtT * Math.log(VtT / (Math.max(Ibv, 1e-30) * Math.SQRT2));
        if (vd < vbrCrit && Math.abs(vd - vold) > 2 * VtT) {
          if (vold < -Bv) {
            const arg = 1 + (vold - vd) / VtT;
            vd = arg > 0 ? vold - VtT * Math.log(arg) : vbrCrit;
          } else {
            vd = Math.max(vd, -Bv - 2 * VtT);                // first crossing - gentle entry
          }
        }
      }
      ctx.nlState.lastV[key] = vd;
      // If the limiter clipped the iterate, force another Newton iteration - otherwise we'd
      // converge to a phantom fixed point where the limited Vd ≠ the actual Vd in x.
      if (Math.abs(vd - vdRaw) > 1e-9) ctx.limitActive = true;
      // forward exponential, clamped to prevent overflow
      const ex = Math.exp(Math.min(vd / VtT, 80));
      let Id = isT * (ex - 1);
      let gd = (isT / VtT) * ex;
      // reverse breakdown - model as id = -Ibv·exp(-(Vd+Bv)/Vt), matching the user's Bv,Ibv knee
      if (Bv > 0) {
        const Ibv = Math.max(m.Ibv ?? 1e-3, 1e-12);
        const exb = Math.exp(Math.min(-(vd + Bv) / VtT, 80));
        Id += -Ibv * exb;
        gd += (Ibv / VtT) * exb;
      }
      gd += ctx.opt.gmin;
      const Ieq = Id - gd * vd;
      stampG2(ctx, ap, k, gd);
      stampI2(ctx, ap, k, Ieq);
      // Reset the junction-cap descriptor list at every stamp. updateReactiveHistory reads
      // these after Newton converges to compute the converged cap voltage/current and persist
      // it into dCaps for the NEXT step's companion model.
      (el as unknown as { _jcaps?: unknown[] })._jcaps = [];
      // junction capacitance Cj(Vd): depletion + simple linear-extrapolation past FC·Vj.
      // Cj is computed at EVERY solve (including the DC operating-point solve that
      // precedes .ac), and `_Cj` cached unconditionally, so the AC linearization sees
      // the correct depletion capacitance. Previously this whole block was gated on
      // `ctx.h > 0` (transient only); the .ac pre-solve runs at h=0, so `_Cj` stayed 0
      // and every diode's junction cap was silently absent from AC (wrong varactor /
      // diode-detector / charge-pump / reverse-recovery frequency response). Only the
      // transient companion (Geq/Ieq, history, _jcaps) remains h-gated.
      if ((m.Cjo ?? 0) > 0) {
        const Vj = Math.max(m.Vj ?? 0.7, 0.1), Mj = Math.max(Math.min(m.M ?? 0.5, 0.95), 0.05);
        const FC = 0.5;
        const Cjo = (m.Cjo ?? 0) * area;
        let Cj: number;
        if (vd < FC * Vj) {
          Cj = Cjo / Math.pow(Math.max(1 - vd / Vj, 1e-6), Mj);
        } else {
          // linear extrapolation past the knee - SPICE convention
          const F2 = Math.pow(1 - FC, 1 + Mj);
          const F3 = 1 - FC * (1 + Mj);
          Cj = (Cjo / F2) * (F3 + (Mj * vd) / Vj);
        }
        (el as any)._Cj = Cj;
        if (ctx.h > 0 && isFinite(ctx.time)) {
          const hist = ctx.dCaps.get(key) ?? { vPrev: vd, iPrev: 0, qPrev: 0 };
          let Geq: number, Ieq2: number;
          if (ctx.beStep) { Geq = Cj / ctx.h; Ieq2 = -Geq * hist.vPrev; }
          else { Geq = (2 * Cj) / ctx.h; Ieq2 = -(Geq * hist.vPrev + hist.iPrev); }
          stampG2(ctx, ap, k, Geq);
          stampI2(ctx, ap, k, Ieq2);
          (el as any)._Cj_Geq = Geq; (el as any)._Cj_Ieq = Ieq2;
          (el as unknown as { _jcaps: { key: string; na: number; nc: number; Geq: number; Ieq: number }[] })._jcaps.push({ key, na: ap, nc: k, Geq, Ieq: Ieq2 });
        }
      }
      (el as any)._vd = vd; (el as any)._Id = Id; (el as any)._gd = gd;
      // Diode operating region: 0 = cutoff (reverse-biased or near-zero), 1 = forward-conducting,
      // 2 = breakdown. Breakdown is reported ONLY when the diode model declares a breakdown
      // voltage AND the iterate is below it - for a plain (non-Zener) diode, reverse bias is
      // still "cutoff", just with the small saturation current −Is leaking. A common mistake is
      // to mark any reverse current as breakdown, but that misrepresents normal diode physics:
      // Id approaches −Is for any reverse bias and stays there forever absent a breakdown knee.
      {
        const noiseFloor = 10 * ctx.opt.gmin * VtT;
        let region: 0 | 1 | 2 = 0;
        if (Bv > 0 && vd < -Bv + 4 * VtT) region = 2;            // crossed the breakdown knee
        else if (Id > noiseFloor) region = 1;                    // forward conducting
        else region = 0;                                          // cutoff (incl. -Is leakage)
        (el as any)._region = region;
      }
      break;
    }
    case "M": { // MOSFET Level 1 with body effect, sub-threshold, junction capacitances
      ctx.nonlinHit = true;
      const mo = el.model;
      const d = N(el.nD), g = N(el.nG), s = N(el.nS), bn = N(el.nB);
      const vd = d >= 0 ? ctx.x[d] : 0, vg = g >= 0 ? ctx.x[g] : 0, vs = s >= 0 ? ctx.x[s] : 0, vb = bn >= 0 ? ctx.x[bn] : 0;
      const isP = mo.kind === "pmos";
      // Reduce to NMOS-equivalent: for PMOS we flip all voltage polarities
      const sgn = isP ? -1 : 1;
      let Vgs = sgn * (vg - vs);
      let Vds = sgn * (vd - vs);
      let Vbs = sgn * (vb - vs);
      // MOSFETs are symmetric - if Vds < 0 the source acts as drain. We swap, run the standard
      // forward equations, then flip the sign of Id (and shuffle the small-signal derivatives).
      let reverse = false;
      if (Vds < 0) {
        reverse = true;
        // In reverse mode, the OLD drain is the NEW source. Equivalent NMOS-frame voltages:
        //   Vgs(new) = V(G) - V(old D) = Vgs(orig) - Vds(orig)        (= Vgd)
        //   Vds(new) = V(old S) - V(old D) = -Vds(orig)
        //   Vbs(new) = V(B) - V(old D) = Vbs(orig) - Vds(orig)        (← was unchanged; BUG)
        // Forgetting the Vbs transform makes the body-effect threshold and gmb wrong whenever
        // the bulk is NOT tied to the (electrical) source. For source-tied-bulk the two are
        // equal (Vbs = 0) so the bug is invisible - but pass-gate and switch-matrix usage breaks.
        Vgs = Vgs - Vds;
        Vbs = Vbs - Vds;
        Vds = -Vds;
      }
      // SPICE3 DEVlimvds - caps Newton overshoots through the saturation/triode boundary.
      const kVds = `M:${el.name}:Vds`, kVgs = `M:${el.name}:Vgs`;
      const VdsOld = ctx.nlState.lastV[kVds] ?? Vds;
      const VgsOld = ctx.nlState.lastV[kVgs] ?? Vgs;
      const limVds = (vnew: number, vold: number): number => {
        if (vold >= 3.5) {
          if (vnew > vold) return Math.min(vnew, 3 * vold + 2);
          return vnew < 3.5 ? Math.max(vnew, 2) : vnew;
        }
        return vnew > vold ? Math.min(vnew, 4) : Math.max(vnew, -0.5);
      };
      // DEVpnjlim - prevent Vgs jumps that flip the device through Vth too fast.
      const VthApprox = mo.Vto > 0 ? mo.Vto : -mo.Vto;
      const limVgs = (vnew: number, vold: number): number => {
        if (vold >= VthApprox && vnew >= VthApprox) {
          if (Math.abs(vnew - vold) > 2) return vold + Math.sign(vnew - vold) * 2;
        } else if (vold < VthApprox + 2 && vnew > VthApprox + 2) {
          return VthApprox + 2;
        } else if (vold > VthApprox - 0.5 && vnew < VthApprox - 0.5) {
          return VthApprox - 0.5;
        }
        return vnew;
      };
      const VdsLim = limVds(Vds, VdsOld);
      const VgsLim = limVgs(Vgs, VgsOld);
      const limited = (Math.abs(VdsLim - Vds) > 1e-9) || (Math.abs(VgsLim - Vgs) > 1e-9);
      Vds = VdsLim;
      Vgs = VgsLim;
      ctx.nlState.lastV[kVds] = Vds;
      ctx.nlState.lastV[kVgs] = Vgs;
      if (limited) ctx.limitActive = true;
      // temperature scaling: Vto(T) = Vto + alpha_Vt*(T-Tnom); Kp(T) = Kp·(Tnom/T)^1.5 (mobility ↓)
      const T = ctx.opt.temp + 273.15, Tnom = (mo.Tnom ?? 27) + 273.15;
      const KpT = mo.Kp * Math.pow(Tnom / T, 1.5);
      // |Vth| falls ~2.3 mV/K for BOTH polarities: the drift is in the Fermi potential and the
      // depletion charge, and it shrinks the threshold MAGNITUDE regardless of channel type.
      // Since a PMOS carries a NEGATIVE Vto, the drift has to be applied along `sgn` — without
      // it a PMOS's |Vth| RISES with temperature (measured +2.3 mV/K instead of −2.3 mV/K),
      // which reverses the sign of every PMOS bias drift and thermal-runaway conclusion.
      // The VDMOS stamp below already had this right; the Level-1 stamp did not.
      const VtoT = mo.Vto - sgn * 2.3e-3 * (T - Tnom);
      const Vth0 = isP ? -VtoT : VtoT;              // |Vth| in equivalent NMOS frame
      // body-effect: Vth = Vth0 + γ·(√(Φ − Vbs) − √Φ)
      const phi = Math.max(mo.Phi ?? 0.6, 1e-3);
      const gamma = mo.Gamma ?? 0;
      const sArg1 = Math.max(phi - Vbs, 0);
      const sArg0 = phi;
      const Vth = Vth0 + gamma * (Math.sqrt(sArg1) - Math.sqrt(sArg0));
      const dVth_dVbs = sArg1 > 1e-9 ? -gamma / (2 * Math.sqrt(sArg1)) : 0;
      const beta = KpT * (mo.W / mo.L);
      const lam = mo.Lambda;
      const Vgst = Vgs - Vth;
      const nSub = Math.max(mo.Nsubvt ?? 1.3, 1.0);
      const Vt = VT(ctx.opt.temp);
      const nVt = nSub * Vt;
      let Id = 0, gm = 0, gds = 0, gmb = 0;
      // Subthreshold gating: f(Vgst) = s·ln(1+exp(Vgst/s)) is a smooth max(0, Vgst).
      //
      // THE SCALE MUST BE 2·n·Vt, NOT n·Vt. The strong-inversion current is QUADRATIC in the
      // smoothed overdrive (Id ∝ f²), so deep in subthreshold f ≈ s·exp(Vgst/s) gives
      // Id ∝ exp(2·Vgst/s). The physical requirement is Id ∝ exp(Vgst/(n·Vt)) — a swing of
      // ln(10)·n·kT/q, which at n = 1 and 27 °C is the 59.6 mV/decade thermionic limit that no
      // MOSFET can beat. With s = n·Vt the exponent came out at 2·Vgst/(n·Vt), i.e. a swing of
      // exactly HALF the limit (measured 46.8 mV/dec against an 89.3 mV/dec limit at
      // Nsubvt = 1.5). Setting s = 2·n·Vt makes Id ∝ exp(Vgst/(n·Vt)) exactly, and the large-
      // overdrive limit f → Vgst is unchanged, so strong inversion is untouched.
      const sSub = 2 * nVt;
      const eArg = Vgst / sSub;
      const fSat = eArg > 60 ? Vgst : (eArg < -60 ? sSub * Math.exp(eArg) : sSub * Math.log1p(Math.exp(eArg)));
      const dfSat_dVgst = 1 / (1 + Math.exp(-Math.max(Math.min(eArg, 60), -60)));   // sigmoid(Vgst/s)
      // strong-inversion (use the smoothed overdrive fSat as effective Vgst)
      if (Vds <= 0) {
        Id = 0; gm = 0; gds = ctx.opt.gmin;
      } else if (Vds < fSat) {        // triode / linear
        // Channel-length modulation (1+λ·Vds) is applied HERE too - exactly as the
        // SPICE Level-1 (MOS1) model - so Id, gm AND gds are continuous across the
        // Vds = Vov knee. The previous code switched λ on only in saturation, which
        // made Id jump by 0.5·β·Vov²·λ·Vov at the boundary and produced a spurious
        // gds spike (the stamped gds was NOT the analytic derivative of the stamped
        // Id there) → kinked DC sweeps and Newton stalls for devices biased near the
        // knee (cascodes, triode loads, output stages). Verified continuous at
        // Vds=fSat: triode and sat expressions for Id/gm/gds coincide.
        const clm = 1 + lam * Vds;
        const Plin = fSat * Vds - 0.5 * Vds * Vds;
        Id  = beta * Plin * clm;
        gm  = beta * clm * Vds * dfSat_dVgst;
        gds = beta * ((fSat - Vds) * clm + Plin * lam);
      } else {                        // saturation
        Id  = 0.5 * beta * fSat * fSat * (1 + lam * Vds);
        gm  = beta * fSat * (1 + lam * Vds) * dfSat_dVgst;
        gds = 0.5 * beta * fSat * fSat * lam;
      }
      // body conductance: dId/dVbs = (dId/dVgst)·(−dVth/dVbs) = -gm·dVth_dVbs
      // (gm here is ∂Id/∂Vgs which equals ∂Id/∂Vgst since ∂Vgst/∂Vgs = 1.)
      gmb = -gm * dVth_dVbs;
      gds = Math.max(gds, 0) + ctx.opt.gmin;
      // If we ran in reverse mode (Vds < 0 in the original frame), transform the small-signal
      // model back into the original (non-swapped) coordinates so the stamp is correct.
      if (reverse) {
        // Swapped frame: Vgs_sw=Vgs_o−Vds_o, Vds_sw=−Vds_o, Vbs_sw=Vbs_o−Vds_o, Id_sw=−Id_o.
        // Chain-rule back to the original frame (all three swapped vars depend on Vds_o):
        //   ∂Id_o/∂Vgs_o = −gmF
        //   ∂Id_o/∂Vbs_o = −gmbF
        //   ∂Id_o/∂Vds_o = gmF + gdsF + gmbF   ← gmbF was previously dropped (body-effect
        //                   wrong for pass-gates / transmission gates where bulk ≠ source)
        const gmF = gm, gdsF = gds, gmbF = gmb;
        Id = -Id;
        gm = -gmF;
        gds = Math.max(gmF + gdsF + gmbF, 0) + ctx.opt.gmin;
        gmb = -gmbF;
        Vds = -Vds;                                       // Vds_sw → Vds_o
        Vgs = Vgs + Vds;                                  // Vgs_sw + Vds_o → Vgs_o
        Vbs = Vbs + Vds;                                  // Vbs_sw + Vds_o → Vbs_o  (was missing)
      }
      // Newton companion: Id ≈ Id0 + gm·(Vgs−Vgs0) + gds·(Vds−Vds0) + gmb·(Vbs−Vbs0)
      const Ieq = Id - gm * Vgs - gds * Vds - gmb * Vbs;
      // For PMOS, the physical current direction is reversed and the Vgs/Vds polarities are flipped - bake this into stamping
      const sD = isP ? s : d, sS = isP ? d : s;     // physical nodes for "drain"/"source" of NMOS-equiv
      stampG2(ctx, sD, sS, gds);
      // gm contribution: i_DS = gm·Vgs (Vgs in equivalent NMOS frame = sgn·(vg-vs))
      const gmEff = isP ? -gm : gm;
      if (sD >= 0 && g >= 0) ctx.G[sD][g] += gmEff;
      if (sD >= 0 && s >= 0) ctx.G[sD][s] -= gmEff;
      if (sS >= 0 && g >= 0) ctx.G[sS][g] -= gmEff;
      if (sS >= 0 && s >= 0) ctx.G[sS][s] += gmEff;
      // gmb contribution
      const gmbEff = isP ? -gmb : gmb;
      if (sD >= 0 && bn >= 0) ctx.G[sD][bn] += gmbEff;
      if (sD >= 0 && s >= 0) ctx.G[sD][s] -= gmbEff;
      if (sS >= 0 && bn >= 0) ctx.G[sS][bn] -= gmbEff;
      if (sS >= 0 && s >= 0) ctx.G[sS][s] += gmbEff;
      // Companion current source flowing sD→sS (NMOS-equivalent direction).
      // For PMOS, sD/sS are already swapped via the isP branch above, so Ieq's sign carries
      // the correct meaning in both cases - no extra sign flip.
      stampI2(ctx, sD, sS, Ieq);
      // ── Overlap + junction capacitances ────────────────────────────────────────────────
      // The VALUES are computed on every solve (including the h = 0 DC pre-solve .ac/.noise
      // linearise on) and cached; only the transient companion is gated on h > 0. Same contract
      // as the diode's `_Cj` and the BJT's `_Cje`/`_Cjc`.
      const Cgso = (mo.Cgso ?? 0) * mo.W, Cgdo = (mo.Cgdo ?? 0) * mo.W, Cgbo = (mo.Cgbo ?? 0) * mo.L;
      // Bulk junction capacitance. `Vfwd` is the FORWARD bias across the junction, exactly as in
      // the diode and BJT versions of this function: bulk-to-drain forward bias is V(B) − V(D).
      const jCap = (C0: number, Vfwd: number, Pb: number, Mj: number) => {
        if (C0 <= 0) return 0;
        const Vj = Math.max(Pb, 0.1);
        if (Vfwd < Vj * 0.5) return C0 / Math.pow(Math.max(1 - Vfwd / Vj, 1e-6), Mj);
        const F2 = Math.pow(0.5, 1 + Mj), F3 = 1 - 0.5 * (1 + Mj);
        return (C0 / F2) * (F3 + Mj * Vfwd / Vj);
      };
      const Pb = mo.Pb ?? 0.8, Mj = mo.Mj ?? 0.5;
      // These are the forward biases. They used to be passed to jCap NEGATED, which handed a
      // reverse-biased junction its own forward-bias branch: an NMOS with bulk at 0 V and drain
      // at +3 V (Vbd = −3 V, strongly reverse-biased, so Cbd should SHRINK to Cbd0/2.2) was
      // evaluated at +3 V and took the linear forward-bias extrapolation instead, roughly
      // quadrupling the drain junction capacitance. It also inverted the bias DEPENDENCE, so the
      // capacitance grew as the junction was reverse-biased harder — the opposite of the physics.
      const Vbd = (bn >= 0 ? ctx.x[bn] : 0) - (d >= 0 ? ctx.x[d] : 0);
      const Vbs2 = (bn >= 0 ? ctx.x[bn] : 0) - (s >= 0 ? ctx.x[s] : 0);
      const Cbd = jCap(mo.Cbd ?? 0, Vbd, Pb, Mj);
      const Cbs = jCap(mo.Cbs ?? 0, Vbs2, Pb, Mj);
      (el as any)._Cgs = Cgso; (el as any)._Cgd = Cgdo; (el as any)._Cgb = Cgbo;
      (el as any)._Cbd = Cbd; (el as any)._Cbs = Cbs;
      (el as unknown as { _jcaps?: unknown[] })._jcaps = [];
      if (ctx.h > 0 && isFinite(ctx.time)) {
        const jcapList = (el as unknown as { _jcaps: { key: string; na: number; nc: number; Geq: number; Ieq: number }[] })._jcaps;
        const stampCap = (a: number, c: number, C: number, key: string) => {
          if (C <= 0) return;
          const hist = ctx.dCaps.get(key) ?? { vPrev: (a >= 0 ? ctx.x[a] : 0) - (c >= 0 ? ctx.x[c] : 0), iPrev: 0, qPrev: 0 };
          const Geq = ctx.beStep ? C / ctx.h : (2 * C) / ctx.h;
          const Ieq = ctx.beStep ? -Geq * hist.vPrev : -(Geq * hist.vPrev + hist.iPrev);
          stampG2(ctx, a, c, Geq);
          stampI2(ctx, a, c, Ieq);
          // Record for the after-step history write-back. Without this, every junction cap
          // gets a fresh dCaps.get() miss next step → vPrev = current iterate → no charge
          // storage → Miller delay = 0, Cgs charge-share lost, BJT Cje/Cjc do nothing.
          jcapList.push({ key, na: a, nc: c, Geq, Ieq });
        };
        stampCap(g, s, Cgso, `Mgs:${el.name}`);
        stampCap(g, d, Cgdo, `Mgd:${el.name}`);
        stampCap(g, bn, Cgbo, `Mgb:${el.name}`);
        stampCap(bn, d, Cbd, `Mbd:${el.name}`);
        stampCap(bn, s, Cbs, `Mbs:${el.name}`);
      }
      (el as any)._Id = sgn * Id; (el as any)._gm = gm; (el as any)._gds = gds; (el as any)._gmb = gmb;
      (el as any)._Vgs = sgn * Vgs; (el as any)._Vds = sgn * Vds; (el as any)._Vbs = sgn * Vbs;
      // For the Inspector's op-point readout, stash Vth (in the original-frame sign) and the
      // operating region: 0=cutoff, 1=subthreshold, 2=triode, 3=saturation. Region detection is
      // PHYSICS-BASED: we look at the actual swapped (NMOS-equivalent) overdrive Vgs-Vth and Vds.
      //   • overdrive < -3·nVt          → cutoff (Id is negligibly small, gm/gds at the gmin floor)
      //   • |overdrive| <= 3·nVt         → subthreshold / weak inversion (current is exponential in Vgs)
      //   • overdrive > 3·nVt:
      //       VdsEq < overdrive·(1-ε)   → triode (linear region)
      //       else                        → saturation (channel pinched off)
      // The thresholds come from BSIM convention; 3·nVt ≈ 0.1 V is the textbook strong-inversion
      // boundary. We use values stamped against (kVgs, kVds in nlState) so this matches the
      // small-signal model the engine actually used.
      (el as any)._Vth = sgn * Vth;
      {
        const VgsEq = ctx.nlState.lastV[kVgs] ?? Vgs;
        const VdsEq = ctx.nlState.lastV[kVds] ?? Math.abs(Vds);
        const overdrive = VgsEq - Vth;
        const strong = 3 * nVt;
        let region: 0 | 1 | 2 | 3;
        if (overdrive < -strong) region = 0;          // cutoff
        else if (overdrive <= strong) region = 1;     // subthreshold / weak inversion
        else if (VdsEq < overdrive * (1 - 1e-3)) region = 2;  // triode
        else region = 3;                                       // saturation
        (el as any)._region = region;
      }
      break;
    }
    case "Q": { // BJT - SPICE3 Gummel-Poon-lite with forward+reverse Early voltage and Rb/Rc/Re parasitics
      ctx.nonlinHit = true;
      const m = el.model;
      const area = el.area && el.area > 0 ? el.area : 1;
      const isP = m.kind === "pnp";
      const T = ctx.opt.temp + 273.15, Tnom = (m.Tnom ?? 27) + 273.15;
      // temperature scaling
      const VtT = VT(ctx.opt.temp);
      const isT = m.Is * area * Math.pow(T / Tnom, (m.XTI ?? 3))
        * Math.exp(((T / Tnom - 1) * (m.Eg ?? 1.11)) / Math.max(VtT, 1e-30));
      const xtb = m.XTB ?? 0;
      const bfT = Math.max(m.Bf * Math.pow(T / Tnom, xtb), 1e-2);
      const brT = Math.max(Math.max(m.Br ?? 1, 0.01) * Math.pow(T / Tnom, xtb), 1e-3);
      // resolve external + (possibly internal) terminal nodes for Rb/Rc/Re
      const c = N(el.nC), b = N(el.nB), e = N(el.nE);
      const useRb = (m.Rb ?? 0) > 1e-9;
      const useRc = (m.Rc ?? 0) > 1e-9;
      const useRe = (m.Re ?? 0) > 1e-9;
      const bp = useRb ? ix.internal(`Qb:${el.name}`) : b;
      const cp = useRc ? ix.internal(`Qc:${el.name}`) : c;
      const ep = useRe ? ix.internal(`Qe:${el.name}`) : e;
      if (useRb) stampG2(ctx, b, bp, 1 / Math.max(m.Rb / area, 1e-9));
      if (useRc) stampG2(ctx, c, cp, 1 / Math.max(m.Rc / area, 1e-9));
      if (useRe) stampG2(ctx, e, ep, 1 / Math.max(m.Re / area, 1e-9));
      // junction voltages - work in NPN-equivalent (flip polarity for PNP)
      const sgn = isP ? -1 : 1;
      const vbp = bp >= 0 ? ctx.x[bp] : 0;
      const vcp = cp >= 0 ? ctx.x[cp] : 0;
      const vep = ep >= 0 ? ctx.x[ep] : 0;
      let Vbe = sgn * (vbp - vep);
      let Vbc = sgn * (vbp - vcp);
      // junction-voltage limiting to keep Newton stable
      const Nf = Math.max(m.Ne ?? 1, 0.5), Nr = Math.max(m.Nc ?? 1, 0.5);
      const VtF = Nf * VtT, VtR = Nr * VtT;
      const vcritF = VtF * Math.log(VtF / (Math.max(isT, 1e-30) * Math.SQRT2));
      const vcritR = VtR * Math.log(VtR / (Math.max(isT, 1e-30) * Math.SQRT2));
      const keyBE = `Q:${el.name}:BE`, keyBC = `Q:${el.name}:BC`;
      const VbeRaw = Vbe, VbcRaw = Vbc;
      Vbe = limitJunction(Vbe, ctx.nlState.lastV[keyBE] ?? 0, VtF, vcritF);
      Vbc = limitJunction(Vbc, ctx.nlState.lastV[keyBC] ?? 0, VtR, vcritR);
      ctx.nlState.lastV[keyBE] = Vbe; ctx.nlState.lastV[keyBC] = Vbc;
      // Same phantom-fixed-point guard as the diode/MOSFET - if the limiter clipped, keep iterating.
      if (Math.abs(Vbe - VbeRaw) > 1e-9 || Math.abs(Vbc - VbcRaw) > 1e-9) ctx.limitActive = true;
      // exponentials clamped to prevent overflow
      const exBE = Math.exp(Math.min(Vbe / VtF, 80));
      const exBC = Math.exp(Math.min(Vbc / VtR, 80));
      // SPICE3 Gummel-Poon (low-injection): qb = 1/(1 − Vbc/Vaf − Vbe/Var).
      // We use qbInv = (1 − Vbc/Vaf − Vbe/Var) directly - Ic_transport = qbInv·(ifor−irev).
      const Vaf = m.Vaf && m.Vaf > 0 ? m.Vaf : 1e15;
      const Var = m.Var && m.Var > 0 ? m.Var : 1e15;
      const qbInv = Math.max(1 - Vbc / Vaf - Vbe / Var, 0.1);
      const ifor = isT * (exBE - 1);
      const irev = isT * (exBC - 1);
      const IctPre = isT * (exBE - exBC);                 // transport current before Early correction
      const Ict = IctPre * qbInv;                          // Early-corrected transport current (C→E in NPN)
      const Ib = ifor / bfT + irev / brT;                  // base current (positive into B in NPN)
      const Ic = Ict - irev / brT;                          // collector terminal current
      // Partial derivatives at the current iterate (∂/∂Vbe and ∂/∂Vbc, all in NPN-equivalent frame).
      const gif = (isT / VtF) * exBE;                       // d(exBE)/dVbe · isT
      const gir = (isT / VtR) * exBC;
      const gpi = gif / bfT;                                 // ∂Ib/∂Vbe
      const gmu = gir / brT;                                 // ∂Ib/∂Vbc
      // ∂Ic/∂Vbe = qbInv·gif − IctPre/Var       (Var = reverse Early, normally ∞)
      // ∂Ic/∂Vbc = qbInv·(−gir) − IctPre/Vaf − gir/brT
      const gm = qbInv * gif - IctPre / Var;                 // transconductance
      const go = qbInv * gir + IctPre / Vaf + gir / brT;     // output conductance (positive: −∂Ic/∂Vbc)
      // Newton companions: linearized current = ∂(·)/∂Vbe·Vbe + ∂(·)/∂Vbc·Vbc + companion.
      const IbEq = Ib - gpi * Vbe - gmu * Vbc;
      const IcEq = Ic - gm  * Vbe + go  * Vbc;
      // KCL contributions to the b vector (RHS). "Current leaving X through device" - flip by sgn for PNP.
      const Ib_ext = sgn * IbEq, Ic_ext = sgn * IcEq;
      addB(ctx, bp, -Ib_ext);
      addB(ctx, cp, -Ic_ext);
      addB(ctx, ep,  Ib_ext + Ic_ext);   // KCL: −(Ib+Ic) at E
      // Conductance contributions - formulation-B (partial-derivative) stamping.
      // For PNP, derivatives w.r.t. external node voltages flip in pairs (sgn²=1), so the G stamps are identical.
      // Row B (current leaving B = Ib): ∂Ib/∂v(B)=gpi+gmu, ∂Ib/∂v(E)=−gpi, ∂Ib/∂v(C)=−gmu
      if (bp >= 0) {
        if (bp >= 0) ctx.G[bp][bp] += gpi + gmu;
        if (ep >= 0) ctx.G[bp][ep] -= gpi;
        if (cp >= 0) ctx.G[bp][cp] -= gmu;
      }
      // Row C: ∂Ic/∂v(B)=(gm−go), ∂Ic/∂v(E)=−gm, ∂Ic/∂v(C)=+go
      if (cp >= 0) {
        if (bp >= 0) ctx.G[cp][bp] += (gm - go);
        if (ep >= 0) ctx.G[cp][ep] -= gm;
        if (cp >= 0) ctx.G[cp][cp] += go;
      }
      // Row E: leaving E = −(Ib+Ic).  ∂/∂v(B) = −(gpi+gmu+gm−go); ∂/∂v(E) = +(gpi+gm); ∂/∂v(C) = +(gmu−go)
      if (ep >= 0) {
        if (bp >= 0) ctx.G[ep][bp] -= (gpi + gmu + gm - go);
        if (ep >= 0) ctx.G[ep][ep] += (gpi + gm);
        if (cp >= 0) ctx.G[ep][cp] += (gmu - go);
      }
      // Junction (depletion) capacitances AT THE CURRENT BIAS.
      //
      // Computed on EVERY solve — including the h = 0 DC pre-solve that .ac and .noise linearise
      // on — and cached, so the small-signal model gets the operating-point capacitance. Only the
      // transient companion (Geq/Ieq + history) stays gated on h > 0. This is the same contract
      // the diode's `_Cj` follows. Previously the whole block was inside the h > 0 gate, so .ac
      // fell back to the raw model card and stamped the ZERO-BIAS Cje/Cjc with no `area` scaling:
      // a reverse-biased collector junction was modelled far larger than it is (Cjc at −5 V is
      // ~2.4× smaller than Cjo), which moves every BJT amplifier's Miller pole and fT.
      const jCap = (C0: number, Vfwd: number, Vj: number, Mj: number) => {
        if (C0 <= 0) return 0;
        const Vjp = Math.max(Vj, 0.1);
        const FC = 0.5;
        if (Vfwd < FC * Vjp) return C0 / Math.pow(Math.max(1 - Vfwd / Vjp, 1e-6), Mj);
        const F2 = Math.pow(1 - FC, 1 + Mj), F3 = 1 - FC * (1 + Mj);
        return (C0 / F2) * (F3 + Mj * Vfwd / Vjp);
      };
      const Cje = jCap((m.Cje ?? 0) * area, Vbe, m.Vje ?? 0.75, m.Mje ?? 0.33);
      const Cjc = jCap((m.Cjc ?? 0) * area, Vbc, m.Vjc ?? 0.75, m.Mjc ?? 0.33);
      (el as any)._Cje = Cje; (el as any)._Cjc = Cjc;
      (el as unknown as { _jcaps?: unknown[] })._jcaps = [];
      if (ctx.h > 0 && isFinite(ctx.time)) {
        const jcapList = (el as unknown as { _jcaps: { key: string; na: number; nc: number; Geq: number; Ieq: number }[] })._jcaps;
        const stampCap = (a: number, c2: number, C: number, key: string) => {
          if (C <= 0) return;
          const hist = ctx.dCaps.get(key) ?? { vPrev: (a >= 0 ? ctx.x[a] : 0) - (c2 >= 0 ? ctx.x[c2] : 0), iPrev: 0, qPrev: 0 };
          const Geq = ctx.beStep ? C / ctx.h : (2 * C) / ctx.h;
          const Ieq2 = ctx.beStep ? -Geq * hist.vPrev : -(Geq * hist.vPrev + hist.iPrev);
          stampG2(ctx, a, c2, Geq);
          stampI2(ctx, a, c2, Ieq2);
          jcapList.push({ key, na: a, nc: c2, Geq, Ieq: Ieq2 });
        };
        stampCap(bp, ep, Cje, `Qbe:${el.name}`);
        stampCap(bp, cp, Cjc, `Qbc:${el.name}`);
      }
      (el as any)._Ic = sgn * Ic; (el as any)._Ib = sgn * Ib; (el as any)._Ie = -(sgn * Ic + sgn * Ib);
      (el as any)._gm = gm; (el as any)._gpi = gpi; (el as any)._go = go; (el as any)._gmu = gmu;
      (el as any)._Vbe = sgn * Vbe; (el as any)._Vbc = sgn * Vbc;
      // Operating region - PHYSICS-BASED, not a Vbe-threshold heuristic. A junction is "on" when
      // its forward transconductance is well above the gmin floor (i.e. the device is actually
      // injecting carriers, not just leaking thermal current). Using gpi for BE and gmu for BC:
      //   • gpi above gmin × 1e3 → BE junction is conducting
      //   • gmu above gmin × 1e3 → BC junction is conducting (= forward-biased BC)
      // The factor 1e3 puts the threshold at ~ten thermal-voltage drops below saturation, which
      // matches what every textbook calls "on" for a small-signal BJT.
      //   0 = cutoff (both junctions off), 1 = forward-active (BE on, BC off),
      //   2 = saturation (both on), 3 = reverse-active (BC on, BE off)
      {
        const floor = ctx.opt.gmin * 1e3;
        const beOn = gpi > floor;
        const bcOn = gmu > floor;
        (el as any)._region = beOn && bcOn ? 2 : beOn ? 1 : bcOn ? 3 : 0;
      }
      break;
    }
    case "B": {
      // Behavioral source - V={expr} stamps a branch (like a V source whose value depends on x);
      // I={expr} stamps a Norton companion (current from n1 to n2 of value expr). Both are
      // linearized at the current iterate using a finite-difference Jacobian computed by
      // src/lib/sim/bsource.ts. Compilation is cached on the element.
      ctx.nonlinHit = true;
      const cache = el as unknown as { _compiled?: CompiledBExpr | null; _compileErr?: string };
      if (cache._compiled === undefined) {
        const r = compileExpr(el.expr);
        if (r.compiled) { cache._compiled = r.compiled; }
        else { cache._compiled = null; cache._compileErr = r.error; }
      }
      const comp = cache._compiled;
      if (!comp) break;        // a SimError is surfaced by the netlister before we reach here
      // env: read node voltages / branch currents from the current iterate. I(name) tries the
      // MNA branch-key prefixes in turn - V/L/E/H/B all keep their current as an unknown column.
      const findBranchCol = (name: string): number | undefined => {
        for (const pre of ["V:", "L:", "E:", "H:", "B:"]) {
          const c = ctx.ix.branchOf.get(pre + name);
          if (c !== undefined) return ctx.ix.nNodes + c;
        }
        return undefined;
      };
      // I(name) lookup - handles every branch-element type:
      //   V/L/E/H/B   → direct MNA branch unknown (read from x at the branch column)
      //   F (CCCS)    → derived: gain · I(controlling Vsrc)
      //   G (VCCS)    → derived: gain · (v(nc1) - v(nc2))
      // For F/G the derived value has no branch unknown - Jacobian wrt the source's controlling
      // node IS captured because the FD perturbation in evalAndJacobian re-evaluates branchI()
      // through this same path, recomputing the derived current correctly under perturbed v's.
      const branchI = (src: string): number => {
        const col = findBranchCol(src);
        if (col !== undefined) return ctx.x[col];
        // No direct branch row - try F (CCCS) or G (VCCS). Explicit type predicate so TS
        // narrows `el` to the F|G union (Array.find with a plain boolean callback returns
        // NetlistElement | undefined, which would fail to expose .vsrc / .nc1 / .nc2).
        type FOrG = Extract<NetlistElement, { type: "F" | "G" }>;
        const el = ctx.els.find((e): e is FOrG => (e.type === "F" || e.type === "G") && e.name === src);
        if (!el) return 0;
        if (el.type === "F") {
          // F's current = gain × I(controlling Vsrc). Recurse via the same env so perturbations
          // (FD Jacobian) propagate naturally.
          const ctrlCol = findBranchCol(el.vsrc);
          return ctrlCol !== undefined ? el.gain * ctx.x[ctrlCol] : 0;
        }
        // VCCS: i = gain · (v(nc1) - v(nc2))
        const v1 = nodeV(ctx, el.nc1), v2 = nodeV(ctx, el.nc2);
        return el.gain * (v1 - v2);
      };
      const env = {
        time: ctx.time,
        nodeV: (name: string): number => nodeV(ctx, name),
        branchI,
      };
      const { value: f0, dV, dI } = evalAndJacobian(comp, env);
      // F/G chain-rule propagation. The bsource compiler can't know that "G1" is derived from
      // v(nc1)/v(nc2) (it only sees `I(G1)` in the AST), and `evalAndJacobian` only perturbs the
      // explicit `nodeRefs`/`branchRefs` - so dV doesn't naturally get a Jacobian entry for
      // a G's controlling nodes (or an F's controlling V branch). We stitch the missing entries
      // here using the closed-form derivatives:
      //   G:  I(G) = gain·(v(nc1) − v(nc2))   →   dI/dv(nc1) = +gain,   dI/dv(nc2) = −gain
      //   F:  I(F) = gain·I(Vctrl)             →   dI/d(i_Vctrl)  = +gain
      // With these in place, Newton sees the FULL Jacobian - convergence becomes proper Newton
      // (1 iter for a linear expression) instead of Picard fixed-point (converges but slowly,
      // and may oscillate on pathologically-nonlinear expressions).
      type FOrG = Extract<NetlistElement, { type: "F" | "G" }>;
      for (const src of comp.branchRefs) {
        const elFg = ctx.els.find((e): e is FOrG => (e.type === "F" || e.type === "G") && e.name === src);
        if (!elFg) continue;
        const jBranch = dI[src] ?? 0;
        if (elFg.type === "G") {
          dV[elFg.nc1] = (dV[elFg.nc1] ?? 0) + jBranch * elFg.gain;
          dV[elFg.nc2] = (dV[elFg.nc2] ?? 0) - jBranch * elFg.gain;
        } else {
          // F: dI propagates to the controlling V source's branch unknown.
          dI[elFg.vsrc] = (dI[elFg.vsrc] ?? 0) + jBranch * elFg.gain;
        }
      }
      const a = ctx.ix.node(el.n1), b = ctx.ix.node(el.n2);
      // RHS constant: f(x⁰) − Σ J_k · v(n_k⁰). Includes branch-current refs too.
      // Iterate ALL keys in dV/dI (not just the original nodeRefs/branchRefs) so the F/G
      // chain-rule-propagated entries above contribute to the companion.
      let companionConst = f0;
      for (const node in dV) companionConst -= dV[node] * nodeV(ctx, node);
      for (const src in dI) {
        const col = findBranchCol(src);
        const i0 = col !== undefined ? ctx.x[col] : 0;
        companionConst -= dI[src] * i0;
      }
      if (el.ctrl === "V") {
        // Branch row: v(n1) − v(n2) − Σ J_node · v(node) − Σ J_branch · i(branch) = companionConst
        // Iterate Object.keys(dV)/dI to include the chain-rule augmentations above.
        const brow = ctx.ix.branch(`B:${el.name}`);
        stampVbranch(ctx, a, b, brow, companionConst, (row) => {
          for (const node in dV) {
            const j = ctx.ix.node(node);
            if (j >= 0) ctx.G[row][j] -= dV[node];
          }
          for (const src in dI) {
            const col = findBranchCol(src);
            if (col !== undefined) ctx.G[row][col] -= dI[src];
          }
        });
      } else {
        // Current mode: i flows from n1 to n2 with value f(x). Stamp Norton companion + Jacobian
        // entries on rows {n1, n2} for every referenced unknown (incl. F/G chain-rule keys).
        stampI2(ctx, a, b, companionConst);
        for (const node in dV) {
          const j = ctx.ix.node(node);
          const g = dV[node];
          if (a >= 0 && j >= 0) ctx.G[a][j] += g;
          if (b >= 0 && j >= 0) ctx.G[b][j] -= g;
        }
        for (const src in dI) {
          const col = findBranchCol(src);
          if (col === undefined) continue;
          const g = dI[src];
          if (a >= 0) ctx.G[a][col] += g;
          if (b >= 0) ctx.G[b][col] -= g;
        }
      }
      (el as any)._value = f0;
      // Cache the Jacobian for AC reuse - re-evaluating at AC time would need a fresh DC
      // op-point, so we just freeze the small-signal model at the most-recent DC iterate.
      (el as any)._dV = dV; (el as any)._dI = dI;
      break;
    }
    case "S": case "W": {
      // ---- Voltage- (S) / current- (W) controlled switch ---------------------------------
      // An ideal switch + a diode + an inductor IS a buck converter, so this one element makes
      // the whole switching-converter family reachable. See types.ts SwitchModel and
      // switchGeometry() above for the hysteresis/smoothing contract.
      ctx.nonlinHit = true;
      const st: 0 | 1 = (el as unknown as { _swState?: 0 | 1 })._swState ?? 0;
      const geo = switchGeometry(el.model, el.type === "S", st);
      const a = N(el.n1), c = N(el.n2);
      // Control quantity at the current iterate.
      const cp = el.type === "S" ? N(el.nc1) : -1;
      const cq = el.type === "S" ? N(el.nc2) : -1;
      const ccol = el.type === "W" ? ix.branch(`V:${el.vsrc}`) : -1;
      let ctrl = el.type === "S"
        ? (cp >= 0 ? ctx.x[cp] : 0) - (cq >= 0 ? ctx.x[cq] : 0)
        : (ccol >= 0 ? ctx.x[ccol] : 0);
      // Newton limiting on the control quantity. The logistic spans ~8·w; letting one iteration
      // jump the whole transition is how a switch turns into a chattering oscillator that never
      // converges. Cap the per-iteration move at roughly one full transition width plus a
      // relative term so a large-signal gate drive still slews there in a handful of iterations.
      const skey = `SW:${el.name}`;
      const cOld = ctx.nlState.lastV[skey];
      if (cOld !== undefined) {
        const maxStep = 8 * geo.w + 0.25 * Math.abs(cOld);
        if (Math.abs(ctrl - cOld) > maxStep) {
          ctrl = cOld + Math.sign(ctrl - cOld) * maxStep;
          ctx.limitActive = true;
        }
      }
      ctx.nlState.lastV[skey] = ctrl;
      const { g, dgdc, s } = switchSense(geo, ctrl);
      const vs = (a >= 0 ? ctx.x[a] : 0) - (c >= 0 ? ctx.x[c] : 0);
      // i(n1→n2) = g(ctrl)·vs.  Companion:  i ≈ g·vs + gc·ctrl − gc·ctrl₀   with gc = (dg/dctrl)·vs
      const gc = dgdc * vs;
      stampG2(ctx, a, c, g);
      if (el.type === "S") {
        if (a >= 0 && cp >= 0) ctx.G[a][cp] += gc;
        if (a >= 0 && cq >= 0) ctx.G[a][cq] -= gc;
        if (c >= 0 && cp >= 0) ctx.G[c][cp] -= gc;
        if (c >= 0 && cq >= 0) ctx.G[c][cq] += gc;
      } else {
        if (a >= 0) ctx.G[a][ccol] += gc;
        if (c >= 0) ctx.G[c][ccol] -= gc;
      }
      stampI2(ctx, a, c, -gc * ctrl);
      (el as any)._g = g; (el as any)._s = s; (el as any)._vctrl = ctrl; (el as any)._gc = gc;
      (el as any)._i = g * vs; (el as any)._v = vs;
      break;
    }
    case "D2A": {
      // Digital output into the analog circuit: a Thevenin source (level v, output resistance
      // 1/g) stamped as its Norton equivalent. Both v and g are piecewise-linear in time (see
      // mixed.ts D2AWave), so a logic edge is a finite ramp, never a step.
      const w = d2aWaveOf(el);
      const lv = w ? w.at(ctx.time) : { v: el.vundef, g: 1 / Math.max(el.rout, 1e-6) };
      const na = N(el.n1), nb = N(el.n2);
      stampG2(ctx, na, nb, lv.g);
      stampI2(ctx, nb, na, lv.g * lv.v);
      (el as unknown as { _v?: number; _g?: number })._v = lv.v;
      (el as unknown as { _v?: number; _g?: number })._g = lv.g;
      break;
    }
    case "T": {
      // ── Ideal lossless transmission line — Branin's travelling-wave model ──────────────
      //
      // A line is not a lumped element and cannot be written as one: what leaves port 1 arrives
      // at port 2 exactly TD later, unchanged. Branin's insight is that this is EXACTLY a
      // resistor Z0 at each port in series with a source carrying the far end's state, delayed:
      //
      //     v1(t) − Z0·i1(t) = v2(t−TD) + Z0·i2(t−TD)
      //     v2(t) − Z0·i2(t) = v1(t−TD) + Z0·i1(t−TD)
      //
      // with i1, i2 the currents flowing INTO the line at each port. Before anything has had time
      // to reflect, each port simply sees Z0 — which is precisely why a matched line shows no
      // reflection at all, and why an unmatched one shows the staircase it does.
      //
      // Both port currents are branch unknowns, allocated unconditionally so the matrix has the
      // same size in DC, AC and transient.
      const b1 = ix.branch(`T1:${el.name}`), b2 = ix.branch(`T2:${el.name}`);
      const t1 = N(el.n1), t2 = N(el.n2), t3 = N(el.n3), t4 = N(el.n4);
      const z0 = Math.max(el.z0, 1e-6);
      const hist = (el as unknown as { _tlHist?: TLineHistory })._tlHist;
      // Which form to stamp is decided by the ANALYSIS CONTEXT, exactly as it is for every
      // other reactive element — not by whether a history object happens to exist. The history
      // is per-run state that the transient driver allocates and never tears down, so keying
      // off it alone meant any analysis that FOLLOWED a .tran on the same netlist (".tran"
      // then ".op", or a .ac whose DC pre-solve runs at time = NaN) took the Branin branch and
      // sampled the history at NaN − TD, poisoning the whole solve. Reproduced: a matched
      // 50 Ω line gives V(out) = 0.5 V for a standalone .op, and a non-converged result with
      // no node voltages at all for the same .op placed after a .tran.
      const tranCtx = ctx.h > 0 && isFinite(ctx.time);
      if (!hist || !tranCtx) {
        // Bias point (.op, .dc, the .ac pre-solve, or the pseudo-transient continuation): at DC
        // a lossless line is simply a pair of wires:
        // the two port voltages are equal, and whatever current goes in at one port comes out
        // at the other. Modelling it as "each port sees Z0" here would put a resistor in the DC
        // path that physically is not there, and quietly bias the whole circuit wrong.
        //
        // Written on the PORT currents (i1 into port 1, i2 into port 2) rather than as two
        // conductor-to-conductor shorts. The conductor form looks more literal but its second
        // branch row is EMPTY whenever both return conductors land on ground — which is the
        // normal way anyone wires a line — and an empty row is a singular matrix.
        //   row b1 :  (v1 − v2) − (v3 − v4) = 0
        //   row b2 :  i1 + i2 = 0
        if (t1 >= 0) { ctx.G[t1][b1] += 1; ctx.G[b1][t1] += 1; }
        if (t2 >= 0) { ctx.G[t2][b1] -= 1; ctx.G[b1][t2] -= 1; }
        if (t3 >= 0) { ctx.G[t3][b2] += 1; ctx.G[b1][t3] -= 1; }
        if (t4 >= 0) { ctx.G[t4][b2] -= 1; ctx.G[b1][t4] += 1; }
        ctx.G[b2][b1] += 1; ctx.G[b2][b2] += 1;
        break;
      }
      // Transient: the incident waves that left the FAR end one delay ago.
      const e1 = tlineSample(hist, 2, ctx.time - el.td);
      const e2 = tlineSample(hist, 1, ctx.time - el.td);
      stampVbranch(ctx, t1, t2, b1, e1, (row) => { ctx.G[row][b1] -= z0; });
      stampVbranch(ctx, t3, t4, b2, e2, (row) => { ctx.G[row][b2] -= z0; });
      break;
    }
    case "J": {
      // ── JFET — SPICE3 Shichman-Hodges channel + two real gate junctions ────────────────
      //
      // The gate of a JFET is a reverse-biased DIODE, and modelling it as one is the reason to
      // reach for this device at all: it is what clamps the input a diode drop above the channel
      // when the gate is driven positive, what sets the (tiny) input current, and what makes the
      // input capacitance bias-dependent. Treating the gate as an open circuit would reproduce
      // none of that while still producing confident-looking numbers.
      //
      // Channel, in the n-channel frame with Vds ≥ 0 (Vgst ≡ Vgs − Vto):
      //     triode      Vds < Vgst :  Id = β(1+λVds)·Vds·(2·Vgst − Vds)
      //     saturation  Vds ≥ Vgst :  Id = β(1+λVds)·Vgst²
      // The two agree in VALUE and in both partials at Vds = Vgst, so the Jacobian is continuous
      // through the knee — the property that keeps Newton from stalling on a device biased there.
      ctx.nonlinHit = true;
      const mo = el.model;
      const area = el.area && el.area > 0 ? el.area : 1;
      const isP = mo.kind === "pjf";
      const sgn = isP ? -1 : 1;
      const VtT = VT(ctx.opt.temp);

      // Ohmic drain/source resistance gets its own internal node, and only when it is non-zero —
      // an ideal JFET therefore adds no unknowns. Same contract as the BJT's Rb/Rc/Re.
      const dExt = N(el.nD), gN = N(el.nG), sExt = N(el.nS);
      const useRd = mo.Rd > 1e-9, useRs = mo.Rs > 1e-9;
      const dN = useRd ? ix.internal(`Jd:${el.name}`) : dExt;
      const sN = useRs ? ix.internal(`Js:${el.name}`) : sExt;
      if (useRd) stampG2(ctx, dExt, dN, 1 / Math.max(mo.Rd / area, 1e-9));
      if (useRs) stampG2(ctx, sExt, sN, 1 / Math.max(mo.Rs / area, 1e-9));

      const vdN = dN >= 0 ? ctx.x[dN] : 0, vgN = gN >= 0 ? ctx.x[gN] : 0, vsN = sN >= 0 ? ctx.x[sN] : 0;

      // ── gate junctions (G→S and G→D), limited exactly like the diode and BJT junctions ──
      const Nj = Math.max(mo.N, 0.5);
      const VtJ = Nj * VtT;
      const isJ = Math.max(mo.Is * area, 1e-30);
      const vcritJ = VtJ * Math.log(VtJ / (isJ * Math.SQRT2));
      const kGS = `J:${el.name}:GS`, kGD = `J:${el.name}:GD`;
      let Vgs_j = sgn * (vgN - vsN), Vgd_j = sgn * (vgN - vdN);
      const rawGS = Vgs_j, rawGD = Vgd_j;
      Vgs_j = limitJunction(Vgs_j, ctx.nlState.lastV[kGS] ?? 0, VtJ, vcritJ);
      Vgd_j = limitJunction(Vgd_j, ctx.nlState.lastV[kGD] ?? 0, VtJ, vcritJ);
      ctx.nlState.lastV[kGS] = Vgs_j; ctx.nlState.lastV[kGD] = Vgd_j;
      if (Math.abs(Vgs_j - rawGS) > 1e-9 || Math.abs(Vgd_j - rawGD) > 1e-9) ctx.limitActive = true;
      const exGS = Math.exp(Math.min(Vgs_j / VtJ, 80)), exGD = Math.exp(Math.min(Vgd_j / VtJ, 80));
      const Igs = isJ * (exGS - 1), Igd = isJ * (exGD - 1);
      const ggs = (isJ / VtJ) * exGS + ctx.opt.gmin, ggd = (isJ / VtJ) * exGD + ctx.opt.gmin;

      // ── channel ─────────────────────────────────────────────────────────────────────────
      // Built from the LIMITED junction voltages so channel and junctions are linearised about
      // the same point; Vds follows from their difference, which keeps the three consistent.
      let Vgs = Vgs_j;
      let Vds = Vgs_j - Vgd_j;                  // = sgn·(v(D) − v(S))
      // A JFET is symmetric: below zero Vds the physical source and drain exchange roles. Solve
      // the forward problem in the swapped frame, then map the small-signal model back.
      let reverse = false;
      if (Vds < 0) { reverse = true; Vgs = Vgd_j; Vds = -Vds; }

      // Temperature: β falls with mobility, and the pinch-off voltage drifts with the junction.
      const TkJ = ctx.opt.temp + 273.15, TnomKJ = (mo.Tnom ?? 27) + 273.15;
      const betaT = mo.Beta * area * Math.pow(TnomKJ / TkJ, 1.5);
      const VtoT = mo.Vto - sgn * 2.2e-3 * (TkJ - TnomKJ);
      const Vgst0 = Vgs - (isP ? -VtoT : VtoT);          // overdrive, n-channel frame

      // Smooth the cutoff knee. A hard max(0, Vgst) leaves gm = gds = 0 across a whole region,
      // and a Newton step that lands there has no gradient to climb back out on. softplus is
      // that max to within a thermal volt — which is also, physically, about where a real JFET's
      // subthreshold conduction lives.
      // Scale is 2·Vt, not Vt: the channel current is QUADRATIC in this smoothed overdrive, so
      // a scale of Vt would put the sub-pinch-off conduction on exp(2·Vgst/Vt) — a swing of
      // 29.8 mV/decade, half the ln(10)·kT/q thermionic limit that bounds any thermally
      // activated barrier. See the fuller derivation in the "M" stamp.
      const sSubJ = 2 * VtT;
      const eArgJ = Vgst0 / sSubJ;
      const Vgst = eArgJ > 60 ? Vgst0 : (eArgJ < -60 ? sSubJ * Math.exp(eArgJ) : sSubJ * Math.log1p(Math.exp(eArgJ)));
      const dVgst = 1 / (1 + Math.exp(-Math.max(Math.min(eArgJ, 60), -60)));   // d(softplus)/dVgst0

      const clmJ = 1 + mo.Lambda * Vds;
      let Id = 0, gm = 0, gds = 0;
      if (Vds < Vgst) {                                   // triode
        const P = Vds * (2 * Vgst - Vds);
        Id  = betaT * clmJ * P;
        gm  = betaT * clmJ * 2 * Vds * dVgst;
        gds = betaT * (mo.Lambda * P + clmJ * 2 * (Vgst - Vds));
      } else {                                            // saturation
        Id  = betaT * clmJ * Vgst * Vgst;
        gm  = betaT * clmJ * 2 * Vgst * dVgst;
        gds = betaT * mo.Lambda * Vgst * Vgst;
      }
      gds = Math.max(gds, 0) + ctx.opt.gmin;

      // Map the swapped frame back. In reverse Vgs_sw = Vgs_o − Vds_o and Vds_sw = −Vds_o, and
      // Id changes sign, so ∂Id_o/∂Vds_o picks up the gm term as well as gds.
      if (reverse) {
        const gmF = gm, gdsF = gds;
        Id = -Id;
        gm = -gmF;
        gds = Math.max(gmF + gdsF, 0) + ctx.opt.gmin;
        Vds = -Vds;
        Vgs = Vgs + Vds;
      }

      // ── stamp ───────────────────────────────────────────────────────────────────────────
      // Channel current runs D→S in the n-channel frame; for a p-channel part both the
      // controlling polarity and the current direction flip, which is one sign on gm and one on
      // the companion source.
      const pD = isP ? sN : dN, pS = isP ? dN : sN;
      stampG2(ctx, pD, pS, gds);
      const gmEffJ = isP ? -gm : gm;
      if (pD >= 0 && gN >= 0) ctx.G[pD][gN] += gmEffJ;
      if (pD >= 0 && sN >= 0) ctx.G[pD][sN] -= gmEffJ;
      if (pS >= 0 && gN >= 0) ctx.G[pS][gN] -= gmEffJ;
      if (pS >= 0 && sN >= 0) ctx.G[pS][sN] += gmEffJ;
      stampI2(ctx, pD, pS, Id - gm * Vgs - gds * Vds);

      // Gate junctions: ordinary diode companions from G to S and from G to D.
      stampG2(ctx, gN, sN, ggs);
      stampI2(ctx, gN, sN, sgn * (Igs - ggs * Vgs_j));
      stampG2(ctx, gN, dN, ggd);
      stampI2(ctx, gN, dN, sgn * (Igd - ggd * Vgd_j));

      // Gate-junction depletion capacitance, with the standard forward-bias linearisation above
      // Fc·Pb so C stays finite and differentiable when the gate is driven into conduction.
      // Evaluated on EVERY solve and cached, so .ac/.noise get the OPERATING-POINT capacitance —
      // the bias dependence IS the reason a JFET's input capacitance is worth modelling. (These
      // used to be computed only inside the h > 0 transient gate, and `_Cgs`/`_Cgd` were cached
      // as the raw ZERO-BIAS model values, so every JFET .ac saw Ciss at 0 V regardless of bias.)
      const PbJ = Math.max(mo.Pb, 0.1), FcJ = Math.min(Math.max(mo.Fc, 0), 0.95);
      const depl = (C0: number, Vj: number): number => {
        if (C0 <= 0) return 0;
        if (Vj < FcJ * PbJ) return C0 / Math.sqrt(Math.max(1 - Vj / PbJ, 1e-6));
        const f = Math.sqrt(1 - FcJ);
        return (C0 / f) * (1 + (Vj - FcJ * PbJ) / (2 * PbJ * (1 - FcJ)));
      };
      const CgsJ = depl(mo.Cgs * area, Vgs_j), CgdJ = depl(mo.Cgd * area, Vgd_j);
      // Junction capacitances (transient only), on the same history mechanism the MOSFET and
      // BJT caps use — without the write-back list there is no charge storage and the device has
      // no frequency response at all.
      (el as unknown as { _jcaps?: unknown[] })._jcaps = [];
      if (ctx.h > 0 && isFinite(ctx.time)) {
        const jcapList = (el as unknown as { _jcaps: { key: string; na: number; nc: number; Geq: number; Ieq: number }[] })._jcaps;
        const stampCapJ = (a: number, cc: number, C: number, key: string) => {
          if (C <= 0) return;
          const hist = ctx.dCaps.get(key) ?? { vPrev: (a >= 0 ? ctx.x[a] : 0) - (cc >= 0 ? ctx.x[cc] : 0), iPrev: 0, qPrev: 0 };
          const Geq = ctx.beStep ? C / ctx.h : (2 * C) / ctx.h;
          const IeqC = ctx.beStep ? -Geq * hist.vPrev : -(Geq * hist.vPrev + hist.iPrev);
          stampG2(ctx, a, cc, Geq);
          stampI2(ctx, a, cc, IeqC);
          jcapList.push({ key, na: a, nc: cc, Geq, Ieq: IeqC });
        };
        stampCapJ(gN, sN, CgsJ, `Jgs:${el.name}`);
        stampCapJ(gN, dN, CgdJ, `Jgd:${el.name}`);
      }

      {
        const e = el as unknown as Record<string, unknown>;
        e._Id = sgn * Id; e._gm = gm; e._gds = gds;
        e._Igs = sgn * Igs; e._Igd = sgn * Igd;
        e._Vgs = sgn * Vgs; e._Vds = sgn * Vds; e._Vto = VtoT;
        e._Cgs = CgsJ; e._Cgd = CgdJ;
        // The gate-junction conductances the AC/noise stamp needs. prepareSmallSignal reads
        // `_ggs`/`_ggd`, which were NEVER written, so it always fell back to O.gmin (1e-12 S) and
        // .ac modelled the JFET's gate as an open circuit — discarding both the gate leakage and
        // the diode clamp that are the reason to reach for a JFET in the first place.
        e._ggs = ggs; e._ggd = ggd;
        // 0 = cutoff, 1 = saturation (where a JFET amplifier lives), 2 = triode. Decided on the
        // same smoothed overdrive the stamp actually used, so the readout can never disagree
        // with the small-signal model that produced the numbers beside it.
        e._region = Vgst0 <= 0 ? 0 : (Math.abs(Vds) < Vgst ? 2 : 1);
      }
      break;
    }
    case "VDMOS": {
      // ---- Power MOSFET (LTspice VDMOS): channel + INTRINSIC body diode + nonlinear Cgd -----
      ctx.nonlinHit = true;
      const mo = el.model;
      const isP = mo.kind === "vdmos-p";
      const sgn = isP ? -1 : 1;
      const dE = N(el.nD), gE = N(el.nG), sE = N(el.nS);
      const useRd = mo.Rd > 1e-9, useRs = mo.Rs > 1e-9, useRg = mo.Rg > 1e-9;
      const d = useRd ? ix.internal(`VDd:${el.name}`) : dE;
      const sN = useRs ? ix.internal(`VDs:${el.name}`) : sE;
      const gN = useRg ? ix.internal(`VDg:${el.name}`) : gE;
      if (useRd) stampG2(ctx, dE, d, 1 / mo.Rd);
      if (useRs) stampG2(ctx, sE, sN, 1 / mo.Rs);
      if (useRg) stampG2(ctx, gE, gN, 1 / mo.Rg);
      if (mo.Rds > 0) stampG2(ctx, d, sN, 1 / mo.Rds);

      // ---- channel (Shichman-Hodges in Kp, no W/L, bulk tied to source ⇒ no body effect) ----
      const T = ctx.opt.temp + 273.15, Tnom = (mo.Tnom ?? 27) + 273.15;
      const KpT = mo.Kp * Math.pow(Tnom / T, 1.5);            // mobility falls with T ⇒ Rds(on) rises
      const VtoT = mo.Vto - sgn * 2.3e-3 * (T - Tnom);        // ~−2.3 mV/K on |Vth|
      const Vth = isP ? -VtoT : VtoT;                         // |Vth| in the NMOS-equivalent frame
      const vd = d >= 0 ? ctx.x[d] : 0, vg = gN >= 0 ? ctx.x[gN] : 0, vsx = sN >= 0 ? ctx.x[sN] : 0;
      let Vgs = sgn * (vg - vsx);
      let Vds = sgn * (vd - vsx);
      let reverse = false;
      if (Vds < 0) { reverse = true; Vgs = Vgs - Vds; Vds = -Vds; }   // source/drain swap
      // SPICE3-style limiting on the two controlling voltages (same rules as case "M").
      const kVds = `VD:${el.name}:Vds`, kVgs = `VD:${el.name}:Vgs`;
      const VdsOld = ctx.nlState.lastV[kVds] ?? Vds;
      const VgsOld = ctx.nlState.lastV[kVgs] ?? Vgs;
      const limVdsL = (vnew: number, vold: number): number => {
        if (vold >= 3.5) { if (vnew > vold) return Math.min(vnew, 3 * vold + 2); return vnew < 3.5 ? Math.max(vnew, 2) : vnew; }
        return vnew > vold ? Math.min(vnew, 4) : Math.max(vnew, -0.5);
      };
      const VthAbs = Math.abs(Vth);
      const limVgsL = (vnew: number, vold: number): number => {
        if (vold >= VthAbs && vnew >= VthAbs) { if (Math.abs(vnew - vold) > 2) return vold + Math.sign(vnew - vold) * 2; }
        else if (vold < VthAbs + 2 && vnew > VthAbs + 2) return VthAbs + 2;
        else if (vold > VthAbs - 0.5 && vnew < VthAbs - 0.5) return VthAbs - 0.5;
        return vnew;
      };
      const VdsL = limVdsL(Vds, VdsOld), VgsL = limVgsL(Vgs, VgsOld);
      if (Math.abs(VdsL - Vds) > 1e-9 || Math.abs(VgsL - Vgs) > 1e-9) ctx.limitActive = true;
      Vds = VdsL; Vgs = VgsL;
      ctx.nlState.lastV[kVds] = Vds; ctx.nlState.lastV[kVgs] = Vgs;
      const nVt = Math.max(mo.Nsubvt ?? 1.0, 1.0) * VT(ctx.opt.temp);
      const Vgst = Vgs - Vth;
      // Smooth max(0, Vgst): keeps Id, gm and gds continuous through threshold (subthreshold).
      // Scale is 2·n·Vt because Id ∝ f² — see the derivation in the "M" stamp above; n·Vt would
      // make the subthreshold swing exactly half the thermionic limit.
      const sSub = 2 * nVt;
      const eArg = Vgst / sSub;
      const fSat = eArg > 60 ? Vgst : (eArg < -60 ? sSub * Math.exp(eArg) : sSub * Math.log1p(Math.exp(eArg)));
      const dfSat = 1 / (1 + Math.exp(-Math.max(Math.min(eArg, 60), -60)));
      const lam = mo.Lambda;
      let Id = 0, gm = 0, gds = 0;
      if (Vds <= 0) { Id = 0; gm = 0; gds = ctx.opt.gmin; }
      else if (Vds < fSat) {                                   // triode
        const clm = 1 + lam * Vds;
        const Plin = fSat * Vds - 0.5 * Vds * Vds;
        Id = KpT * Plin * clm;
        gm = KpT * clm * Vds * dfSat;
        gds = KpT * ((fSat - Vds) * clm + Plin * lam);
      } else {                                                 // saturation
        Id = 0.5 * KpT * fSat * fSat * (1 + lam * Vds);
        gm = KpT * fSat * (1 + lam * Vds) * dfSat;
        gds = 0.5 * KpT * fSat * fSat * lam;
      }
      gds = Math.max(gds, 0) + ctx.opt.gmin;
      if (reverse) {
        const gmF = gm, gdsF = gds;
        Id = -Id; gm = -gmF; gds = Math.max(gmF + gdsF, 0) + ctx.opt.gmin;
        Vds = -Vds; Vgs = Vgs + Vds;
      }
      const IeqCh = Id - gm * Vgs - gds * Vds;
      const sD = isP ? sN : d, sS = isP ? d : sN;              // physical nodes of the NMOS-equivalent
      stampG2(ctx, sD, sS, gds);
      const gmEff = isP ? -gm : gm;
      if (sD >= 0 && gN >= 0) ctx.G[sD][gN] += gmEff;
      if (sD >= 0 && sN >= 0) ctx.G[sD][sN] -= gmEff;
      if (sS >= 0 && gN >= 0) ctx.G[sS][gN] -= gmEff;
      if (sS >= 0 && sN >= 0) ctx.G[sS][sN] += gmEff;
      stampI2(ctx, sD, sS, IeqCh);

      // ---- intrinsic body diode: anode = source, cathode = drain (n-channel) ---------------
      // NOT optional. In a synchronous buck the low-side FET's body diode carries the inductor
      // current during dead time; leaving it out silently changes the answer.
      const bm = mo.body;
      const VtB = bm.N * VT(ctx.opt.temp);
      const isB = bm.Is * Math.pow(T / ((bm.Tnom ?? 27) + 273.15), (bm.XTI ?? 3) / Math.max(bm.N, 1e-6))
        * Math.exp((((T / ((bm.Tnom ?? 27) + 273.15)) - 1) * (bm.Eg ?? 1.11)) / Math.max(VtB, 1e-30));
      const vcritB = VtB * Math.log(VtB / (Math.max(isB, 1e-30) * Math.SQRT2));
      const anodeExt = isP ? d : sN, cathodeExt = isP ? sN : d;
      const useRb = mo.Rb > 1e-9;
      const anode = useRb ? ix.internal(`VDb:${el.name}`) : anodeExt;
      if (useRb) stampG2(ctx, anodeExt, anode, 1 / mo.Rb);
      let vdi = (anode >= 0 ? ctx.x[anode] : 0) - (cathodeExt >= 0 ? ctx.x[cathodeExt] : 0);
      const vdiRaw = vdi;
      const bkey = `VDbd:${el.name}`;
      vdi = limitJunction(vdi, ctx.nlState.lastV[bkey] ?? vcritB, VtB, vcritB);
      const BvB = bm.Bv && bm.Bv > 0 ? bm.Bv : 0;
      if (BvB > 0) {
        const IbvB = Math.max(bm.Ibv ?? 1e-3, 1e-12);
        const vbrCrit = -BvB - VtB * Math.log(VtB / (Math.max(IbvB, 1e-30) * Math.SQRT2));
        const voldB = ctx.nlState.lastV[bkey] ?? vcritB;
        if (vdi < vbrCrit && Math.abs(vdi - voldB) > 2 * VtB) {
          if (voldB < -BvB) { const arg = 1 + (voldB - vdi) / VtB; vdi = arg > 0 ? voldB - VtB * Math.log(arg) : vbrCrit; }
          else vdi = Math.max(vdi, -BvB - 2 * VtB);
        }
      }
      ctx.nlState.lastV[bkey] = vdi;
      if (Math.abs(vdi - vdiRaw) > 1e-9) ctx.limitActive = true;
      const exB = Math.exp(Math.min(vdi / VtB, 80));
      let Idio = isB * (exB - 1);
      let gdio = (isB / VtB) * exB;
      if (BvB > 0) {
        const IbvB = Math.max(bm.Ibv ?? 1e-3, 1e-12);
        const exb2 = Math.exp(Math.min(-(vdi + BvB) / VtB, 80));
        Idio += -IbvB * exb2;
        gdio += (IbvB / VtB) * exb2;
      }
      gdio += ctx.opt.gmin;
      stampG2(ctx, anode, cathodeExt, gdio);
      stampI2(ctx, anode, cathodeExt, Idio - gdio * vdi);

      // ---- capacitances (transient only) --------------------------------------------------
      // Cgs constant; Cgd(Vgd) logistic between Cgdmax (drain low ⇒ channel accumulated under
      // the gate) and Cgdmin (drain high ⇒ that region depleted); body-diode junction cap Cjo.
      // The Cgd collapse is what makes the gate-charge plateau - and therefore the switching
      // loss - real rather than a straight RC.
      const Vgd = sgn * ((gN >= 0 ? ctx.x[gN] : 0) - (d >= 0 ? ctx.x[d] : 0));
      const aCgd = Math.max(mo.Cgda, 1e-6);
      const CgdV = mo.Cgdmin + (mo.Cgdmax - mo.Cgdmin) / (1 + Math.exp(-aCgd * Math.max(Math.min(Vgd, 200), -200)));
      let Cjb = 0;
      if ((bm.Cjo ?? 0) > 0) {
        const Vj = Math.max(bm.Vj ?? 0.7, 0.1), Mj = Math.max(Math.min(bm.M ?? 0.5, 0.95), 0.05), FC = 0.5;
        Cjb = vdi < FC * Vj
          ? bm.Cjo / Math.pow(Math.max(1 - vdi / Vj, 1e-6), Mj)
          : (bm.Cjo / Math.pow(1 - FC, 1 + Mj)) * (1 - FC * (1 + Mj) + (Mj * vdi) / Vj);
      }
      (el as unknown as { _jcaps?: unknown[] })._jcaps = [];
      if (ctx.h > 0 && isFinite(ctx.time)) {
        const jcapList = (el as unknown as { _jcaps: { key: string; na: number; nc: number; Geq: number; Ieq: number }[] })._jcaps;
        const stampCapV = (na: number, nc: number, C: number, key: string) => {
          if (C <= 0) return;
          const hist = ctx.dCaps.get(key) ?? { vPrev: (na >= 0 ? ctx.x[na] : 0) - (nc >= 0 ? ctx.x[nc] : 0), iPrev: 0, qPrev: 0 };
          const Geq = ctx.beStep ? C / ctx.h : (2 * C) / ctx.h;
          const Ieq = ctx.beStep ? -Geq * hist.vPrev : -(Geq * hist.vPrev + hist.iPrev);
          stampG2(ctx, na, nc, Geq);
          stampI2(ctx, na, nc, Ieq);
          jcapList.push({ key, na, nc, Geq, Ieq });
        };
        stampCapV(gN, sN, mo.Cgs, `VDcgs:${el.name}`);
        stampCapV(gN, d, CgdV, `VDcgd:${el.name}`);
        stampCapV(anode, cathodeExt, Cjb, `VDcj:${el.name}`);
      }
      (el as any)._Id = sgn * Id; (el as any)._gm = gm; (el as any)._gds = gds;
      (el as any)._Vgs = sgn * Vgs; (el as any)._Vds = sgn * Vds; (el as any)._Vth = sgn * Vth;
      (el as any)._Idiode = Idio; (el as any)._gdio = gdio; (el as any)._Vdiode = vdi;
      (el as any)._Cgd = CgdV; (el as any)._Cgs = mo.Cgs; (el as any)._Cj = Cjb;
      (el as any)._nD = d; (el as any)._nS = sN; (el as any)._nG = gN;
      (el as any)._nA = anode; (el as any)._nK = cathodeExt;
      {
        const overdrive = Vgs - Vth, strong = 3 * nVt;
        const VdsA = Math.abs(Vds);
        let region: 0 | 1 | 2 | 3;
        if (overdrive < -strong) region = 0;
        else if (overdrive <= strong) region = 1;
        else if (VdsA < overdrive * (1 - 1e-3)) region = 2;
        else region = 3;
        (el as any)._region = region;
      }
      break;
    }
  }
}

function buildSystem(ctx: StampCtx, els: NetlistElement[]) {
  ctx.els = els;
  const n = ctx.ix.size;
  ctx.G = Array.from({ length: n }, () => new Array(n).fill(0));
  ctx.b = new Array(n).fill(0);
  // gmin to ground on every node (also covers floating nodes)
  for (let i = 0; i < ctx.ix.nNodes; i++) ctx.G[i][i] += ctx.opt.gmin;
  ctx.nonlinHit = false;
  ctx.limitActive = false;
  for (const el of els) stampElement(ctx, el);
}

/** First pass: figure out how many branch unknowns we need by allocating them during a dry stamp. */
function precount(ix: Indexer, els: NetlistElement[], _transient: boolean) {
  for (const el of els) {
    if (el.type === "V") ix.branch(`V:${el.name}`);
    else if (el.type === "E") ix.branch(`E:${el.name}`);
    else if (el.type === "H") { ix.branch(`H:${el.name}`); ix.branch(`V:${el.vsrc}`); }
    else if (el.type === "F") ix.branch(`V:${el.vsrc}`);
    else if (el.type === "OPAMP") {
      ix.branch(`OP:${el.name}`);
      // pre-allocate the internal output node if rout > 0; matches the runtime stamp condition
      if (el.rout > 1e-3) ix.internal(`OPout:${el.name}`);
      // gm–C macromodel compensation node. Pre-allocated so the matrix size is identical
      // across .op/.ac/.tran (the stamp adds a gmin shunt when the macro is inactive, so
      // the node is never singular and .op/.ac stay numerically unchanged).
      ix.internal(`OPx:${el.name}`);
    }
    else if (el.type === "L") ix.branch(`L:${el.name}`); // always a branch unknown (short in DC, companion in tran)
    else if (el.type === "K") { ix.branch(`L:${el.l1}`); ix.branch(`L:${el.l2}`); }   // K couples two inductor branch unknowns
    else if (el.type === "C" && (el.esr ?? 0) > 0) ix.internal(`Cint:${el.name}`);    // ESR creates an internal node
    else if (el.type === "D" && (el.model?.Rs ?? 0) > 1e-9) ix.internal(`Dint:${el.name}`);
    else if (el.type === "Q") {
      // BJT internal nodes for Rb / Rc / Re (only allocated when parasitic > 0)
      if ((el.model?.Rb ?? 0) > 1e-9) ix.internal(`Qb:${el.name}`);
      if ((el.model?.Rc ?? 0) > 1e-9) ix.internal(`Qc:${el.name}`);
      if ((el.model?.Re ?? 0) > 1e-9) ix.internal(`Qe:${el.name}`);
    }
    else if (el.type === "B" && el.ctrl === "V") {
      // B-voltage adds a branch unknown like V/E/H - pre-allocate so matrix size is fixed.
      ix.branch(`B:${el.name}`);
    }
    // Current-controlled switch senses a V-source branch current, exactly like F/H.
    else if (el.type === "W") ix.branch(`V:${el.vsrc}`);
    else if (el.type === "T") {
      // Both port currents are unknowns in every analysis: DC stamps the line as two shorts
      // through them, transient and AC as Branin ports. Allocating unconditionally is what
      // keeps the matrix the same size across all three.
      ix.branch(`T1:${el.name}`); ix.branch(`T2:${el.name}`);
    }
    else if (el.type === "J") {
      // Ohmic drain/source nodes, allocated only when the resistance is non-zero — an ideal
      // JFET adds no unknowns at all.
      if (el.model.Rd > 1e-9) ix.internal(`Jd:${el.name}`);
      if (el.model.Rs > 1e-9) ix.internal(`Js:${el.name}`);
    }
    else if (el.type === "VDMOS") {
      // Prime nodes for the package/die parasitics and the body-diode series resistance. Only
      // allocated when the parameter is non-zero, so a lossless ideal VDMOS adds no unknowns.
      if (el.model.Rd > 1e-9) ix.internal(`VDd:${el.name}`);
      if (el.model.Rs > 1e-9) ix.internal(`VDs:${el.name}`);
      if (el.model.Rg > 1e-9) ix.internal(`VDg:${el.name}`);
      if (el.model.Rb > 1e-9) ix.internal(`VDb:${el.name}`);
    }
  }
}

/** Solve one DC point (with Newton if nonlinear). Returns the solution vector or null.
 *
 *  `dCaps` carries junction-cap history (diode Cj, MOSFET overlap/junction caps, BJT Cje/Cjc)
 *  ACROSS transient timesteps. Pass an empty map for .op/.dc/.ac; the caller (the transient
 *  loop) owns the per-step persistent map and reuses it through every solveDC call. Previously
 *  this was a fresh `new Map()` per call, which silently disabled charge storage on every
 *  nonlinear device - making MOSFET Miller delay, BJT τF, and diode reverse-recovery all wrong. */
export function solveDC(ix: Indexer, els: NetlistElement[], opt: SimOptions, time: number, h: number, beStep: boolean,
  caps: Map<string, { vPrev: number; iPrev: number }>, inds: Map<string, { iPrev: number; vPrev: number }>,
  x0: number[] | null,
  dCaps: Map<string, { vPrev: number; iPrev: number; qPrev: number }> = new Map(),
  diag?: ConvergenceDiag): { x: number[]; iters: number } | null {
  const ctx: StampCtx = {
    ix, G: [], b: [], x: x0 ? x0.slice() : new Array(ix.size).fill(0), opt, time, h, beStep, caps, inds,
    dCaps, nonlinHit: false, nlState: { lastV: {} }, els, limitActive: false,
  };
  const maxIter = opt.itl1;
  /** Gmin-stepping fallback. Order of attempts (matches SPICE3):
   *   attempt 0      → opt.gmin                       (the user's tight target)
   *   attempt 1..N   → 1e-3, 1e-4, …, opt.gmin        (loose → tight)
   *
   *  The original code initialized `tryGmins = [opt.gmin]` and on failure replaced it with
   *  [1e-3, 1e-4, …]. Because the `for(;;attempt++)` then made attempt=1, the index 0 (1e-3)
   *  was silently SKIPPED - the loosest pass was never actually tried. Now we put a sentinel
   *  at slot 0 so attempt 1 picks 1e-3 exactly. */
  const tightGmin = opt.gmin;
  const tryGmins = [tightGmin];
  // Tightest-gmin solution reached so far on the homotopy ramp. If a later (tighter)
  // step fails to converge we fall back to THIS rather than to null or to the loosest
  // - robust (never worse than the old behaviour) yet still orders of magnitude closer
  // to the true gmin→0 point than the old "return the first/loosest converged" bug.
  let best: { x: number[]; iters: number; gmin: number } | null = null;
  // Last few Newton iterates of the most recent attempt. Used ONLY by the failure diagnostic
  // (diagnoseNonConvergence) to name the device whose junction is chattering - a non-converged
  // run must say WHICH transistor is fighting, not "singular matrix".
  let hist: number[][] = [];
  let sawSingular = false;
  for (let attempt = 0; ; attempt++) {
    const curGmin = tryGmins[Math.min(attempt, tryGmins.length - 1)];
    ctx.opt = { ...opt, gmin: curGmin };
    let converged = false, iters = 0;
    const xPrev = ctx.x.slice();
    hist = [];
    for (let it = 0; it < maxIter; it++) {
      iters = it + 1;
      const before = ctx.x.slice();
      buildSystem(ctx, els);
      const sol = solveReal(ctx.G, ctx.b);
      if (!sol) { converged = false; sawSingular = true; break; }
      ctx.x = sol;
      hist.push(sol.slice());
      if (hist.length > 8) hist.shift();
      if (!ctx.nonlinHit) { converged = true; break; } // linear -> one solve is exact
      // convergence check
      let ok = true;
      for (let i = 0; i < ctx.ix.nNodes; i++) {
        if (Math.abs(ctx.x[i] - before[i]) > opt.reltol * Math.max(Math.abs(ctx.x[i]), Math.abs(before[i])) + opt.vntol) { ok = false; break; }
      }
      if (ok) { for (let i = ctx.ix.nNodes; i < ctx.ix.size && ok; i++) { if (Math.abs(ctx.x[i] - before[i]) > opt.reltol * Math.max(Math.abs(ctx.x[i]), Math.abs(before[i])) + opt.abstol) ok = false; } }
      // SPICE3 rule: if any device's junction-voltage limiter clipped this step, keep iterating
      // - otherwise we can converge to a "phantom fixed point" where the limited Vds ≠ the real Vds.
      if (ctx.limitActive) ok = false;
      if (ok) { converged = true; break; }
    }
    if (converged) {
      if (diag) diag.method = attempt === 0 ? "direct" : "gmin";
      // Homotopy correctness: a solution converged at a LOOSE gmin still carries a
      // (up to 1 kΩ/node) shunt and is NOT the physical operating point - it is only
      // a continuation waypoint. Accept it ONLY when we are at the tight target gmin;
      // otherwise keep ctx.x (the converged loose solution) as the warm-start seed and
      // proceed to the next, tighter gmin. The previous code returned the FIRST (hence
      // loosest) converging attempt with its gmin shunt baked into the reported answer
      // - a demonstrated ~0.06% (and on high-impedance nodes far larger) error.
      if (curGmin <= tightGmin * (1 + 1e-12)) {
        // FINAL RE-STAMP AT THE CONVERGED SOLUTION.
        //
        // Every device caches its small-signal parameters (_gd, _gm, _gds, _gmb, _Cj, _Id,
        // _region, …) as a side effect of being stamped, and .ac / .noise / the Inspector all
        // read those caches. But the loop above stamps at x^(k) and then RETURNS x^(k+1): the
        // caches were one Newton iterate behind the answer they describe. The convergence test
        // only bounds |x^(k+1) − x^(k)| by reltol·|x| + vntol, which on a 5.6 V node is ~5.6 mV
        // - and a junction's conductance goes like exp(v/Vt) with Vt ≈ 25.9 mV, so that turns
        // into a double-digit error in gd. Measured on a 5.6 V Zener shunt regulator: .ac
        // reported a small-signal gain of 5.2473e-3 where the converged truth is 5.8948e-3
        // (11 % out), and the discrepancy vanished as reltol was tightened - the signature of a
        // stale cache rather than a wrong formula.
        //
        // One extra stamp pass (no solve, no matrix factorisation) re-evaluates every device at
        // the solution actually being returned, so the cached model and the reported voltages
        // are the same operating point. It cannot change x.
        // Only nonlinear devices cache anything; a linear network is exact after one solve and
        // re-stamping it would be pure cost (this runs once per transient timestep).
        if (ctx.nonlinHit) { ctx.opt = opt; buildSystem(ctx, els); }
        return { x: ctx.x, iters };
      }
      best = { x: ctx.x.slice(), iters, gmin: curGmin }; // tightest converged waypoint
      continue; // advance to the next (tighter) gmin, seeded by this converged ctx.x
    }
    // Not converged at this gmin.
    if (attempt === 0) {
      // Build the loose→tight ramp. Slot 0 stays = the tight gmin already tried; then
      // 1e-3, 1e-4, … down to and INCLUDING exactly tightGmin (float division can stop
      // a hair above it, so append the exact target so the ramp always ends tight).
      tryGmins.length = 0;
      tryGmins.push(tightGmin);
      // The ramp's LOWER BOUND has to be strictly positive. `.options gmin=0` is legal SPICE and
      // makes `tightGmin` 0, at which point `g >= 0` never goes false: g underflows to exactly 0
      // after ~320 divisions and then `0 >= 0` holds forever while `0/10` stays 0 — an unbounded
      // push loop that hangs the tab (a browser simulator's worst failure mode) on any circuit
      // that does not converge on the first attempt. Floor the ramp at 1e-15 S, which is far
      // below any conductance in a real circuit, and still finish on the exact target below.
      const rampFloor = tightGmin > 0 ? tightGmin : 1e-15;
      for (let g = 1e-3; g >= rampFloor; g /= 10) tryGmins.push(g);
      if (tryGmins[tryGmins.length - 1] > tightGmin * (1 + 1e-12)) tryGmins.push(tightGmin);
      ctx.x = xPrev; // restart the ramp from the pre-attempt state
      continue;
    }
    // A homotopy step failed. Fall back to the TIGHTEST gmin we did converge at
    // (much closer to the true operating point than the loosest, and keeps high-
    // impedance / floating-node circuits - whose DC point legitimately needs a
    // residual gmin - solvable). Only truly give up if nothing ever converged.
    if (best) return { x: best.x, iters: best.iters };
    // ─── gmin-stepping exhausted: climb the rest of the continuation ladder ──────────────
    // Gmin-stepping alone fails on exactly the circuits students bring at 1 am - bandgaps,
    // latches, comparators, startup circuits - because their difficulty is high DC loop gain,
    // not a badly-conditioned matrix. The two standard SPICE continuations that DO rescue them
    // are source stepping and pseudo-transient (dynamic ramping). Both are DC-only: a transient
    // timestep already has the previous timepoint as a warm start and its own ÷4 retry ladder,
    // and re-entering here would change accepted-step timing on thousands of tested waveforms.
    const dcContext = h <= 0 && !isFinite(time);
    if (dcContext && !diag?.noContinuation) {
      if (diag) diag.attempts.push(`gmin stepping (${tryGmins.length} rungs) failed`);
      // Wall-clock budget for the whole ladder. A continuation that never terminates is a hung
      // browser tab, which is a worse failure than an honest "did not converge" - so both rungs
      // watch the same deadline and bail out cleanly rather than grinding.
      const deadline = now() + 1500;
      const src = sourceStepping(ix, els, opt, caps, inds, dCaps, deadline);
      if (src) {
        if (diag) { diag.method = "source-stepping"; diag.attempts.push("source stepping converged"); }
        return src;
      }
      if (diag) diag.attempts.push("source stepping failed");
      const pt = pseudoTransient(ix, els, opt, deadline);
      if (pt) {
        // The ramp gives a SEED, not an answer: the fictitious shunt capacitors are still in
        // the network at the last ramp point. Re-solve the true DC system from that seed.
        const fin = solveDC(ix, els, opt, NaN, 0, false, new Map(), new Map(), pt, new Map(),
          { method: "none", attempts: [], noContinuation: true });
        if (fin) {
          if (diag) { diag.method = "pseudo-transient"; diag.attempts.push("pseudo-transient ramp converged"); }
          return fin;
        }
      }
      if (diag) diag.attempts.push("pseudo-transient ramp failed");
    }
    if (diag) {
      diag.method = "none";
      diag.failure = diagnoseNonConvergence(ix, els, hist, sawSingular);
    }
    return null;
  }
}

/** Scratch passed into solveDC so the caller can learn HOW the DC point was reached (or why it
 *  wasn't). Purely diagnostic - it never changes the numerical result. */
export interface ConvergenceDiag {
  method: ConvergenceReport["method"];
  attempts: string[];
  failure?: { guilty?: ConvergenceReport["guilty"]; suggestion?: string; message: string };
  /** Set on recursive/inner solves to stop the continuation ladder from re-entering itself. */
  noContinuation?: boolean;
}

/** SOURCE STEPPING (λ-homotopy on the independent sources).
 *
 *  Scale every independent V/I source by λ and walk λ: 0 → 1, warm-starting each solve from the
 *  previous λ's solution. At λ=0 every source is dead and x=0 is the exact answer, so the
 *  continuation always has a valid starting point; each subsequent solve only has to track a
 *  small perturbation. λ is advanced adaptively (grow on success, quarter on failure) which is
 *  what makes it survive the sharp turn-on of a bandgap or a latch.
 *
 *  DC only: `dc` is the field the stamps read when time is NaN and h=0 (see case "V"/"I"), so
 *  scaling it is exactly equivalent to scaling the source. Restored in a finally. */
function sourceStepping(ix: Indexer, els: NetlistElement[], opt: SimOptions,
  caps: Map<string, { vPrev: number; iPrev: number }>, inds: Map<string, { iPrev: number; vPrev: number }>,
  dCaps: Map<string, { vPrev: number; iPrev: number; qPrev: number }>, deadline: number): { x: number[]; iters: number } | null {
  const srcs = els.filter((e): e is Extract<NetlistElement, { type: "V" | "I" }> => e.type === "V" || e.type === "I");
  if (srcs.length === 0) return null;                       // nothing to ramp - λ would be a no-op
  const orig = srcs.map(s => s.dc);
  const inner: ConvergenceDiag = { method: "none", attempts: [], noContinuation: true };
  // Each rung of the ramp is a SMALL perturbation of the last, so it should converge in a few
  // iterations; capping itl1 keeps a hopeless rung from burning the whole time budget.
  const optStep: SimOptions = { ...opt, itl1: Math.min(opt.itl1, 50) };
  let x: number[] = new Array(ix.size).fill(0);
  let lambda = 0, dl = 0.25, iters = 0;
  try {
    for (let guard = 0; guard < 120 && lambda < 1; guard++) {
      if (now() > deadline) return null;
      const lam = Math.min(1, lambda + dl);
      for (let i = 0; i < srcs.length; i++) srcs[i].dc = orig[i] * lam;
      const r = solveDC(ix, els, optStep, NaN, 0, false, caps, inds, x, dCaps, inner);
      if (r) {
        x = r.x; iters += r.iters; lambda = lam;
        dl = Math.min(dl * 1.6, 0.25);                      // re-accelerate, but never leap
      } else {
        dl /= 4;
        if (dl < 1e-4) return null;                          // the ramp is stuck - hand over
      }
    }
  } finally {
    for (let i = 0; i < srcs.length; i++) srcs[i].dc = orig[i];
  }
  if (lambda < 1) return null;
  // Final polish at full source strength with the ramp's answer as the seed.
  const fin = solveDC(ix, els, opt, NaN, 0, false, caps, inds, x, dCaps, inner);
  return fin ? { x: fin.x, iters: iters + fin.iters } : null;
}

/** PSEUDO-TRANSIENT / DYNAMIC RAMPING.
 *
 *  Hang a fictitious capacitor on every node and integrate the circuit forward in time with
 *  Backward Euler from the zero state, with the step size growing geometrically. Every step is
 *  an easy solve (the shunt C's C/h conductance dominates and makes the Jacobian diagonally
 *  strong), and as h → ∞ the shunts become open circuits, so the trajectory ends at the true DC
 *  operating point. This is the rung that rescues circuits with a genuine physical startup
 *  transient - bandgap references, latch-up-prone bias chains, oscillator bias points - because
 *  it follows the same path the real hardware takes at power-on.
 *
 *  Returns a SEED (the caller must re-solve the true DC system from it), never an answer: the
 *  last ramp point still contains the fictitious capacitors. */
function pseudoTransient(ix: Indexer, els: NetlistElement[], opt: SimOptions, deadline: number): number[] | null {
  const CSHUNT = 1e-9;
  // Sources are held at their DC values for the whole ramp: a PULSE/SIN spec would otherwise
  // make the "operating point" a snapshot of an arbitrary waveform sample.
  const els2: NetlistElement[] = els.map(e =>
    (e.type === "V" || e.type === "I") && e.tran ? { ...e, tran: undefined } : e);
  let k = 0;
  for (const [name, i] of ix.nodeIndex) {
    if (i < 0) continue;   // ground
    els2.push({ type: "C", name: `__ptran${k++}`, n1: name, n2: "0", value: CSHUNT });
  }
  if (k === 0) return null;
  // Op-amp transient state must be saved/restored: the ramp WILL write _vOutPrev/_vxPrev, and a
  // stale value there biases the slew clamp on the first step of a later real .tran.
  const opState = els.filter(e => e.type === "OPAMP").map(e => {
    const s = e as unknown as { _vOutPrev?: number; _vxPrev?: number };
    return { s, vo: s._vOutPrev, vx: s._vxPrev };
  });
  const inner: ConvergenceDiag = { method: "none", attempts: [], noContinuation: true };
  const optStep: SimOptions = { ...opt, itl1: Math.min(opt.itl1, 50) };
  const caps = new Map<string, { vPrev: number; iPrev: number }>();
  const inds = new Map<string, { iPrev: number; vPrev: number }>();
  const dCaps = new Map<string, { vPrev: number; iPrev: number; qPrev: number }>();
  let x = new Array(ix.size).fill(0);
  let t = 0, h = 1e-12, settled = 0;
  try {
    for (let step = 0; step < 400; step++) {
      if (now() > deadline) return step > 30 ? x : null;
      const r = solveDC(ix, els2, optStep, t + h, h, true, caps, inds, x, dCaps, inner);
      if (!r) {
        h /= 4;
        if (h < 1e-18) return null;
        continue;
      }
      let dx = 0;
      for (let i = 0; i < ix.nNodes; i++) dx = Math.max(dx, Math.abs(r.x[i] - x[i]));
      updateReactiveHistory(ix, els2, r.x, caps, inds, h, true, dCaps);
      x = r.x; t += h; h *= 1.8;
      // "Settled" = several consecutive steps with no movement, and only once the step size has
      // grown well past the fictitious time constants. Requiring `step > 30` (h has grown by
      // 1.8^30 ≈ 1e7 from h0) stops us from mistaking the initial flat crawl - where h ≪ τ so
      // nothing has moved YET - for steady state and returning the zero state as the answer.
      if (dx < 10 * opt.vntol && step > 30) settled++; else settled = 0;
      if (settled >= 3) return x;
    }
  } finally {
    for (const o of opState) { o.s._vOutPrev = o.vo; o.s._vxPrev = o.vx; }
  }
  return x;   // ran out of ramp steps - still a far better seed than zeros
}

/** Name the device that is preventing convergence.
 *
 *  Newton non-convergence in a real circuit is almost always ONE device chattering between two
 *  regions (a BJT flipping cutoff↔saturation, a diode snapping on/off, a MOSFET crossing Vth).
 *  We look at the swing of each device's junction voltages across the last Newton iterates and
 *  name the worst offender, then suggest a `.nodeset` that breaks the tie. "Singular matrix"
 *  tells a student nothing; "Q3's B-E junction is oscillating" tells them where to look. */
function diagnoseNonConvergence(ix: Indexer, els: NetlistElement[], hist: number[][], sawSingular: boolean):
  { guilty?: ConvergenceReport["guilty"]; suggestion?: string; message: string } {
  const nameOfRow = new Map<number, string>();
  for (const [n, i] of ix.nodeIndex) if (i >= 0 && !nameOfRow.has(i)) nameOfRow.set(i, n);
  const V = (row: number, k: number) => (row < 0 ? 0 : hist[k][row]);
  // swing of (v(a) - v(b)) across the recorded iterates
  const swing = (a: number, b: number): { lo: number; hi: number; d: number } => {
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < hist.length; k++) { const v = V(a, k) - V(b, k); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    return { lo, hi, d: hi - lo };
  };
  if (hist.length >= 2) {
    type Cand = { component: string; detail: string; node?: string; swing: number; seedNode?: string; seedVal?: number };
    const cands: Cand[] = [];
    const consider = (c: Cand) => { cands.push(c); };
    const N = (s: string) => ix.node(s);
    /** The node's own median iterate - an OBSERVED value, so a suggested .nodeset built from it
     *  is never a number we made up. Used unless the junction is chattering across its knee, in
     *  which case the textbook turn-on voltage is the more useful branch selector. */
    const medianAt = (row: number): number => {
      if (row < 0) return 0;
      const vs = hist.map(h => h[row]).sort((a, b) => a - b);
      return vs[Math.floor(vs.length / 2)];
    };
    /** True when the swing straddles a pn junction's turn-on knee - i.e. the device really is
     *  flipping between cutoff and conduction, rather than just wobbling in one region. */
    const crossesKnee = (lo: number, hi: number) => lo < 0.35 && hi > 0.5;
    for (const el of els) {
      if (el.type === "D") {
        const s = swing(N(el.nA), N(el.nK));
        const flips = crossesKnee(s.lo, s.hi);
        if (s.d > 0.05) consider({
          component: el.name, swing: s.d, node: el.nA,
          detail: `${el.name}'s junction is ${flips ? "snapping between off and conducting" : "oscillating"} (V(anode,cathode) swinging ${s.lo.toFixed(3)} V → ${s.hi.toFixed(3)} V over the last ${hist.length} Newton iterations)`,
          seedNode: el.nA, seedVal: flips ? medianAt(N(el.nK)) + 0.65 : medianAt(N(el.nA)),
        });
      } else if (el.type === "Q") {
        const be = swing(N(el.nB), N(el.nE));
        const bc = swing(N(el.nB), N(el.nC));
        const isP = el.model.kind === "pnp";
        if (be.d >= bc.d && be.d > 0.05) consider({
          component: el.name, swing: be.d, node: el.nB,
          detail: `${el.name}'s B-E junction is ${crossesKnee(isP ? -be.hi : be.lo, isP ? -be.lo : be.hi) ? "oscillating between cutoff and conduction" : "oscillating"} (V(be) swinging ${be.lo.toFixed(3)} V → ${be.hi.toFixed(3)} V over the last ${hist.length} Newton iterations)`,
          seedNode: el.nB, seedVal: medianAt(N(el.nE)) + (isP ? -0.65 : 0.65),
        });
        else if (bc.d > 0.05) consider({
          component: el.name, swing: bc.d, node: el.nC,
          detail: `${el.name}'s B-C junction is oscillating between forward-active and saturation (V(bc) swinging ${bc.lo.toFixed(3)} V → ${bc.hi.toFixed(3)} V over the last ${hist.length} Newton iterations)`,
          seedNode: el.nC,
        });
      } else if (el.type === "M") {
        const gs = swing(N(el.nG), N(el.nS));
        const ds = swing(N(el.nD), N(el.nS));
        const s = gs.d >= ds.d ? gs : ds;
        const which = gs.d >= ds.d ? "gate-source" : "drain-source";
        if (s.d > 0.05) consider({
          component: el.name, swing: s.d, node: gs.d >= ds.d ? el.nG : el.nD,
          detail: `${el.name} is flipping between operating regions (V(${which}) swinging ${s.lo.toFixed(3)} V → ${s.hi.toFixed(3)} V over the last ${hist.length} Newton iterations)`,
          seedNode: gs.d >= ds.d ? el.nG : el.nD,
        });
      }
    }
    cands.sort((a, b) => b.swing - a.swing);
    if (cands.length > 0) {
      const w = cands[0];
      const seedV = w.seedVal != null && isFinite(w.seedVal) ? w.seedVal
        : (w.seedNode ? (hist[hist.length - 1][Math.max(N(w.seedNode), 0)] ?? 0) : 0);
      const suggestion = w.seedNode && N(w.seedNode) >= 0 ? `.nodeset V(${w.seedNode})=${seedV.toPrecision(3)}` : undefined;
      return {
        guilty: { component: w.component, detail: w.detail, node: w.node, swing: w.swing },
        suggestion,
        message: `DC operating point did not converge: ${w.detail}.` +
          (suggestion ? ` Give the solver a starting branch with "${suggestion}" (a .nodeset is an initial guess, not a constraint - it does not change the answer, only which solution Newton walks to).` : ""),
      };
    }
  }
  if (sawSingular) {
    // A structurally singular matrix: some node has no DC path to ground, or two ideal voltage
    // sources are in a loop. Name the most likely node so the user has somewhere to click.
    const floating: string[] = [];
    const degree = new Map<number, number>();
    const bump = (r: number) => { if (r >= 0) degree.set(r, (degree.get(r) ?? 0) + 1); };
    for (const el of els) for (const key of ["n1", "n2", "nA", "nK", "nC", "nB", "nE", "nD", "nG", "nS", "nOut", "nInP", "nInN"]) {
      const nm = (el as unknown as Record<string, string>)[key];
      if (typeof nm === "string") bump(ix.node(nm));
    }
    for (const [row, name] of nameOfRow) if ((degree.get(row) ?? 0) <= 1) floating.push(name);
    const msg = floating.length
      ? `The DC matrix is singular: node(s) ${floating.slice(0, 4).join(", ")} have no complete DC path to ground. Add a resistor to ground there (or a .nodeset), and check for a loop of ideal voltage sources.`
      : "The DC matrix is singular - typically a loop of ideal voltage sources/inductors, or a node with no DC path to ground.";
    return { message: msg };
  }
  return { message: "DC operating point did not converge, and no single device could be identified as the cause. Try .options itl1=500, a .nodeset on the bias nodes, or check for a floating node." };
}

/** Build a full ConvergenceReport from the diag scratch. */
function reportOf(diag: ConvergenceDiag, converged: boolean): ConvergenceReport {
  return {
    converged,
    method: diag.method,
    attempts: diag.attempts.slice(),
    guilty: diag.failure?.guilty,
    suggestion: diag.failure?.suggestion,
    message: converged
      ? (diag.method === "direct" ? "DC operating point converged."
        : `DC operating point converged via ${diag.method}.`)
      : (diag.failure?.message ?? "DC operating point did not converge."),
  };
}

// ---------- public: simulate a netlist ----------
export function simulate(nl: Netlist, opt: Partial<SimOptions> = {}): SimResult[] {
  // Layered precedence (lowest → highest):
  //   1. DEFAULT_OPTIONS  - engine defaults
  //   2. nl.options        - `.options` directive from the schematic
  //   3. opt               - caller-provided overrides (highest priority)
  // This lets a user tune convergence from the Directives pane without code changes, while
  // still letting test scripts force tight tolerances when needed.
  const O: SimOptions = { ...DEFAULT_OPTIONS, ...(nl.options ?? {}), ...opt };
  const analyses = nl.analyses.length ? nl.analyses : [{ kind: "op" } as Analysis];

  // ─── .step PARAM driver ──────────────────────────────────────────────────────
  // If the netlist carries a step spec, run each analysis once per swept value and merge the
  // per-step signals into a single SimResult per analysis - signal names are suffixed with
  // `[<REFDES>=<value>]` so the WaveformDock can overlay every curve on one canvas.
  const steps = nl.steps && nl.steps.length ? nl.steps : (nl.step ? [nl.step] : null);
  if (steps) {
    return runWithSteps(nl, steps, analyses, O);
  }

  const results: SimResult[] = [];
  for (const a of analyses) {
    try { results.push(runAnalysis(nl, a, O)); }
    catch (e: any) {
      results.push({ analysis: a, title: titleOf(a), sweepName: "", sweepUnit: "", sweep: [], complex: false, signals: {}, units: {}, log: [], errors: [{ severity: "error", message: String(e?.message || e) }], converged: false, stats: { matrixSize: 0, points: 0, timeMs: 0 } });
    }
  }
  return results;
}

/** Run every analysis once per point of the (possibly nested) `.step` sweep, merging the
 *  per-step traces into a single SimResult per analysis. Signal keys get one suffix per axis so
 *  the dock can plot them as separate series - `V(out)[R1=1k]`, `V(out)[R1=1k][temp=85]`.
 *
 *  Three kinds of axis are supported (see StepSpec):
 *    • device - rewrite a component's `value` (passives) or `dc` (sources)
 *    • param  - rewrite EVERY element value that was resolved from that `.param`
 *    • temp   - rewrite SimOptions.temp, which every temperature-dependent device model already
 *               consumes (resistor TC1/TC2, diode Is(T), MOSFET Vto(T)/Kp(T), BJT Is(T)/Bf(T))
 *
 *  Nesting is limited to 2 axes by the parser. Every axis is restored in a `finally` so a
 *  swept netlist is never left mutated - a later re-run must see the user's original values. */
function runWithSteps(nl: Netlist, steps: StepSpec[], analyses: Analysis[], O: SimOptions): SimResult[] {
  const bail = (msg: string): SimResult[] => analyses.map((a) => ({
    analysis: a, title: titleOf(a), sweepName: "", sweepUnit: "", sweep: [], complex: false,
    signals: {}, units: {}, log: [], errors: [{ severity: "error", message: msg } as SimError],
    converged: false, stats: { matrixSize: 0, points: 0, timeMs: 0 },
  }));

  // ─── resolve each axis into an applicator ────────────────────────────────────────────────
  type Axis = { spec: StepSpec; apply: (v: number) => void; tempAxis: boolean; restore: () => void };
  const axes: Axis[] = [];
  const restores: (() => void)[] = [];
  for (const spec of steps) {
    // Defensive: a NaN/Infinity value would make the analysis silently produce garbage. The
    // parser already filters these, but a caller building a Netlist by hand might not.
    let values = (spec.values ?? []).filter((v) => isFinite(v));
    if (values.length === 0) {
      // Legacy shape: `{ refdes, start, stop, step }` with no expanded `values` (hand-built
      // netlists and anything serialized before the .step rebuild). Expand the linear triple
      // here so those callers keep working exactly as they did.
      const { start, stop, step } = spec;
      if (isFinite(start) && isFinite(stop) && isFinite(step) && step > 0 && stop >= start) {
        for (let v = start; v <= stop + step * 1e-9 && values.length < 1024; v += step) values.push(parseFloat(v.toPrecision(12)));
      }
    }
    // Still nothing usable (NaN range, non-positive increment): return NO results rather than a
    // fabricated single point - the caller's spec is unusable and saying so loudly is the job.
    if (values.length < 1) return [];
    if (spec.what === "temp") {
      axes.push({ spec: { ...spec, values }, tempAxis: true, apply: () => { /* handled per-run */ }, restore: () => {} });
      continue;
    }
    if (spec.what === "param") {
      // Every element whose value came from this .param (netlist.ts records the bindings).
      const binds = (nl.paramBindings ?? []).filter((b) => b.param.toLowerCase() === spec.refdes.toLowerCase());
      if (binds.length === 0) {
        return bail(`.step param ${spec.refdes}: no component value references {${spec.refdes}}. Add a ".param ${spec.refdes}=<value>" and set a component's value to "{${spec.refdes}}".`);
      }
      const targets: { el: Record<string, number>; field: string; orig: number }[] = [];
      for (const b of binds) {
        const el = nl.elements.find((e) => "name" in e && e.name.toLowerCase() === b.refdes.toLowerCase()) as unknown as Record<string, number> | undefined;
        if (!el || typeof el[b.field] !== "number") continue;
        targets.push({ el, field: b.field, orig: el[b.field] });
      }
      if (targets.length === 0) return bail(`.step param ${spec.refdes}: the bound components are no longer in the netlist.`);
      axes.push({
        spec: { ...spec, values }, tempAxis: false,
        apply: (v) => { for (const t of targets) t.el[t.field] = v; },
        restore: () => { for (const t of targets) t.el[t.field] = t.orig; },
      });
      continue;
    }
    // device
    const target = nl.elements.find((e) => "name" in e && e.name.toLowerCase() === spec.refdes.toLowerCase()) as
      { value?: number; dc?: number } | undefined;
    if (!target) return bail(`.step: could not resolve "${spec.refdes}".`);
    // Passives carry `.value`; sources carry `.dc`. Both are sweepable.
    const field: "value" | "dc" | null = typeof target.value === "number" ? "value" : typeof target.dc === "number" ? "dc" : null;
    if (!field) return bail(`.step: "${spec.refdes}" has no numeric value/dc to sweep.`);
    const rec = target as unknown as Record<string, number>;
    const orig = rec[field];
    axes.push({
      spec: { ...spec, values }, tempAxis: false,
      apply: (v) => { rec[field] = v; },
      restore: () => { rec[field] = orig; },
    });
  }
  for (const ax of axes) restores.push(ax.restore);

  // ─── build the point list (cartesian product, outer axis slowest) ────────────────────────
  // Cap the TOTAL number of simulated points so a typo (".step R1 0 1 0.0001" nested inside
  // another sweep) can't freeze the tab. We truncate rather than refuse, and say so.
  const MAX_POINTS = 256;
  let combos: number[][] = [[]];
  for (const ax of axes) {
    const next: number[][] = [];
    for (const c of combos) for (const v of ax.spec.values) next.push([...c, v]);
    combos = next;
  }
  const capped = combos.length > MAX_POINTS;
  const requested = combos.length;
  if (capped) combos = combos.slice(0, MAX_POINTS);
  if (combos.length === 0) return bail(".step: sweep produced no points.");

  // ─── per-analysis accumulators ───────────────────────────────────────────────────────────
  type Accum = { sweep: number[]; signals: Record<string, number[]>; csignals: Record<string, Complex[]>; units: Record<string, string>; converged: boolean; complex: boolean; errors: SimError[]; t0: number; digital?: SimResult["digital"] };
  const accs: Accum[] = analyses.map(() => ({ sweep: [], signals: {}, csignals: {}, units: {}, converged: true, complex: false, errors: [], t0: now() }));
  try {
    for (const combo of combos) {
      let Orun = O;
      let suffix = "";
      for (let k = 0; k < axes.length; k++) {
        const ax = axes[k], v = combo[k];
        if (ax.tempAxis) Orun = { ...Orun, temp: v };
        else ax.apply(v);
        suffix += `[${ax.spec.refdes}=${formatStepValue(v)}]`;
      }
      const label = axes.map((ax, k) => `${ax.spec.refdes}=${formatStepValue(combo[k])}`).join(", ");
      for (let i = 0; i < analyses.length; i++) {
        const acc = accs[i];
        try {
          const r = runAnalysis(nl, analyses[i], Orun);
          // First successful step seeds sweep + units; subsequent steps just push their per-trace
          // arrays under suffixed keys.
          if (acc.sweep.length === 0 && r.sweep.length > 0) { acc.sweep = r.sweep; acc.complex = r.complex; }
          // Digital histories are kept for the first point of the sweep: they share no time grid
          // with the merged analog family, and the first point is what the canvas shows.
          if (!acc.digital && r.digital) acc.digital = r.digital;
          for (const [k, arr] of Object.entries(r.signals)) {
            if (k === "V(0)") continue;
            acc.signals[`${k}${suffix}`] = arr;
            acc.units[`${k}${suffix}`] = r.units[k] ?? "";
          }
          if (r.csignals) {
            for (const [k, arr] of Object.entries(r.csignals)) {
              if (k === "V(0)") continue;
              acc.csignals[`${k}${suffix}`] = arr;
              acc.units[`${k}${suffix}`] = r.units[k] ?? "";
            }
          }
          if (!r.converged) acc.converged = false;
          if (r.errors.length) acc.errors.push({ severity: "warning", message: `${label}: ${r.errors[0].message}` });
        } catch (e: any) {
          acc.errors.push({ severity: "error", message: `${label}: ${String(e?.message || e)}` });
          acc.converged = false;
        }
      }
    }
  } finally {
    // ALWAYS restore, even if a synchronous error escapes the inner per-step catch (e.g. an OOM
    // during a massive sweep). Otherwise a later re-run would see the last swept value.
    for (const r of restores) r();
  }
  if (capped) {
    const note: SimError = { severity: "info", message: `.step: sweep truncated to ${MAX_POINTS} points (the requested sweep would produce ${requested}).` };
    for (const acc of accs) acc.errors.unshift(note);
  }
  const titleSuffix = axes.map((ax) => ax.spec.refdes).join(" × ");
  return analyses.map((a, i) => {
    const acc = accs[i];
    const sweepName = a.kind === "tran" ? "time" : a.kind === "ac" || a.kind === "noise" ? "frequency" : a.kind === "dc" ? (a as Analysis & { kind: "dc" }).src : "";
    const sweepUnit = a.kind === "tran" ? "s" : a.kind === "ac" || a.kind === "noise" ? "Hz" : a.kind === "dc" ? "V" : "";
    const out: SimResult = {
      analysis: a,
      title: `${titleOf(a)} · ${titleSuffix} step`,
      sweepName, sweepUnit,
      sweep: acc.sweep,
      complex: acc.complex,
      signals: acc.signals,
      ...(acc.complex ? { csignals: acc.csignals } : {}),
      ...(acc.digital ? { digital: acc.digital } : {}),
      units: acc.units,
      log: [],
      errors: acc.errors,
      converged: acc.converged,
      stats: { matrixSize: 0, points: acc.sweep.length, timeMs: now() - acc.t0 },
    };
    return out;
  });
}

/** Format a swept value compactly for the signal suffix. Uses 3 significant digits which
 *  is plenty for parameter-sweep readouts; the full precision is preserved in the trace data. */
function formatStepValue(v: number): string {
  if (!isFinite(v)) return String(v);
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (abs >= 1e-3 && abs < 1e6) {
    // Plain decimal in human range; trim trailing zeros.
    return parseFloat(v.toPrecision(4)).toString();
  }
  return v.toExponential(2);
}

const titleOf = (a: Analysis) => a.kind === "op" ? "Operating Point" : a.kind === "tran" ? "Transient" : a.kind === "dc" ? "DC Sweep" : a.kind === "noise" ? "Noise" : "AC Sweep";

export function makeIndexer(nl: Netlist, transient: boolean): Indexer {
  const ix = new Indexer(nl.nodes);
  precount(ix, nl.elements, transient);
  return ix;
}

/** Build the named output signals from a solution vector. */
function readSignals(ix: Indexer, els: NetlistElement[], x: number[]): { v: Record<string, number>; units: Record<string, string> } {
  const v: Record<string, number> = {}; const units: Record<string, string> = {};
  for (const [name, i] of ix.nodeIndex) { if (i >= 0) { v[`V(${name})`] = x[i]; units[`V(${name})`] = "V"; } }
  v["V(0)"] = 0;
  // Helper for the LTspice-style op-point readouts (@<refdes>[<param>]). Emitting these into
  // result.signals means they flow naturally through the existing pipeline - the Inspector reads
  // them by key, and a future waveform-viewer plot of e.g. "@M1[gm]" during a DC sweep works
  // for free. Unit strings are used by the Inspector for SI-aware formatting.
  const opSig = (name: string, param: string, value: number | undefined, unit: string) => {
    if (typeof value !== "number" || !isFinite(value)) return;
    const k = `@${name}[${param}]`;
    v[k] = value; units[k] = unit;
  };
  for (const el of els) {
    if (el.type === "V") { const c = ix.branchOf.get(`V:${el.name}`); if (c !== undefined) { v[`I(${el.name})`] = x[ix.nNodes + c]; units[`I(${el.name})`] = "A"; } }
    else if (el.type === "L") { const c = ix.branchOf.get(`L:${el.name}`); if (c !== undefined) { v[`I(${el.name})`] = x[ix.nNodes + c]; units[`I(${el.name})`] = "A"; } }
    else if (el.type === "R") { const i1 = ix.node(el.n1), i2 = ix.node(el.n2); const va = i1 < 0 ? 0 : x[i1], vb = i2 < 0 ? 0 : x[i2]; const rv = el.value; const Re = (el as unknown as { _Reff?: number })._Reff ?? (Math.abs(rv) < 1e-12 ? (rv < 0 ? -1e-12 : 1e-12) : rv); v[`I(${el.name})`] = (va - vb) / Re; units[`I(${el.name})`] = "A"; }  // signed + temperature-scaled (uses _Reff cached by the R stamp)
    else if (el.type === "D") {
      const e = el as any; const id = e._Id;
      if (typeof id === "number") { v[`I(${el.name})`] = id; units[`I(${el.name})`] = "A"; }
      opSig(el.name, "id", e._Id, "A"); opSig(el.name, "vd", e._vd, "V");
      opSig(el.name, "gd", e._gd, "S");                                                // junction conductance
      if (typeof e._gd === "number" && e._gd > 0) opSig(el.name, "rd", 1 / e._gd, "Ω"); // small-signal resistance
      opSig(el.name, "region", e._region, "");                                          // 0=cutoff 1=forward 2=breakdown
    }
    else if (el.type === "M") {
      const e = el as any; const id = e._Id;
      if (typeof id === "number") { v[`I(${el.name})`] = id; units[`I(${el.name})`] = "A"; }
      opSig(el.name, "id", e._Id, "A");
      opSig(el.name, "vgs", e._Vgs, "V"); opSig(el.name, "vds", e._Vds, "V"); opSig(el.name, "vbs", e._Vbs, "V");
      opSig(el.name, "vth", e._Vth, "V");
      opSig(el.name, "gm", e._gm, "S"); opSig(el.name, "gds", e._gds, "S"); opSig(el.name, "gmb", e._gmb, "S");
      if (typeof e._gds === "number" && e._gds > 0) opSig(el.name, "ro", 1 / e._gds, "Ω");
      opSig(el.name, "region", e._region, "");                                          // 0=cutoff 1=sub 2=triode 3=sat
    }
    else if (el.type === "J") {
      const e = el as any; const id = e._Id;
      if (typeof id === "number") { v[`I(${el.name})`] = id; units[`I(${el.name})`] = "A"; }
      opSig(el.name, "id", e._Id, "A");
      opSig(el.name, "vgs", e._Vgs, "V"); opSig(el.name, "vds", e._Vds, "V");
      opSig(el.name, "vto", e._Vto, "V");
      opSig(el.name, "igs", e._Igs, "A"); opSig(el.name, "igd", e._Igd, "A");
      opSig(el.name, "gm", e._gm, "S"); opSig(el.name, "gds", e._gds, "S");
      if (typeof e._gds === "number" && e._gds > 0) opSig(el.name, "ro", 1 / e._gds, "Ω");
      opSig(el.name, "region", e._region, "");                                          // 0=cutoff 1=sat 2=triode
    }
    else if (el.type === "Q") {
      const e = el as any; const ic = e._Ic, ib = e._Ib, ie = e._Ie;
      if (typeof ic === "number") { v[`Ic(${el.name})`] = ic; units[`Ic(${el.name})`] = "A"; v[`I(${el.name})`] = ic; units[`I(${el.name})`] = "A"; }
      if (typeof ib === "number") { v[`Ib(${el.name})`] = ib; units[`Ib(${el.name})`] = "A"; }
      if (typeof ie === "number") { v[`Ie(${el.name})`] = ie; units[`Ie(${el.name})`] = "A"; }
      opSig(el.name, "ic", e._Ic, "A"); opSig(el.name, "ib", e._Ib, "A"); opSig(el.name, "ie", e._Ie, "A");
      opSig(el.name, "vbe", e._Vbe, "V"); opSig(el.name, "vbc", e._Vbc, "V");
      if (typeof e._Vbe === "number" && typeof e._Vbc === "number") opSig(el.name, "vce", e._Vbe - e._Vbc, "V");
      opSig(el.name, "gm", e._gm, "S"); opSig(el.name, "gpi", e._gpi, "S");
      opSig(el.name, "gmu", e._gmu, "S"); opSig(el.name, "go", e._go, "S");
      if (typeof e._gpi === "number" && e._gpi > 0) opSig(el.name, "rpi", 1 / e._gpi, "Ω");
      if (typeof e._go === "number" && e._go > 0)   opSig(el.name, "ro", 1 / e._go, "Ω");
      // β at the operating point = gm·rπ (only meaningful in forward-active)
      if (typeof e._gm === "number" && typeof e._gpi === "number" && e._gpi > 0) opSig(el.name, "beta", e._gm / e._gpi, "");
      opSig(el.name, "region", e._region, "");                                          // 0=cutoff 1=fwd-active 2=sat 3=rev-active
    }
    else if (el.type === "OPAMP") {
      const e = el as any;
      opSig(el.name, "vsat", e._vSat, "V");
      opSig(el.name, "gloc", e._gloc, "");        // local linearised gain (small-signal)
      opSig(el.name, "vdiff", e._vDiff, "V");     // v(in+) − v(in−); useful for "am I in linear region?"
      opSig(el.name, "region", e._region, "");    // 0=linear 1=sat+  2=sat−
    }
    else if (el.type === "C") { const ic = (el as any)._iC; if (typeof ic === "number") { v[`I(${el.name})`] = ic; units[`I(${el.name})`] = "A"; } }
    else if (el.type === "S" || el.type === "W") {
      // Recompute from the SOLVED x rather than reporting the last Newton iterate's scratch:
      // the stamp's _i was formed one iteration before the final solve.
      const e = el as any;
      const i1 = ix.node(el.n1), i2 = ix.node(el.n2);
      const vsw = (i1 < 0 ? 0 : x[i1]) - (i2 < 0 ? 0 : x[i2]);
      const st: 0 | 1 = e._swState ?? 0;
      const geo = switchGeometry(el.model, el.type === "S", st);
      const ctrl = switchControl(ix, el, x);
      const { g, s } = switchSense(geo, ctrl);
      v[`I(${el.name})`] = g * vsw; units[`I(${el.name})`] = "A";
      opSig(el.name, "i", g * vsw, "A");
      opSig(el.name, "v", vsw, "V");
      opSig(el.name, "r", 1 / Math.max(g, 1e-30), "Ω");
      opSig(el.name, "g", g, "S");
      opSig(el.name, "vc", ctrl, el.type === "S" ? "V" : "A");
      // 0 = fully off, 1 = fully on. Continuous through the transition (not a boolean) so a
      // plot of @S1[state] shows the real edge instead of a fictitious instantaneous jump.
      opSig(el.name, "state", s, "");
      opSig(el.name, "latch", st, "");
    }
    else if (el.type === "VDMOS") {
      const e = el as any;
      const dInt: number = typeof e._nD === "number" ? e._nD : ix.node(el.nD);
      const dExt = ix.node(el.nD);
      const vAt = (i: number) => (i < 0 ? 0 : x[i] ?? 0);
      let iDrain: number;
      if (el.model.Rd > 1e-9 && dInt !== dExt) {
        // Exact terminal current: everything the device draws must cross Rd.
        iDrain = (vAt(dExt) - vAt(dInt)) / el.model.Rd;
      } else {
        // No Rd ⇒ sum the branches that touch the drain node: channel, Rds shunt, body diode
        // and (transient only) the displacement current of every internal capacitance.
        const sInt: number = typeof e._nS === "number" ? e._nS : ix.node(el.nS);
        const chan = e._Id ?? 0;
        const rds = el.model.Rds > 0 ? (vAt(dInt) - vAt(sInt)) / el.model.Rds : 0;
        const nA: number = e._nA ?? -1, nK: number = e._nK ?? -1;
        const idio = e._Idiode ?? 0;
        // Body diode conducts anode→cathode; it enters the drain when the drain is the cathode.
        const dioIntoDrain = nK === dInt ? idio : (nA === dInt ? -idio : 0);
        let icap = 0;
        for (const j of (e._jcaps ?? []) as { na: number; nc: number; Geq: number; Ieq: number }[]) {
          const iC = j.Geq * (vAt(j.na) - vAt(j.nc)) + j.Ieq;
          if (j.na === dInt) icap += iC;          // leaves the drain
          else if (j.nc === dInt) icap -= iC;     // enters the drain
        }
        iDrain = chan + rds - dioIntoDrain + icap;
      }
      v[`I(${el.name})`] = iDrain; units[`I(${el.name})`] = "A";
      opSig(el.name, "id", e._Id, "A");
      opSig(el.name, "vgs", e._Vgs, "V"); opSig(el.name, "vds", e._Vds, "V");
      opSig(el.name, "vth", e._Vth, "V");
      opSig(el.name, "gm", e._gm, "S"); opSig(el.name, "gds", e._gds, "S");
      if (typeof e._gds === "number" && e._gds > 0) opSig(el.name, "ro", 1 / e._gds, "Ω");
      opSig(el.name, "ibody", e._Idiode, "A"); opSig(el.name, "vbody", e._Vdiode, "V");
      opSig(el.name, "cgd", e._Cgd, "F"); opSig(el.name, "cgs", e._Cgs, "F");
      opSig(el.name, "region", e._region, "");   // 0=cutoff 1=sub 2=triode 3=sat
    }
  }
  return { v, units };
}

/** The frequency grid for .ac / .noise. lin = n points inclusive of both ends; dec/oct = n
 *  points per decade/octave, always including fstop. SPICE3 convention. */
export function acFreqGrid(sweep: "lin" | "dec" | "oct", n: number, fstart: number, fstop: number): number[] {
  const freqs: number[] = [];
  if (sweep === "lin") {
    for (let i = 0; i < n; i++) freqs.push(fstart + (fstop - fstart) * (n <= 1 ? 0 : i / (n - 1)));
  } else {
    const ratio = sweep === "dec" ? 10 : 2;
    const nPer = Math.max(1, n);
    let f = fstart;
    while (f <= fstop * (1 + 1e-9)) { freqs.push(f); f *= Math.pow(ratio, 1 / nPer); }
    if (freqs.length === 0 || freqs[freqs.length - 1] < fstop * (1 - 1e-9)) freqs.push(fstop);
  }
  return freqs;
}

/** Solve the DC operating point and capture the per-device small-signal parameters that the
 *  complex (AC / noise) stamps consume. Extracted from the .ac path verbatim so .noise
 *  linearizes at EXACTLY the same operating point .ac does - two answers about the same circuit
 *  that disagree about the bias point would be worse than either one alone. */
export function prepareSmallSignal(nl: Netlist, O: SimOptions): { lin: Record<string, any>; ok: boolean } {
  // §3 #5 hardening (self-audit P2): _Reff is operating-point-INDEPENDENT
  // (R0·(1+TC1·ΔT+TC2·ΔT²)). Compute it for every resistor UNCONDITIONALLY here, so the
  // AC stamp uses the temperature-scaled value even when the DC op-point fails (the
  // branch that previously fell back to raw el.value, silently reintroducing the very
  // .ac-vs-.tran tempco inconsistency #5 eliminated - on exactly the DC-fail path).
  {
    const T = O.temp;
    for (const el of nl.elements) if (el.type === "R") {
      const dT = T - (el.tnom ?? 27);
      const tc = 1 + (el.tc1 ?? 0) * dT + (el.tc2 ?? 0) * dT * dT;
      const Rn = el.value * Math.max(tc, 1e-9);
      (el as unknown as { _Reff?: number })._Reff = Math.abs(Rn) < 1e-12 ? (Rn < 0 ? -1e-12 : 1e-12) : Rn;
    }
  }
  // 1) DC op point to linearize nonlinear devices
  const ixDC = makeIndexer(nl, false);
  const rdc = nl.digital
    ? new MixedSim(nl, ixDC).dcFixedPoint((seed) => solveDC(ixDC, nl.elements, O, NaN, 0, false, new Map(), new Map(), seed), seedFromNodesets(ixDC, nl)).r
    : solveDC(ixDC, nl.elements, O, NaN, 0, false, new Map(), new Map(), seedFromNodesets(ixDC, nl));
  const lin: Record<string, any> = {};
  if (rdc) {
    for (const el of nl.elements) {
      if (el.type === "D") lin[el.name] = { gd: (el as any)._gd ?? O.gmin, Cj: (el as any)._Cj ?? 0, Id: (el as any)._Id ?? 0 };
      // The capacitances below are the OPERATING-POINT values the DC stamp just computed, not the
      // zero-bias model-card numbers. Every one of them is strongly bias-dependent, and the AC
      // stamp used to read the raw model instead.
      if (el.type === "M") lin[el.name] = {
        gm: (el as any)._gm ?? 0, gds: (el as any)._gds ?? O.gmin, gmb: (el as any)._gmb ?? 0,
        Id: (el as any)._Id ?? 0, region: (el as any)._region ?? 0,
        Cgs: (el as any)._Cgs ?? 0, Cgd: (el as any)._Cgd ?? 0, Cgb: (el as any)._Cgb ?? 0,
        Cbd: (el as any)._Cbd ?? 0, Cbs: (el as any)._Cbs ?? 0,
      };
      if (el.type === "Q") lin[el.name] = {
        gm: (el as any)._gm ?? 0, gpi: (el as any)._gpi ?? O.gmin, gmu: (el as any)._gmu ?? 0,
        go: (el as any)._go ?? O.gmin, Ic: (el as any)._Ic ?? 0, Ib: (el as any)._Ib ?? 0,
        Cje: (el as any)._Cje ?? 0, Cjc: (el as any)._Cjc ?? 0,
      };
      if (el.type === "J") lin[el.name] = {
        gm: (el as any)._gm ?? 0, gds: (el as any)._gds ?? O.gmin,
        ggs: (el as any)._ggs ?? O.gmin, ggd: (el as any)._ggd ?? O.gmin,
        Cgs: (el as any)._Cgs ?? 0, Cgd: (el as any)._Cgd ?? 0,
        Id: (el as any)._Id ?? 0, region: (el as any)._region ?? 0,
      };
      if (el.type === "OPAMP") lin[el.name] = { gloc: (el as any)._gloc ?? el.gain };
      if (el.type === "B") lin[el.name] = { dV: (el as any)._dV ?? {}, dI: (el as any)._dI ?? {} };
      // A switch is a nonlinear 2-port: its AC model is the bias conductance g PLUS the
      // transconductance gc = (dg/dVc)·V_switch from the control port. Dropping gc would make
      // a switch look like a plain resistor to .ac and silently hide every control-path effect.
      if (el.type === "S" || el.type === "W") lin[el.name] = { g: (el as any)._g ?? O.gmin, gc: (el as any)._gc ?? 0 };
      if (el.type === "VDMOS") lin[el.name] = {
        gm: (el as any)._gm ?? 0, gds: (el as any)._gds ?? O.gmin, Id: (el as any)._Id ?? 0,
        gdio: (el as any)._gdio ?? O.gmin, Cgd: (el as any)._Cgd ?? 0, Cgs: (el as any)._Cgs ?? 0,
        Cj: (el as any)._Cj ?? 0, region: (el as any)._region ?? 0,
      };
    }
  }
  return { lin, ok: rdc != null };
}

/** `.nodeset V(n)=v` → an initial guess vector for the DC Newton solve. Returns null when there
 *  are no nodesets so the caller keeps its existing (zero / warm-start) behaviour exactly. */
export function seedFromNodesets(ix: Indexer, nl: Netlist): number[] | null {
  if (!nl.nodesets || nl.nodesets.length === 0) return null;
  const x = new Array(ix.size).fill(0);
  let any = false;
  for (const ns of nl.nodesets) {
    const i = ix.node(ns.node);
    if (i >= 0 && isFinite(ns.value)) { x[i] = ns.value; any = true; }
  }
  return any ? x : null;
}

/** The longest run the digital kernel can time exactly (2^53 − 1 fs). */
const DIGITAL_MAX_TIME = 9.007;

/**
 * A DC solve with the digital side settled consistently with it (see MixedSim.dcFixedPoint).
 * Without digital logic this is exactly one solveDC call.
 */
function solveDCWithDigital(
  mixed: MixedSim | null, solve: (seed: number[] | null) => { x: number[]; iters: number } | null, seed: number[] | null,
  errors: SimError[],
): { x: number[]; iters: number } | null {
  if (!mixed) return solve(seed);
  const fp = mixed.dcFixedPoint(solve, seed);
  if (fp.r && !fp.consistent) {
    errors.push({
      severity: "warning",
      message: "Digital: the logic and the analog circuit have no consistent operating point (the loop between them oscillates). An operating point shows the last state tried; a transient starts from power-on, with capacitors discharged.",
      hint: "This is expected for an oscillator closed through a logic gate. For a static circuit, check for a feedback loop through a gate input that sits between its thresholds.",
    });
  }
  return fp.r;
}

function runAnalysis(nl: Netlist, a: Analysis, O: SimOptions): SimResult {
  const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
  const errors: SimError[] = [...nl.errors.filter(e => e.severity !== "info")];
  const log: string[] = [];
  try {
    return runAnalysisInner(nl, a, O, t0, errors, log);
  } catch (e) {
    // A failure inside the digital kernel (a zero-delay loop that never settles, a time past its
    // range) is a property of the design: report it in plain words, never as a stack trace.
    if (nl.digital && (e as { name?: string })?.name === "DigitalSimError") {
      return res(a, [], "", "", { signals: {}, units: {} }, false, errors.concat({ severity: "error", message: digitalErrorMessage(e) }), log, 0, t0);
    }
    throw e;
  }
}

function runAnalysisInner(nl: Netlist, a: Analysis, O: SimOptions, t0: number, errors: SimError[], log: string[]): SimResult {

  if (a.kind === "op") {
    const ix = makeIndexer(nl, false);
    const diag: ConvergenceDiag = { method: "none", attempts: [] };
    const mixed = nl.digital ? new MixedSim(nl, ix) : null;
    if (mixed) for (const n of mixed.notes) errors.push({ severity: "info", message: n });
    if (mixed && nl.elements.length === 0) {
      // Logic only: the operating point is the digital state settled at t = 0.
      mixed.initAtZero([]);
      const outD = res(a, [0], "", "", { signals: {}, units: {} }, true, errors, log, 0, t0);
      outD.digital = mixed.result();
      return outD;
    }
    const r = solveDCWithDigital(mixed, (seed) => solveDC(ix, nl.elements, O, NaN, 0, false, new Map(), new Map(), seed, new Map(), diag), seedFromNodesets(ix, nl), errors);
    if (!r) {
      // The report names the guilty device and suggests a .nodeset instead of the old generic
      // "did not converge" wall - see diagnoseNonConvergence.
      const rep = reportOf(diag, false);
      const out = res(a, [], "", "", { signals: {}, units: {} }, false,
        errors.concat({ severity: "error", message: rep.message, ...(rep.suggestion ? { hint: rep.suggestion } : {}), ...(rep.guilty ? { location: rep.guilty.component } : {}) }),
        log, ix.size, t0);
      out.convergence = rep;
      return out;
    }
    const { v, units } = readSignals(ix, nl.elements, r.x);
    const signals: Record<string, number[]> = {}; for (const k in v) signals[k] = [v[k]];
    const components = computeComponentReadouts(nl.elements, ix, r.x);
    const out = res(a, [0], "", "", { signals, units, components }, true, errors, log, ix.size, t0, r.iters);
    out.convergence = reportOf(diag, true);
    if (mixed) out.digital = mixed.result();
    if (diag.method !== "direct" && diag.method !== "gmin") {
      log.push(`DC operating point required ${diag.method}.`);
    }
    return out;
  }

  if (a.kind === "dc") {
    const src = nl.elements.find(e => (e.type === "V" || e.type === "I") && e.name.toLowerCase() === a.src.toLowerCase());
    if (!src) return res(a, [], "", "", { signals: {}, units: {} }, false, errors.concat({ severity: "error", message: `.dc: source "${a.src}" not found.` }), log, 0, t0);
    const ix = makeIndexer(nl, false);
    const mixedDC = nl.digital ? new MixedSim(nl, ix) : null;
    const sweep: number[] = []; const signals: Record<string, number[]> = {}; let units: Record<string, string> = {};
    const dir = a.stop >= a.start ? 1 : -1; const step = Math.max(Math.abs(a.step) || 1e-9, 1e-15) * dir;
    let prev: number[] | null = seedFromNodesets(ix, nl);
    // SAVE the source's original DC & tran spec so we can RESTORE after the sweep. Previously
    // the sweep permanently clobbered (src as any).dc and (src as any).tran, so a later .tran or
    // .op in the same simulate() call (or even just re-running the same netlist) used the LAST
    // swept value instead of the user's original spec.
    const srcAny = src as { dc?: number; tran?: unknown };
    const origDc = srcAny.dc, origTran = srcAny.tran;
    // Index-based loop: walking by integer steps avoids float-accumulator skips/overshoots.
    // Use ceil(range/step) + 1 so a step that doesn't divide cleanly INCLUDES a final point at
    // a.stop (clamped below), rather than rounding off and dropping it. Previously Math.round
    // could undershoot, producing one fewer point than expected for non-integer ratios.
    const nSteps = Math.max(1, Math.ceil(Math.abs(a.stop - a.start) / Math.abs(step)) + 1);
    try {
      for (let i = 0; i < nSteps; i++) {
        const val = a.start + i * step;
        // Last point: clamp to exactly a.stop to dodge float drift on the boundary.
        const v = i === nSteps - 1 ? a.stop : val;
        srcAny.dc = v; srcAny.tran = { kind: "dc", v };
        const r = solveDCWithDigital(mixedDC, (seed) => solveDC(ix, nl.elements, O, NaN, 0, false, new Map(), new Map(), seed), prev, errors);
        if (!r) { errors.push({ severity: "warning", message: `.dc: did not converge at ${a.src}=${v.toPrecision(4)}.` }); break; }
        prev = r.x;
        // Advance switch hysteresis latches between sweep points. This is what makes a DC sweep
        // of a Schmitt trigger built from an S element show the real two-branch loop rather than
        // a single-valued curve; the latch never moves inside a Newton iteration.
        commitSwitchStates(ix, nl.elements, r.x);
        const sg = readSignals(ix, nl.elements, r.x); units = sg.units;
        sweep.push(v);
        for (const k in sg.v) (signals[k] ??= []).push(sg.v[k]);
      }
    } finally {
      srcAny.dc = origDc; srcAny.tran = origTran;
    }
    return res(a, sweep, a.src, (src.type === "V" ? "V" : "A"), { signals, units }, sweep.length > 0, errors, log, ix.size, t0);
  }

  if (a.kind === "tran") {
    const ix = makeIndexer(nl, true);
    let mixed: MixedSim | null = null;
    if (nl.digital) {
      mixed = new MixedSim(nl, ix);
      for (const n of mixed.notes) errors.push({ severity: "info", message: n });
      if (a.tstop > DIGITAL_MAX_TIME) {
        return res(a, [], "time", "s", { signals: {}, units: {} }, false, errors.concat({ severity: "error", message: `Digital logic is timed to the femtosecond, which reaches ${DIGITAL_MAX_TIME} s; this run asks for ${a.tstop} s.`, hint: "Shorten .tran, or split the run." }), log, ix.size, t0);
      }
      if (nl.elements.length === 0) {
        // Logic only: no analog matrix to solve, the kernel runs straight to tstop.
        const tEnd = Math.max(a.tstop, 1e-12);
        mixed.initAtZero([]);
        mixed.runDigitalOnly(tEnd);
        const outD = res(a, [0, tEnd], "time", "s", { signals: {}, units: {} }, true, errors, log, 0, t0);
        outD.digital = mixed.result();
        return outD;
      }
    }
    const caps = new Map<string, { vPrev: number; iPrev: number }>();
    const inds = new Map<string, { iPrev: number; vPrev: number }>();
    // dCaps PERSISTS across the entire transient - junction-cap state (diode Cj, MOSFET overlap
    // and bulk junctions, BJT Cje/Cjc) accumulates here. Before this fix it was a fresh `new
    // Map()` inside solveDC, so every step's companion saw vPrev=current iterate and iPrev=0,
    // effectively turning every junction cap into a tiny static conductance. Now it survives.
    const dCaps = new Map<string, { vPrev: number; iPrev: number; qPrev: number }>();
    for (const el of nl.elements) {
      if (el.type === "C") caps.set(el.name, { vPrev: el.ic ?? 0, iPrev: 0 });
      if (el.type === "L") inds.set(el.name, { iPrev: el.ic ?? 0, vPrev: 0 });
      // Clear OPAMP transient state - _vOutPrev anchors the slew clamp and the GBW dominant-pole
      // LPF. If a netlist is reused across .tran calls (or two .tran analyses in one simulate()),
      // stale state from the previous run would bias the slew on the first step. We DON'T clear
      // _jcaps here because the stamp resets it each Newton iter - only state that's READ on
      // the first step before any stamp runs needs explicit clearing.
      if (el.type === "OPAMP") { const e = el as unknown as { _vOutPrev?: number; _vxPrev?: number }; e._vOutPrev = undefined; e._vxPrev = undefined; }
      // Switch latches start OPEN at t=0 and are then committed from the operating point below.
      // Stale state from a previous .tran on the same netlist would otherwise decide the first
      // step's conduction path - a run whose answer depends on what ran before it.
      if (el.type === "S" || el.type === "W") (el as unknown as { _swState?: 0 | 1 })._swState = 0;
      // A transmission line's wave history is per-RUN state. Clearing it here also puts the
      // element back into its DC-short form, which is exactly what the t=0 operating-point
      // solve below needs to see.
      if (el.type === "T") (el as unknown as { _tlHist?: TLineHistory })._tlHist = undefined;
    }
    // initial point: DC op (unless uic)
    let x: number[];
    if (a.uic) {
      x = new Array(ix.size).fill(0);
      if (mixed) mixed.initAtZero(mixed.classify(x));
      // UIC skips the operating point entirely, so a line starts at rest rather than at a bias.
      for (const el of nl.elements) {
        if (el.type === "T") (el as unknown as { _tlHist?: TLineHistory })._tlHist = { t: [], p1: [], p2: [], seed1: 0, seed2: 0 };
      }
    }
    else {
      const diag0: ConvergenceDiag = { method: "none", attempts: [] };
      const r0 = solveDCWithDigital(mixed, (seed) => solveDC(ix, nl.elements, O, NaN, 0, false, new Map(), new Map(), seed, new Map(), diag0), seedFromNodesets(ix, nl), errors);
      if (!r0) {
        const rep = reportOf(diag0, false);
        const outF = res(a, [], "time", "s", { signals: {}, units: {} }, false,
          errors.concat({ severity: "error", message: `Transient: the initial DC operating point did not converge. ${rep.message}`, ...(rep.suggestion ? { hint: `${rep.suggestion}  (or add UIC to .tran to skip the operating point entirely)` } : {}) }),
          log, ix.size, t0);
        outF.convergence = rep;
        return outF;
      }
      x = r0.x;
      if (mixed && !mixed.lastDcConsistent) {
        // No operating point exists (an oscillator closed through logic): start from power-on,
        // the state a real circuit starts from. Capacitors and inductors begin discharged (their
        // histories are already at rest), and the logic settles on what that state reads; the
        // UIC solve below makes the rest of the circuit consistent with it.
        x = new Array(ix.size).fill(0);
        mixed.initAtZero(mixed.classify(x));
        for (const el of nl.elements) {
          if (el.type === "T") (el as unknown as { _tlHist?: TLineHistory })._tlHist = { t: [], p1: [], p2: [], seed1: 0, seed2: 0 };
        }
      }
    }
    const powerOn = a.uic || (!!mixed && !mixed.lastDcConsistent);
    if (!powerOn) {
      commitSwitchStates(ix, nl.elements, x);   // latch state consistent with the t=0 bias
      // seed cap/inductor history from the op point
      for (const el of nl.elements) {
        if (el.type === "C") {
          // ESR cap: history is the voltage across the CAP itself (internal → n2), not the
          // port (n1 → n2). Using the port voltage corrupts the BE/Trap companion by the IR
          // drop on the ESR - silent but accumulating phase error in long transients.
          const useEsr = (el.esr ?? 0) > 0;
          const nHi = useEsr ? ix.internal(`Cint:${el.name}`) : ix.node(el.n1);
          const va = nHi < 0 ? 0 : x[nHi];
          const vb = ix.node(el.n2) < 0 ? 0 : x[ix.node(el.n2)];
          caps.set(el.name, { vPrev: va - vb, iPrev: 0 });
        }
        if (el.type === "L") { const c = ix.branchOf.get(`L:${el.name}`); inds.set(el.name, { iPrev: c !== undefined ? x[ix.nNodes + c] : 0, vPrev: 0 }); }
        // Seed the line's travelling waves with the bias it is already sitting at. At the DC
        // point the two branch unknowns are the CONDUCTOR currents (n1→n3 and n2→n4), so the
        // port currents are i1 = +branch1 and i2 = −branch1: what flows in at one end flows out
        // at the other. Seeding zero instead would launch a step of the line's own bias voltage
        // at t=0 and ring for the whole run.
        if (el.type === "T") {
          const c1 = ix.branchOf.get(`T1:${el.name}`);
          const i1 = c1 !== undefined ? x[ix.nNodes + c1] : 0;
          const nv = (n: string) => { const i = ix.node(n); return i < 0 ? 0 : x[i]; };
          const v1 = nv(el.n1) - nv(el.n2), v2 = nv(el.n3) - nv(el.n4);
          (el as unknown as { _tlHist?: TLineHistory })._tlHist = {
            t: [], p1: [], p2: [],
            seed1: v1 + el.z0 * i1,
            seed2: v2 + el.z0 * (-i1),
          };
        }
        // Seed the gm–C compensation node from the DC op point: invert the output buffer so
        // V(x) reproduces the op-point output, giving a bumpless transient start.
        if (el.type === "OPAMP" && el.gbw > 0) {
          const o = ix.node(el.nOut);
          const vmid0 = (el.vmax + el.vmin) / 2, As0 = Math.max((el.vmax - el.vmin) / 2, 1e-6);
          let rr = ((o >= 0 ? x[o] : 0) - vmid0) / As0;
          rr = Math.max(Math.min(rr, 0.999), -0.999);
          (el as { _vxPrev?: number })._vxPrev = As0 * Math.atanh(rr);
        }
      }
    }
    const tstop = Math.max(a.tstop, 1e-12);
    let h = Math.max(a.tstep || tstop / 1000, tstop / 200000);
    if (a.dtmax && a.dtmax > 0) h = Math.min(h, a.dtmax);
    const tstart = Math.max(0, a.tstart || 0);
    const sweep: number[] = []; const signals: Record<string, number[]> = {}; let units: Record<string, string> = {};
    const pushPoint = (t: number, xx: number[]) => {
      const sg = readSignals(ix, nl.elements, xx); units = sg.units;
      if (t >= tstart - 1e-15) { sweep.push(t); for (const k in sg.v) (signals[k] ??= []).push(sg.v[k]); }
    };
    // record t=0
    if (powerOn) {
      // Proper UIC: solve at t=0 with caps/inductors held at their IC values. The cap/ind history
      // already contains the user-supplied IC (set up just above). One BE-step solve gives a
      // consistent x for non-state nodes, but state-bearing nodes drift by ~h. For ground-referenced
      // caps with an explicit IC, we directly pin V at the floating terminal AFTER the solve so the
      // first plotted point matches the IC exactly (LTspice convention).
      const r = solveDC(ix, nl.elements, O, 0, h, true, caps, inds, x, dCaps);
      if (r) x = r.x;
      for (const el of nl.elements) {
        if (el.type === "C" && el.ic !== undefined) {
          const a = ix.node(el.n1), b = ix.node(el.n2);
          // If one terminal is ground, pin the other to exactly el.ic so the user's IC is honoured.
          if (a < 0 && b >= 0) x[b] = -el.ic;
          else if (b < 0 && a >= 0) x[a] = el.ic;
        } else if (el.type === "L" && el.ic !== undefined) {
          // Symmetric to the cap pin: the t=0 BE solve leaves the inductor branch current
          // at I0/(1+h/τ) (one BE step past the IC), so the first PLOTTED I(L) was wrong by
          // ~h/τ. Pin the branch unknown back to exactly el.ic so the first sample matches
          // the user's initial condition (the trajectory was already correct thereafter).
          const c = ix.branchOf.get(`L:${el.name}`);
          if (c !== undefined) x[ix.nNodes + c] = el.ic;
        }
      }
    }
    // From power-on the bridges must read the state the t = 0 solve just produced (an output
    // that rose into a load is already high), or the first step would see a phantom edge.
    if (mixed && powerOn) mixed.initAtZero(mixed.classify(x));
    // `.ic V(node)=value` directives - pin arbitrary nodes to a user-supplied initial value.
    // Applies regardless of UIC: with UIC the entire DC solve is skipped so the ICs ARE the
    // starting state; without UIC the DC solve provides the bias point and these ICs override
    // it for state-bearing nodes (the canonical SPICE convention is UIC-only, but a friendlier
    // "ignore UIC for non-cap nodes" behavior matches what users expect for state-machine flags).
    if (nl.ics && nl.ics.length > 0) {
      for (const ic of nl.ics) {
        const idx = ix.node(ic.node);
        if (idx >= 0) x[idx] = ic.value;
      }
      // AND RE-SEED THE REACTIVE STATE FROM IT. Pinning `x` alone only changes the t=0 SAMPLE
      // that gets plotted: the capacitor/inductor histories were seeded from the DC operating
      // point further up, so the very first companion model still carried the old bias and the
      // waveform snapped back to it on step one. Measured on an RC with `.ic V(out)=5`: the
      // t=0 point read 5.000 V and t=1 ms read 0.000 V, where the correct decay is
      // 5·e^(−1) = 1.839 V. An initial condition that is visible for exactly one sample and
      // then silently discarded is worse than one that is refused.
      //
      // A capacitor with its OWN `ic=` keeps that value: the element-level IC is the more
      // specific statement, and `.ic` on one of its nodes must not override it.
      for (const el of nl.elements) {
        if (el.type === "C") {
          if (el.ic !== undefined) continue;
          const useEsr = (el.esr ?? 0) > 0;
          const nHi = useEsr ? ix.internal(`Cint:${el.name}`) : ix.node(el.n1);
          const va = nHi < 0 ? 0 : x[nHi];
          const vb = ix.node(el.n2) < 0 ? 0 : x[ix.node(el.n2)];
          caps.set(el.name, { vPrev: va - vb, iPrev: 0 });
        } else if (el.type === "L") {
          if (el.ic !== undefined) continue;
          const c = ix.branchOf.get(`L:${el.name}`);
          inds.set(el.name, { iPrev: c !== undefined ? x[ix.nNodes + c] : 0, vPrev: 0 });
        }
      }
    }
    pushPoint(0, x);
    let t = 0, step = 0;
    const maxSteps = 400000;
    // Breakpoint table: land an exact timepoint on every source discontinuity and take a
    // Backward-Euler step starting there (SPICE3 convention). Without this, trapezoidal
    // integration across a fast edge into an L/C network produces the textbook 2×-overshoot
    // ringing artifact at the first post-edge sample.
    const bps = collectBreakpoints(nl.elements, tstop);
    let bpPtr = 0;
    const bpTol = Math.max(tstop * 1e-12, 1e-18);
    let beNext = false; // force BE on the step that starts AT a breakpoint
    // Breakpoints discovered DURING the run (digital events, logic-edge ramp corners). The source
    // table above is fixed at t = 0; these arrive as the digital side advances, so they live in
    // a min-heap beside it. `disc` marks a real discontinuity (Backward Euler restarts there);
    // a digital event that changes no analog quantity is landed on but integrated through.
    const dyn = new BreakpointHeap();
    const nextBp = (): number => {
      const sb = bpPtr < bps.length ? bps[bpPtr] : Infinity;
      const db = dyn.size ? dyn.peek()!.t : Infinity;
      return Math.min(sb, db);
    };
    // Threshold crossings are located to within this much time (see MixedSim.findCrossing).
    const crossTol = Math.min(1e-9, Math.max(1e-13, tstop * 1e-9));
    if (mixed) {
      mixed.beginTransient(x, tstop);
      for (const b of mixed.prime()) dyn.push(b);
      if (!mixed.runAhead) { const ne = mixed.nextEventTime(); if (ne !== null) dyn.push({ t: ne, disc: false }); }
    }
    let digitalFail: string | null = null;

    // ── adaptive step control (see the TRANSIENT STEP CONTROL block near the top) ──────────
    // `h` becomes a CEILING. The controller only ever refines below it, so a circuit that was
    // already resolved takes the identical steps at the identical times it always did.
    const hMax = h;
    // ngspice's DELMIN. Not merely "small": below ~tstop·1e-9 the reactive companions (L/h,
    // C/h) tower over the circuit's own conductances by more than double precision can carry,
    // so the dense LU stops producing a usable Newton direction and shrinking further makes
    // convergence WORSE, not better. A ladder that keeps halving past that point turns a
    // recoverable step into a reported divergence.
    const hMin = Math.max(tstop * 1e-9, 1e-18);
    // FLOOR ON ACCURACY-DRIVEN REFINEMENT, separate from hMin.
    //
    // The error estimator is only meaningful while the solve it is judging is meaningful. Push
    // h far enough down and the reactive companions (L/h, C/h) tower over every other
    // conductance in the matrix; the dense LU then returns different answers for steps that
    // differ only in the 12th significant figure, the estimator reads that as "error", shrinks
    // again, and h collapses geometrically while t barely advances. (Observed on the boost
    // converter in scripts/test_switchers.ts: at h ≈ 1e-11 s the diode's internal node came back
    // 8.4 V on one attempt and 10.85 V on the next, and the run spiralled from 5e-8 to 6e-13 and
    // was declared divergent - a healthy circuit killed by its own step controller.)
    //
    // 64× below the requested tstep resolves a 20 ns gate edge inside a 5 µs period to ~1.5 ns,
    // which is the accuracy this exists to buy; below that the estimate is noise. Newton-rescue
    // refinement is NOT bound by this - a step that will not converge is a different problem and
    // gets the full ladder down to hMin.
    const hLteMin = Math.max(hMin, h / 64);
    // Engage only where stiffness can actually appear: a switching / semiconductor device.
    // A linear RLC network has nothing for the controller to discover, and the order-of-
    // convergence and linearity suites require the exact grid they asked for.
    // SCOPED TO HARD-SWITCHING DEVICES ONLY. The controller was added because a converter's
    // 20 ns gate edge inside a 5 us period is unresolvable on a fixed grid. Engaging it for every
    // diode/MOSFET circuit CHANGED ANSWERS on circuits that were already correct on the fixed grid
    // and are validated against closed form there: a flyback stopped tracking duty, and an even-N
    // CMOS ring oscillator - which is bistable and MUST latch - started swinging instead.
    // Refinement is not free accuracy: it changes which trajectory a marginally-stable nonlinear
    // circuit settles onto. So it engages only for S / W / VDMOS, the device classes it exists for.
    const adaptive = nl.elements.some((e) => e.type === "S" || e.type === "W" || e.type === "VDMOS");
    // Refinement budget. Bounds the extra work at ~8× the fixed-step cost; past it we stop
    // refining for ACCURACY (Newton-rescue refinement continues) and say so in the result,
    // rather than silently grinding for minutes in a browser tab. It is a STEP count, never a
    // wall-clock budget: a simulator whose answer depends on how fast the machine was that day
    // is not a simulator (and scripts/test_cross_method.ts pins bit-exact determinism).
    // The budget must scale with what actually drives refinement: SWITCHING EDGES. A 200 kHz
    // converter over 400 us has ~160 breakpoints, each a 20 ns transition inside a 5 us period,
    // and each legitimately costs many refined steps. The old flat 8x-nominal bound was exhausted
    // a third of the way into exactly the circuit class this controller was written for - the run
    // then finished on the coarse grid and was correctly, but needlessly, stamped UNRELIABLE.
    // Per-breakpoint headroom is what a switching circuit needs; the hard maxSteps ceiling still
    // bounds the worst case, so a browser tab can never be ground to a halt.
    const nominalSteps = Math.ceil(tstop / hMax) + bps.length;
    const lteBudget = Math.min(maxSteps, 40 * nominalSteps + 200 * bps.length + 2000);
    let budgetExhausted = false, budgetExhaustedAt = 0;
    let hCur = hMax;
    // The last THREE accepted points, newest first - the quadratic predictor needs all three.
    // `predictorAge` counts accepted steps since the last discontinuity: a polynomial fitted
    // across a source jump describes nothing, so the estimate is only used once two clean
    // intervals of continuous history sit behind the current point.
    let xM1: number[] = x.slice(), xM2: number[] = x.slice(), xM3: number[] = x.slice();
    let tM1 = 0, tM2 = -1, tM3 = -2;
    let predictorAge = 0;
    // Index of the last sample taken on a step that was accepted FIRST TRY with a sane
    // solution. Everything after it was produced while the solver was already struggling; if
    // the run then diverges those samples are the divergence, and drawing them is exactly the
    // failure this product exists to not commit.
    let lastHealthyIdx = sweep.length - 1;
    let diverged: { t: number; detail: string } | null = null;
    // Per-row running magnitude - the signal scale each row's accuracy is judged against.
    // See lteNorm for why a fixed `vntol` floor alone is unusable.
    const xRef = x.map((v) => Math.abs(v));

    while (t < tstop - 1e-15 && step < maxSteps) {
      while (bpPtr < bps.length && bps[bpPtr] <= t + bpTol) bpPtr++; // drop already-passed breakpoints
      while (dyn.size && dyn.peek()!.t <= t + bpTol) dyn.pop();
      // Backward Euler for the first step and across discontinuities - and for EVERY step
      // when `.options method=be` is selected (previously this option was accepted but inert;
      // the loop always ran trapezoidal). BE is L-stable: it damps the trap ringing some
      // stiff/switching circuits exhibit, at the cost of more numerical damping.
      const atDiscontinuity = step === 0 || beNext;
      const beStep = atDiscontinuity || O.method === "be";
      beNext = false;
      let hh = Math.min(adaptive ? hCur : h, tstop - t);
      // Don't step over the next breakpoint - clamp to land exactly on it.
      const nb = nextBp();
      if (nb > t + bpTol && nb < t + hh - bpTol) hh = nb - t;
      // The step that STARTS at a discontinuity must not swallow the whole interval to the next
      // one. A 20 ns gate ramp inside a 5 µs period is otherwise integrated in a SINGLE step -
      // the edge that carries all the dI/dt gets one sample, which is both the accuracy defect
      // and what hands the next Newton solve a hopeless starting point.
      if (adaptive && atDiscontinuity && nb < Infinity && !budgetExhausted) {
        const gap = nb - t;
        if (gap > 0) hh = Math.min(hh, Math.max(gap / 2, hMin));
      }

      // ── solve this step, refining until it is both convergent and accurate ──────────────
      let r: { x: number[]; iters: number } | null = null;
      let beCur = beStep;
      let firstTry = true;          // did this timepoint need any refinement at all?
      let rescued = false;          // did we have to shrink to get Newton to converge?
      let hNext = hh;               // the step to attempt NEXT, chosen by the error estimate
      let lteRejects = 0;
      let crossRejects = 0;
      for (let guard = 0; guard < 64; guard++) {
        const cand = solveDC(ix, nl.elements, O, t + hh, hh, beCur, caps, inds, x, dCaps);
        // Newton failed, or converged onto a runaway / NaN iterate. Two rungs, in this order:
        if (!cand || !sampleIsSane(cand.x)) {
          // RUNG 1: same step, Backward Euler. Try this BEFORE shrinking. A device snapping
          // between two conduction states (a rectifier commutating, a switch crossing
          // threshold) fails under the trapezoidal companion because the companion carries the
          // PREVIOUS step's voltage as a source term and keeps re-injecting the state the
          // device just left; BE has no such term and converges straight through. Shrinking
          // does not help - and the old ladder, which shrank and switched to BE together, made
          // that invisible and produced a RATCHET: BE at h/8 succeeded, the next step reverted
          // to trapezoidal at h/4, failed, and h halved every timepoint until it hit the floor
          // and the run was declared divergent. (Reproduced on the Vin = 6 V boost in
          // scripts/test_ee_power.ts, which died at t = 3.7 ms of a 25 ms run.)
          if (!beCur) { beCur = true; firstTry = false; rescued = true; continue; }
          if (hh <= hMin * (1 + 1e-9)) {
            diverged = {
              t,
              detail: cand
                ? `the solution ran away (${rowName(ix, firstInsaneRow(cand.x))} exceeded ${DIVERGE_ABS.toExponential(0)})`
                : "Newton did not converge even at the minimum timestep",
            };
            break;
          }
          // RUNG 2+: shrink hard, still L-stable.
          hh = Math.max(hMin, hh / 8);
          firstTry = false; rescued = true;
          continue;
        }
        // Local truncation error. Skipped on the first two steps and immediately after a
        // discontinuity (the divided differences span the jump and mean nothing there), once
        // the refinement budget is spent, and on any BACKWARD-EULER step: Milne's device only
        // estimates the truncation error when the predictor and the corrector share an order,
        // and a 2nd-order extrapolant against a 1st-order corrector reads the METHOD's own
        // order gap as error. Left in, it made every post-rescue BE step reject and re-open the
        // ratchet the rescue ladder above exists to close.
        if (adaptive && !beCur && !budgetExhausted && predictorAge >= 2 && hh > hLteMin * (1 + 1e-9) && lteRejects < MAX_LTE_REJECTS) {
          const xp = predictQuadratic(xM1, xM2, xM3, tM1, tM2, tM3, t + hh);
          const err = lteNorm(cand.x, xp, ix, O, xRef) / TRTOL;
          if (err > 1) {
            lteRejects++;
            // (err)^(-1/3): the LTE of a 2nd-order method scales as h³, so this is the step
            // that would have just met tolerance. 0.9 is the usual safety factor; the clamp
            // stops one wild estimate from collapsing or exploding the step.
            const shrink = Math.max(0.1, Math.min(0.8, 0.9 * Math.pow(err, -1 / 3)));
            hh = Math.max(hLteMin, hh * shrink);
            firstTry = false;
            continue;
          }
          // Comfortably inside tolerance ⇒ let the step grow back toward the ceiling.
          hNext = hh * Math.max(1, Math.min(2, 0.9 * Math.pow(Math.max(err, 1e-9), -1 / 3)));
        } else {
          // No usable estimate this step (start-up, post-discontinuity, budget spent). Creep
          // back toward the ceiling rather than staying stuck at whatever a past rescue chose.
          hNext = hh * 2;
        }
        // A logic threshold crossed inside this step: land within crossTol after it, so the
        // digital input changes at the right time and the analog timepoint sits on the edge.
        if (mixed && mixed.bridgeCount && crossRejects < 30) {
          const cr = mixed.findCrossing(t, x, t + hh, cand.x);
          if (cr && t + hh - cr.tc > crossTol) {
            const target = Math.max(cr.tc - t + 0.5 * crossTol, hMin);
            if (target < hh * (1 - 1e-12)) { crossRejects++; hh = target; continue; }
          }
        }
        r = cand;
        break;
      }
      if (diverged || !r) {
        if (!diverged) diverged = { t, detail: "the step could not be refined any further" };
        break;
      }
      // Never leap straight back to a step Newton just refused: a rescue caps the next attempt
      // at the step that actually worked, and the estimator earns the growth back from there.
      hCur = Math.min(hMax, rescued ? hh : hNext);
      // A step that needed rescuing is a step INSIDE a hard nonlinear transition, and the next
      // one almost always is too. Carrying Backward Euler forward across it is what stops the
      // trap-fails / BE-succeeds alternation from ratcheting the timestep into the floor.
      if (rescued) beNext = true;

      const xPrev = x, tPrev = t;
      x = r.x;
      for (let i = 0; i < x.length; i++) { const av = Math.abs(x[i]); if (av > xRef[i]) xRef[i] = av; }
      updateReactiveHistory(ix, nl.elements, x, caps, inds, hh, beCur, dCaps, t + hh);
      // Predictor history: shift BEFORE advancing t so (tM1,xM1) is the point we just accepted.
      xM3 = xM2; tM3 = tM2; xM2 = xM1; tM2 = tM1; xM1 = x.slice(); tM1 = t + hh;
      t += hh; step++;
      // REFINEMENT MUST NEVER COST THE RUN ITS ABILITY TO FINISH. Two independent brakes:
      // a flat multiple of the fixed-step cost, and - the one that actually matters on long
      // runs - a projection of the total step count at the current rate. A 25 ms run at
      // tstep = 100 ns already asks for 250 k steps, so ANY multiple of it exceeds the hard
      // ceiling; without the projection the controller refines happily until the ceiling and
      // returns a waveform that stopped at 59 % of tstop, which is a worse answer than a
      // slightly coarser complete one.
      // (The projection only starts once a few hundred steps of evidence exist - measured off
      // step 1 it would read whatever the first, deliberately-halved, post-t=0 step happened
      // to be and switch refinement off before it had done anything.)
      if (!budgetExhausted && (step >= lteBudget || (step >= 500 && step * (tstop / t) > 0.8 * maxSteps))) {
        budgetExhausted = true; budgetExhaustedAt = t;
      }
      // Landed exactly on a breakpoint → the next step starts at the discontinuity: force BE
      // and reset the extrapolation order (a polynomial fitted across a jump is nonsense).
      let landedDisc = false;
      if (bpPtr < bps.length && Math.abs(t - bps[bpPtr]) <= bpTol) { landedDisc = true; bpPtr++; }
      while (dyn.size && Math.abs(t - dyn.peek()!.t) <= bpTol) { if (dyn.pop()!.disc) landedDisc = true; }
      // The digital side consumes the step only now that it is accepted.
      if (mixed) {
        try {
          const acc = mixed.accept(tPrev, xPrev, t, x);
          for (const b of acc.bps) dyn.push(b);
          if (acc.discNow) landedDisc = true;
          if (!mixed.runAhead) { const ne = mixed.nextEventTime(); if (ne !== null) dyn.push({ t: ne, disc: false }); }
        } catch (e) {
          digitalFail = digitalErrorMessage(e);
        }
      }
      if (landedDisc) { beNext = true; predictorAge = 0; }
      else predictorAge++;
      pushPoint(t, x);
      if (firstTry) lastHealthyIdx = sweep.length - 1;
      if (digitalFail) break;
    }
    if (digitalFail) errors.push({ severity: "error", message: digitalFail });

    // ── divergence: truncate, never draw ──────────────────────────────────────────────────
    if (diverged) {
      // Drop every sample taken after the last cleanly-accepted step. Those points came out of
      // a solver that was already shrinking its step to stay alive; they are the divergence,
      // and a plotted 200 V excursion on a 12 V circuit is a worse answer than a short plot
      // plus an honest error.
      const keep = Math.max(1, lastHealthyIdx + 1);
      if (keep < sweep.length) {
        sweep.length = keep;
        for (const k in signals) signals[k].length = keep;
      }
      errors.push({
        severity: "error",
        message: `Transient: diverged at t=${diverged.t.toExponential(3)} s of ${tstop.toExponential(3)} s - ${diverged.detail}. No samples past that point are shown, because they are the divergence rather than the circuit.`,
        hint: "Most often the circuit, not the solver: an inductor with no freewheel path (a Level-1 `M` MOSFET has NO body diode, so a synchronous stage with dead time opens the inductor), a switch with no series/parallel resistance, or a gate drive referenced to the wrong node. Otherwise reduce .tran tstep, give every edge a finite rise/fall time, or add a small series R / snubber C.",
      });
    } else if (step >= maxSteps) {
      errors.push({ severity: "error", message: `Transient: hit the ${maxSteps}-step limit at t=${t.toExponential(3)} s of ${tstop.toExponential(3)} s; the run is incomplete.`, hint: "Increase .tran tstep, shorten tstop, or relax reltol." });
    }
    if (budgetExhausted && !diverged) {
      errors.push({
        severity: "warning",
        message: `Transient: the adaptive step controller stopped refining at t≈${budgetExhaustedAt.toExponential(3)} s so the run could reach tstop within its step limit. From there the step was held at the requested tstep, so fast edges in the remainder of the run are resolved no better than a fixed-step run would resolve them.`,
        hint: "This is an accuracy limit, not a wrong answer: shorten tstop or ask for a smaller .tran tstep if the late part of the waveform needs the finer resolution.",
      });
    }
    // A node far outside every source in the circuit is nearly always a MISSING CONDUCTION
    // PATH, not a solver artifact - and it is exactly what a 200 V spike on a 12 V converter
    // looks like. We do NOT discard those samples (a boost, a flyback and an unsnubbed
    // inductive turn-off all legitimately reach many times their supply); we say so, because
    // an unexplained plot is how a wrong circuit gets believed.
    {
      const srcMax = largestSourceMagnitude(nl.elements);
      let vPeak = 0, vPeakName = "";
      for (const k in signals) {
        if (units[k] !== "V") continue;
        for (const v of signals[k]) { const av = Math.abs(v); if (av > vPeak) { vPeak = av; vPeakName = k; } }
      }
      if (srcMax > 0 && vPeak > 20 * srcMax) {
        errors.push({
          severity: "warning",
          message: `Transient: ${vPeakName} reaches ${vPeak.toPrecision(4)} V on a circuit whose largest source is ${srcMax.toPrecision(4)} V (${(vPeak / srcMax).toFixed(0)}×).`,
          location: vPeakName,
          hint: "If that is not a deliberate boost/flyback/avalanche, an inductor is being opened with nowhere for its current to go. A Level-1 `M` MOSFET has NO body diode - a synchronous stage built from `M` devices has no freewheel path during dead time. Use the VDMOS power-MOSFET model (its body diode is intrinsic) or add an explicit catch diode.",
        });
      }
    }
    // `converged` must mean "this waveform is the whole answer". A run that aborted at 48 % of
    // tstop and still reported converged is how a truncated, diverging plot got presented as a
    // result - the single worst thing this engine can do.
    const reachedEnd = t >= tstop * (1 - 1e-9) - 1e-15;
    const outT = res(a, sweep, "time", "s", { signals, units }, sweep.length > 1 && reachedEnd && !diverged && !digitalFail, errors, log, ix.size, t0);
    if (mixed) outT.digital = mixed.result();
    return outT;
  }

  if (a.kind === "noise") {
    // Small-signal noise. Implemented in src/lib/sim/noise.ts against the SAME complex matrix
    // .ac builds (one adjoint solve per frequency yields every source's transfer function).
    return runNoise(nl, a, O, errors, t0);
  }

  if (a.kind === "ac") {
    const { lin, ok: rdcOk } = prepareSmallSignal(nl, O);
    const rdc = rdcOk ? {} : null;
    if (!rdc) errors.push({ severity: "warning", message: "AC: DC operating point did not converge; nonlinear devices linearized at 0 V." });
    // 2) frequency sweep
    const ix = makeIndexer(nl, true);
    const freqs = acFreqGrid(a.sweep, a.n, a.fstart, a.fstop);
    const csignals: Record<string, Complex[]> = {}; let units: Record<string, string> = {};
    const keptFreqs: number[] = [];
    for (const f of freqs) {
      const sol = solveAC(ix, nl.elements, O, f, lin);
      if (!sol) { errors.push({ severity: "warning", message: `AC: singular matrix at f=${f.toPrecision(4)} Hz (an ideal lossless resonance?). Add a small series/parallel resistance.` }); continue; }
      keptFreqs.push(f);   // record the frequency ONLY for a point that produced data - see below
      const sg = readComplexSignals(ix, nl.elements, sol); units = sg.units;
      for (const k in sg.v) (csignals[k] ??= []).push(sg.v[k]);
    }
    // The sweep axis is the list of frequencies that ACTUALLY produced a sample, not a prefix of
    // the requested grid. Slicing `freqs` was a silent-wrong-answer bug: a singular point ANYWHERE
    // in the interior is skipped by the `continue` above, so every surviving sample from that
    // point onward was paired with the WRONG frequency and the top of the sweep was dropped. The
    // Bode plot shifted bodily and every .ac measurement - bandwidth, phase_at, gbw, loop gain -
    // read off a mislabelled axis while looking perfectly plausible.
    const sweep = keptFreqs;
    return { analysis: a, title: "AC Sweep", sweepName: "frequency", sweepUnit: "Hz", sweep, complex: true, signals: {}, csignals, units, log, errors, converged: rdc != null && sweep.length >= 1, stats: { matrixSize: ix.size, points: sweep.length, timeMs: now() - t0 } };  // §3 #13: a 0-V-linearized sweep (DC op failed) is physically meaningless for any biased amp - must not report converged
  }

  return res(a as Analysis, [], "", "", { signals: {}, units: {} }, false, errors.concat({ severity: "error", message: "Unsupported analysis." }), log, 0, t0);
}

function updateReactiveHistory(ix: Indexer, els: NetlistElement[], x: number[], caps: Map<string, { vPrev: number; iPrev: number }>, inds: Map<string, { iPrev: number; vPrev: number }>, h: number, beStep: boolean, dCaps?: Map<string, { vPrev: number; iPrev: number; qPrev: number }>, tNow?: number) {
  // helper: read v(a) - v(c) from x, treating idx<0 as ground
  const vd = (a: number, c: number) => (a < 0 ? 0 : x[a]) - (c < 0 ? 0 : x[c]);
  for (const el of els) {
    if (el.type === "C") {
      // ESR cap: history must be the voltage across the CAP ITSELF, not the port (n1→n2)
      // - otherwise the next step's BE/Trap companion is anchored to the wrong reference
      // and the cap appears to spontaneously charge/discharge by I·R_esr every step.
      const useEsr = (el.esr ?? 0) > 0;
      const i1 = useEsr ? ix.internal(`Cint:${el.name}`) : ix.node(el.n1);
      const i2 = ix.node(el.n2);
      const vc = vd(i1, i2);
      const Geq = (el as any)._Geq, Ieq = (el as any)._Ieq;
      const iC = typeof Geq === "number" ? Geq * vc + Ieq : 0;
      (el as any)._iC = iC;
      caps.set(el.name, { vPrev: vc, iPrev: iC });
    } else if (el.type === "L") {
      const c = ix.branchOf.get(`L:${el.name}`); const iL = c !== undefined ? x[ix.nNodes + c] : 0;
      const i1 = ix.node(el.n1), i2 = ix.node(el.n2); const vL = (i1 < 0 ? 0 : x[i1]) - (i2 < 0 ? 0 : x[i2]);
      inds.set(el.name, { iPrev: iL, vPrev: vL });
    } else if (el.type === "T") {
      // Record the incident wave a = v + Z0·i leaving each port at this ACCEPTED timepoint.
      // Only accepted points may be recorded: a rejected Newton iterate written into the history
      // would be read back one delay later as though it had physically happened.
      const hist = (el as unknown as { _tlHist?: TLineHistory })._tlHist;
      if (hist && tNow !== undefined && isFinite(tNow)) {
        const c1 = ix.branchOf.get(`T1:${el.name}`), c2 = ix.branchOf.get(`T2:${el.name}`);
        const i1 = c1 !== undefined ? x[ix.nNodes + c1] : 0;
        const i2 = c2 !== undefined ? x[ix.nNodes + c2] : 0;
        const v1 = vd(ix.node(el.n1), ix.node(el.n2)), v2 = vd(ix.node(el.n3), ix.node(el.n4));
        // Guard against a non-monotonic push (a rescued step can re-solve the same instant):
        // the sampler's binary search relies on `t` being sorted.
        const last = hist.t.length - 1;
        if (last >= 0 && tNow <= hist.t[last]) {
          hist.p1[last] = v1 + el.z0 * i1;
          hist.p2[last] = v2 + el.z0 * i2;
        } else {
          hist.t.push(tNow);
          hist.p1.push(v1 + el.z0 * i1);
          hist.p2.push(v2 + el.z0 * i2);
        }
        // Drop points older than one delay — they can never be read again, and an unbounded
        // history is a memory leak on a long run. Keep a generous margin so interpolation
        // always has a point on BOTH sides of t − TD.
        const cutoff = tNow - el.td * 2 - 1e-18;
        let drop = 0;
        while (drop + 2 < hist.t.length && hist.t[drop + 1] < cutoff) drop++;
        if (drop > 0) { hist.t.splice(0, drop); hist.p1.splice(0, drop); hist.p2.splice(0, drop); }
      }
    }
    // OPAMP transient state - _vOutPrev tracks the actual converged output voltage so the
    // slew-rate clamp and the GBW dominant-pole LPF (see case "OPAMP" above) have a previous
    // value to reference. Without this, slew/gbw have no anchor and the model degenerates to
    // an instantaneous saturating VCVS.
    else if (el.type === "OPAMP") {
      // ANCHOR THE SLEW CLAMP TO THE NODE THE CLAMP ACTUALLY DRIVES.
      //
      // With rout > 0 the controlled branch drives the INTERNAL node `OPout:<name>`, and rout
      // sits between that and nOut - so the quantity the stamp clamps (`vSat`) is the INTERNAL
      // voltage. Recording the EXTERNAL node here made the clamp compare two different nodes,
      // separated by the load's I·rout drop. Whenever that drop exceeded one step's slew
      // allowance (slew·h) the clamp fired every single step and ratcheted the output down,
      // silently and without any error: a unity-gain buffer at 1 V with rout = 1 kΩ into a 1 kΩ
      // load and slew = 0.1 V/µs settled at 0.010 V instead of 1.000 V. With rout = 0 the two
      // nodes coincide, which is why the ideal case always looked fine.
      const drivenNode = el.rout > 1e-3 ? ix.internal(`OPout:${el.name}`) : ix.node(el.nOut);
      if (drivenNode >= 0) (el as { _vOutPrev?: number })._vOutPrev = x[drivenNode];
      // gm–C compensation-node history for the Backward-Euler companion.
      const xN = ix.internal(`OPx:${el.name}`);
      if (xN >= 0) (el as { _vxPrev?: number })._vxPrev = x[xN];
    }
    // Junction caps (Diode Cj, MOSFET overlap+bulk, BJT Cje+Cjc). Each stamp site pushes a
    // `{ key, na, nc, Geq, Ieq }` entry onto el._jcaps at the last Newton iter; here we
    // compute the converged cap voltage and current and persist them so the NEXT step's
    // companion model is correctly anchored. Without this loop, every junction cap behaved as
    // a single-step memoryless conductance - Miller effect, BJT τF, diode reverse recovery
    // all silently broken.
    if (dCaps) {
      const jcs = (el as { _jcaps?: { key: string; na: number; nc: number; Geq: number; Ieq: number }[] })._jcaps;
      if (jcs && jcs.length > 0) {
        for (const j of jcs) {
          const v = vd(j.na, j.nc);
          const iC = j.Geq * v + j.Ieq;
          dCaps.set(j.key, { vPrev: v, iPrev: iC, qPrev: 0 });
        }
      }
    }
  }
  // Switch hysteresis latches move only on an ACCEPTED timepoint - never inside Newton.
  commitSwitchStates(ix, els, x);
}

// ---------- AC (complex) ----------
/** Reserved for future per-analysis AC assembly variations.
 *
 *  It used to carry `parasitics`, which gated whether D.Rs / Q.Rb,Rc,Re / J.Rd,Rs were stamped;
 *  only .noise set it, so ORDINARY .ac silently modelled every device as having zero ohmic
 *  parasitics while .op/.dc/.tran modelled them. That made .ac disagree with the time domain
 *  about the same circuit (a diode with Rs = 50 Ω showed a 4.53 Ω small-signal impedance instead
 *  of 54.5 Ω). Those resistances are part of the device in every analysis, so they are now
 *  stamped unconditionally and the flag is gone. */
export interface ACAssemblyOpts { /* (no options at present) */ }

/** Assemble the complex MNA system for one frequency. Split out of solveAC so .noise can run an
 *  ADJOINT solve against the very same matrix (one transposed solve gives every noise source's
 *  transfer function to the output at once). */
export function assembleAC(ix: Indexer, els: NetlistElement[], O: SimOptions, f: number, lin: Record<string, any>,
  aopt: ACAssemblyOpts = {}): { A: Complex[][]; b: Complex[] } {
  const n = ix.size; const w = 2 * Math.PI * f;
  const A: Complex[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => ({ re: 0, im: 0 })));
  const b: Complex[] = Array.from({ length: n }, () => ({ re: 0, im: 0 }));
  const addRe = (i: number, j: number, v: number) => { if (i >= 0 && j >= 0) A[i][j].re += v; };
  const addIm = (i: number, j: number, v: number) => { if (i >= 0 && j >= 0) A[i][j].im += v; };
  const stampY2 = (na: number, nb: number, gre: number, gim: number) => {
    if (na >= 0) { A[na][na].re += gre; A[na][na].im += gim; }
    if (nb >= 0) { A[nb][nb].re += gre; A[nb][nb].im += gim; }
    if (na >= 0 && nb >= 0) { A[na][nb].re -= gre; A[na][nb].im -= gim; A[nb][na].re -= gre; A[nb][na].im -= gim; }
  };
  const N = (s: string) => ix.node(s);
  for (let i = 0; i < ix.nNodes; i++) A[i][i].re += O.gmin;
  for (const el of els) {
    if (el.type === "R") { const rv = el.value; const Re = (el as unknown as { _Reff?: number })._Reff ?? (Math.abs(rv) < 1e-12 ? (rv < 0 ? -1e-12 : 1e-12) : rv); stampY2(N(el.n1), N(el.n2), 1 / Re, 0); }  // §3 #5: use the TC1/TC2 temperature-scaled _Reff cached by the DC pre-solve (matches .op/.tran & readSignals) - was raw el.value, so a tempco R gave a different Bode corner than the time-domain result
    else if (el.type === "C") {
      // ESR and the parallel leakage are part of the capacitor in .op/.tran (see case "C" in
      // stampElement), so they have to be part of it here too. They were previously dropped,
      // which made .ac and .tran disagree about the SAME capacitor:
      //   • rpar is a plain DC-visible conductance - without it the .ac gain of an RC divider
      //     with a leaky cap was 1.0 where .op said 0.5.
      //   • ESR puts a ZERO at 1/(2π·ESR·C); above it a real capacitor stops rolling off and
      //     flattens at ESR/(R+ESR). Omitting it made a 100 mΩ-ESR bypass cap look ideal, so
      //     the .ac ripple/decoupling answer was optimistic by tens of dB (measured: −76 dB at
      //     1 MHz where the true, and the .tran, answer is −20.8 dB).
      const Cv = Math.max(Math.abs(el.value), 1e-18);
      const esr = Math.max(el.esr ?? 0, 0);
      const rpar = el.rpar && el.rpar > 0 ? el.rpar : 0;
      const a = N(el.n1), c = N(el.n2);
      if (rpar > 0) stampY2(a, c, 1 / rpar, 0);
      if (esr > 0) {
        // Same { n1 - Rser - Cint - C - n2 } topology precount/stampElement allocate.
        const internal = ix.internal(`Cint:${el.name}`);
        stampY2(a, internal, 1 / esr, 0);
        stampY2(internal, c, 0, w * Cv);
      } else {
        stampY2(a, c, 0, w * Cv);
      }
    }
    else if (el.type === "L") {
      const brow = ix.branch(`L:${el.name}`); const a = N(el.n1), c = N(el.n2);
      if (a >= 0) { A[a][brow].re += 1; A[brow][a].re += 1; }
      if (c >= 0) { A[c][brow].re -= 1; A[brow][c].re -= 1; }
      // Branch equation: v(a) − v(c) − (rser + jωL)·I = 0. `rser` is the winding DCR; it is in
      // the DC and transient stamps, and leaving it out here gave every inductor infinite Q -
      // an LC tank that rang forever in .ac while .tran correctly damped it.
      A[brow][brow].re -= Math.max(el.rser ?? 0, 0);
      A[brow][brow].im -= w * Math.max(Math.abs(el.value), 1e-15);
    }
    else if (el.type === "V") {
      const brow = ix.branch(`V:${el.name}`); const a = N(el.n1), c = N(el.n2);
      // Per-FIELD defaults: a netlist with {mag:1} and no phase must not yield NaN (which
      // would null the complex solve at every frequency and falsely report "singular").
      const ac: ACSpec = { mag: Number(el.ac?.mag) || 0, phase: Number(el.ac?.phase) || 0 };
      if (a >= 0) { A[a][brow].re += 1; A[brow][a].re += 1; }
      if (c >= 0) { A[c][brow].re -= 1; A[brow][c].re -= 1; }
      b[brow].re += ac.mag * Math.cos((ac.phase * Math.PI) / 180);
      b[brow].im += ac.mag * Math.sin((ac.phase * Math.PI) / 180);
    }
    else if (el.type === "I") { const a = N(el.n1), c = N(el.n2); const ac: ACSpec = { mag: Number(el.ac?.mag) || 0, phase: Number(el.ac?.phase) || 0 }; const re = ac.mag * Math.cos((ac.phase * Math.PI) / 180), im = ac.mag * Math.sin((ac.phase * Math.PI) / 180); if (a >= 0) { b[a].re -= re; b[a].im -= im; } if (c >= 0) { b[c].re += re; b[c].im += im; } }
    else if (el.type === "E") { const brow = ix.branch(`E:${el.name}`); const a = N(el.n1), c = N(el.n2); if (a >= 0) { A[a][brow].re += 1; A[brow][a].re += 1; } if (c >= 0) { A[c][brow].re -= 1; A[brow][c].re -= 1; } const p = N(el.nc1), q = N(el.nc2); if (p >= 0) A[brow][p].re -= el.gain; if (q >= 0) A[brow][q].re += el.gain; }
    else if (el.type === "OPAMP") {
      // AC OPAMP with optional GBW rolloff. The open-loop gain rolls off at -20dB/dec above
      // the dominant pole ωp = 2π·gbw/A0. We model the controlled-source gain as a complex
      //   A_eff(jω) = A0 · ωp / (ωp + jω)
      // Expanding: Re = A0·ωp² / (ωp² + ω²);  Im = -A0·ωp·ω / (ωp² + ω²).
      // When gbw is 0 / unspecified, fall back to the ideal flat-gain stamp (= el.gain).
      const brow = ix.branch(`OP:${el.name}`);
      const o = N(el.nOut);
      // rout: the controlled branch drives an INTERNAL node and rout goes from there to nOut -
      // the same Thévenin topology stampElement builds, and the same internal node precount
      // already allocated. This used to drive nOut directly and never stamp rout at all (the
      // comment claimed otherwise), so .ac saw an ideal zero-ohm output: an op-amp with
      // rout = 1 kΩ into a 1 kΩ load reported the full open-loop 1000 where .op said 500, and
      // the rout·Cload pole - the entire reason capacitive loads destabilise a follower - was
      // invisible (flat to 1 MHz where the real pole is at 1.6 kHz).
      const useRout = el.rout > 1e-3;
      const driven = useRout ? ix.internal(`OPout:${el.name}`) : o;
      if (driven >= 0) { A[driven][brow].re += 1; A[brow][driven].re += 1; }
      if (useRout) stampY2(driven, o, 1 / Math.max(el.rout, 1e-9), 0);
      const p = N(el.nInP), m = N(el.nInN);
      // LINEARIZE AT THE OPERATING POINT, not at the data-sheet open-loop gain.
      //
      // The DC stamp already computed this op-amp's incremental gain there — `gloc` = A·(1−tanh²u),
      // which equals A in the linear region and collapses to the slope floor once the output is
      // pinned at a rail — and prepareSmallSignal already captured it into `lin`. It was then
      // never read: .ac and .noise both stamped the full A0. A comparator or a latched-up stage
      // sitting hard against its rail was therefore reported with 100 dB of small-signal gain
      // when its actual incremental gain is ~0, which is how a saturated circuit gets a
      // confident Bode plot and a phase margin.
      //
      // The dominant POLE stays where the device puts it (ωp = 2π·GBW/A0 is set by the
      // compensation capacitor and the input gm, not by how hard the output is clipping), so
      // only the gain magnitude follows the operating point.
      const A0nom = Math.max(el.gain, 1);
      const A0 = Math.min((lin[el.name]?.gloc ?? el.gain), el.gain);
      const ω = 2 * Math.PI * f;
      let gRe = A0, gIm = 0;
      if (el.gbw && el.gbw > 0) {
        const ωp = (2 * Math.PI * el.gbw) / A0nom;
        const denom = ωp * ωp + ω * ω;
        gRe = (A0 * ωp * ωp) / denom;
        gIm = -(A0 * ωp * ω) / denom;
      }
      if (p >= 0) { A[brow][p].re -= gRe; A[brow][p].im -= gIm; }
      if (m >= 0) { A[brow][m].re += gRe; A[brow][m].im += gIm; }
      // rin across the inputs, matching the DC stamp. The old form required BOTH p >= 0 and
      // m >= 0, so it silently vanished whenever an input was grounded - which is the single
      // most common wiring of all (non-inverting input to ground). stampY2 handles a grounded
      // terminal correctly by stamping only the live diagonal, exactly as stampG2 does in DC.
      if (el.rin > 0 && el.rin < 1e11) stampY2(p, m, 1 / Math.max(el.rin, 1e-9), 0);
    }
    else if (el.type === "G") { const a = N(el.n1), c = N(el.n2), p = N(el.nc1), q = N(el.nc2), gm = el.gain; addRe(a, p, gm); addRe(a, q, -gm); addRe(c, p, -gm); addRe(c, q, gm); }
    else if (el.type === "F") { const mcol = ix.branch(`V:${el.vsrc}`); const a = N(el.n1), c = N(el.n2); if (a >= 0) A[a][mcol].re += el.gain; if (c >= 0) A[c][mcol].re -= el.gain; }
    else if (el.type === "H") { const brow = ix.branch(`H:${el.name}`); const mcol = ix.branch(`V:${el.vsrc}`); const a = N(el.n1), c = N(el.n2); if (a >= 0) { A[a][brow].re += 1; A[brow][a].re += 1; } if (c >= 0) { A[c][brow].re -= 1; A[brow][c].re -= 1; } A[brow][mcol].re -= el.gain; }
    else if (el.type === "D") {
      const L = lin[el.name] ?? {}; const gd = L.gd ?? O.gmin; const Cj = L.Cj ?? 0;
      const rs = el.model?.Rs ?? 0;
      const area = el.area && el.area > 0 ? el.area : 1;
      const ap = rs > 1e-9 ? ix.internal(`Dint:${el.name}`) : N(el.nA);
      if (rs > 1e-9) stampY2(N(el.nA), ap, 1 / Math.max(rs / area, 1e-9), 0);
      stampY2(ap, N(el.nK), gd, w * Cj);
    }
    else if (el.type === "M") {
      // small-signal: rds between D and S; gm·v_gs current from D to S; gmb·v_bs likewise.
      const L = lin[el.name] ?? {};
      const gds = L.gds ?? O.gmin, gm = L.gm ?? 0, gmb = L.gmb ?? 0;
      const d = N(el.nD), s = N(el.nS), g = N(el.nG), bn = N(el.nB);
      stampY2(d, s, gds, 0);
      // NO p-channel sign flip here. `_gm`/`_gmb` are stored in the NMOS-EQUIVALENT frame, and
      // the DC stamp (case "M") applies the polarity by SWAPPING the drain/source rows
      // (sD/sS) while ALSO negating gm - two sign changes that cancel. Working that stamp out
      // for a PMOS gives exactly the n-channel pattern below with a plain +gm:
      //     G[d][g] += gm   G[d][s] -= gm   G[s][g] -= gm   G[s][s] += gm
      // Multiplying by sgn here therefore negated a stamp that was already correct, and every
      // p-channel small-signal result came out 180° out of phase: a PMOS common-source stage
      // whose true gain is −3.600 was reported by .ac as +3.600, so Bode phase, loop gain and
      // phase margin were all inverted for any PMOS/p-JFET/p-VDMOS circuit.
      const gmS = gm, gmbS = gmb;
      if (d >= 0 && g >= 0)  A[d][g].re  += gmS;
      if (d >= 0 && s >= 0)  A[d][s].re  -= gmS;
      if (s >= 0 && g >= 0)  A[s][g].re  -= gmS;
      if (s >= 0 && s >= 0)  A[s][s].re  += gmS;
      if (d >= 0 && bn >= 0) A[d][bn].re += gmbS;
      if (d >= 0 && s >= 0)  A[d][s].re  -= gmbS;
      if (s >= 0 && bn >= 0) A[s][bn].re -= gmbS;
      if (s >= 0 && s >= 0)  A[s][s].re  += gmbS;
      // Overlap and junction caps AT THE OPERATING POINT (cached by the DC stamp). Cbd/Cbs used
      // to be read straight off the model card, i.e. their ZERO-BIAS values — but a MOSFET's
      // bulk junctions are reverse-biased in normal operation, where the real capacitance is
      // several times smaller, so every .ac put the drain/source junction poles too low.
      const Cgs = L.Cgs ?? el.model.Cgso * el.model.W;
      const Cgd = L.Cgd ?? el.model.Cgdo * el.model.W;
      const Cgb = L.Cgb ?? el.model.Cgbo * el.model.L;
      const Cbd = L.Cbd ?? el.model.Cbd, Cbs = L.Cbs ?? el.model.Cbs;
      if (Cgs > 0) stampY2(g, s, 0, w * Cgs);
      if (Cgd > 0) stampY2(g, d, 0, w * Cgd);
      if (Cgb > 0) stampY2(g, bn, 0, w * Cgb);
      if (Cbd > 0) stampY2(bn, d, 0, w * Cbd);
      if (Cbs > 0) stampY2(bn, s, 0, w * Cbs);
    }
    else if (el.type === "D2A") {
      // A digital output is a fixed level behind its output resistance: no small-signal source,
      // only the conductance it loads the node with at the operating point.
      const wv = d2aWaveOf(el);
      stampY2(N(el.n1), N(el.n2), wv ? wv.at(Number.NaN).g : 1 / Math.max(el.rout, 1e-6), 0);
    }
    else if (el.type === "T") {
      // A pure delay is multiplication by e^{−jωTD}, so the SAME Branin pair the transient uses
      // is exact in the frequency domain:
      //     V1 − Z0·I1 = e^{−jθ}(V2 + Z0·I2)      θ = ω·TD
      //     V2 − Z0·I2 = e^{−jθ}(V1 + Z0·I1)
      // Written this way rather than as Y-parameters deliberately: Y11 = −j·cot θ / Z0 is
      // singular at every multiple of a half wavelength, which is exactly where a line is most
      // interesting. These rows stay conditioned at every θ, and reproduce the textbook
      // Zin = −j·Z0·cot θ for an open-circuited line, which is the check the tests make.
      const bt1 = ix.branch(`T1:${el.name}`), bt2 = ix.branch(`T2:${el.name}`);
      const q1 = N(el.n1), q2 = N(el.n2), q3 = N(el.n3), q4 = N(el.n4);
      const z0 = Math.max(el.z0, 1e-6);
      const th = w * el.td;
      const er = Math.cos(th), ei = -Math.sin(th);
      const put = (row: number, col: number, cr: number, ci: number) => {
        if (row < 0 || col < 0) return;
        A[row][col].re += cr; A[row][col].im += ci;
      };
      // KCL — each port current leaves the "+" node and returns at the "−" node.
      put(q1, bt1, 1, 0); put(q2, bt1, -1, 0);
      put(q3, bt2, 1, 0); put(q4, bt2, -1, 0);
      // Branch row 1
      put(bt1, q1, 1, 0); put(bt1, q2, -1, 0); put(bt1, bt1, -z0, 0);
      put(bt1, q3, -er, -ei); put(bt1, q4, er, ei); put(bt1, bt2, -z0 * er, -z0 * ei);
      // Branch row 2
      put(bt2, q3, 1, 0); put(bt2, q4, -1, 0); put(bt2, bt2, -z0, 0);
      put(bt2, q1, -er, -ei); put(bt2, q2, er, ei); put(bt2, bt1, -z0 * er, -z0 * ei);
    }
    else if (el.type === "J") {
      // Small-signal JFET: rds across the channel, gm·v_gs from D to S, the two gate-junction
      // conductances, and Cgs/Cgd. The gate is NOT an open circuit here — ggs/ggd and the two
      // depletion caps are what set the input impedance the device is chosen for.
      const L = lin[el.name] ?? {};
      const gds = L.gds ?? O.gmin, gm = L.gm ?? 0;
      const ggs = L.ggs ?? O.gmin, ggd = L.ggd ?? O.gmin;
      const Cgs = L.Cgs ?? 0, Cgd = L.Cgd ?? 0;
      const mj = el.model;
      const areaJ = el.area && el.area > 0 ? el.area : 1;
      const useRd = mj.Rd > 1e-9, useRs = mj.Rs > 1e-9;
      const dJ = useRd ? ix.internal(`Jd:${el.name}`) : N(el.nD);
      const sJ = useRs ? ix.internal(`Js:${el.name}`) : N(el.nS);
      const gJ = N(el.nG);
      if (useRd) stampY2(N(el.nD), dJ, 1 / Math.max(mj.Rd / areaJ, 1e-9), 0);
      if (useRs) stampY2(N(el.nS), sJ, 1 / Math.max(mj.Rs / areaJ, 1e-9), 0);
      stampY2(dJ, sJ, gds, 0);
      // No p-channel sign flip - see the identical note in the "M" stamp above. The DC stamp
      // encodes p-channel polarity by swapping pD/pS AND negating gm; the two cancel, so the
      // correct AC stamp is the n-channel pattern with a plain +gm for both kinds.
      const gmS = gm;
      if (dJ >= 0 && gJ >= 0) A[dJ][gJ].re += gmS;
      if (dJ >= 0 && sJ >= 0) A[dJ][sJ].re -= gmS;
      if (sJ >= 0 && gJ >= 0) A[sJ][gJ].re -= gmS;
      if (sJ >= 0 && sJ >= 0) A[sJ][sJ].re += gmS;
      stampY2(gJ, sJ, ggs, w * Cgs);
      stampY2(gJ, dJ, ggd, w * Cgd);
    }
    else if (el.type === "Q") {
      // Small-signal (formulation-B). gpi=∂Ib/∂Vbe, gmu=∂Ib/∂Vbc, gm=∂Ic/∂Vbe, go=−∂Ic/∂Vbc.
      const L = lin[el.name] ?? {};
      const gpi = L.gpi ?? O.gmin, gm = L.gm ?? 0, go = L.go ?? O.gmin, gmu = L.gmu ?? 0;
      const m = el.model;
      // Parasitic Rb/Rc/Re: same prime-node topology the DC stamp uses (case "Q").
      const areaQ = el.area && el.area > 0 ? el.area : 1;
      const useRb = (m.Rb ?? 0) > 1e-9, useRc = (m.Rc ?? 0) > 1e-9, useRe = (m.Re ?? 0) > 1e-9;
      const bN = useRb ? ix.internal(`Qb:${el.name}`) : N(el.nB);
      const cN = useRc ? ix.internal(`Qc:${el.name}`) : N(el.nC);
      const eN = useRe ? ix.internal(`Qe:${el.name}`) : N(el.nE);
      if (useRb) stampY2(N(el.nB), bN, 1 / Math.max(m.Rb / areaQ, 1e-9), 0);
      if (useRc) stampY2(N(el.nC), cN, 1 / Math.max(m.Rc / areaQ, 1e-9), 0);
      if (useRe) stampY2(N(el.nE), eN, 1 / Math.max(m.Re / areaQ, 1e-9), 0);
      // Depletion capacitances AT THE OPERATING POINT (cached by the DC stamp), including `area`
      // scaling. These used to be the raw zero-bias model-card values, which for a normally
      // reverse-biased collector junction overstates Cjc by ~2.4x at −5 V and moves the Miller
      // pole and fT of every BJT amplifier.
      const Cje = L.Cje ?? m.Cje, Cjc = L.Cjc ?? m.Cjc;
      // Row B (current leaving B = Ib) - real part
      if (bN >= 0) {
        if (bN >= 0) A[bN][bN].re += gpi + gmu;
        if (eN >= 0) A[bN][eN].re -= gpi;
        if (cN >= 0) A[bN][cN].re -= gmu;
        // BE + BC junction caps add jω to the corresponding entries
        if (bN >= 0) A[bN][bN].im += w * (Cje + Cjc);
        if (eN >= 0) A[bN][eN].im -= w * Cje;
        if (cN >= 0) A[bN][cN].im -= w * Cjc;
      }
      // Row C (leaving C = Ic) - real part + Cjc contribution from BC cap (current leaves B, enters C)
      if (cN >= 0) {
        if (bN >= 0) A[cN][bN].re += (gm - go);
        if (eN >= 0) A[cN][eN].re -= gm;
        if (cN >= 0) A[cN][cN].re += go;
        if (bN >= 0) A[cN][bN].im -= w * Cjc;
        if (cN >= 0) A[cN][cN].im += w * Cjc;
      }
      // Row E (leaving E = -(Ib+Ic))
      if (eN >= 0) {
        if (bN >= 0) A[eN][bN].re -= (gpi + gmu + gm - go);
        if (eN >= 0) A[eN][eN].re += (gpi + gm);
        if (cN >= 0) A[eN][cN].re += (gmu - go);
        if (bN >= 0) A[eN][bN].im -= w * Cje;
        if (eN >= 0) A[eN][eN].im += w * Cje;
      }
    }
    else if (el.type === "B") {
      // Behavioral source - stamp the cached DC Jacobian as a small-signal admittance/gain.
      // No AC drive: B-sources don't accept AC mag/phase in v1 (use a V source for that).
      const L = lin[el.name] ?? { dV: {}, dI: {} };
      const dV: Record<string, number> = L.dV ?? {};
      const dI: Record<string, number> = L.dI ?? {};
      const a = N(el.n1), c = N(el.n2);
      const findBranchCol = (name: string): number | undefined => {
        for (const pre of ["V:", "L:", "E:", "H:", "B:"]) {
          const cb = ix.branchOf.get(pre + name);
          if (cb !== undefined) return ix.nNodes + cb;
        }
        return undefined;
      };
      if (el.ctrl === "V") {
        // Branch equation: v(a) − v(c) − Σ J_node·v(node) − Σ J_branch·i(branch) = 0  (small-signal)
        const brow = ix.branch(`B:${el.name}`);
        if (a >= 0) { A[a][brow].re += 1; A[brow][a].re += 1; }
        if (c >= 0) { A[c][brow].re -= 1; A[brow][c].re -= 1; }
        for (const node in dV) { const j = N(node); if (j >= 0) A[brow][j].re -= dV[node]; }
        for (const src in dI)  { const col = findBranchCol(src); if (col !== undefined) A[brow][col].re -= dI[src]; }
      } else {
        // Current mode: stamp Jacobian as VCCS-style entries on both n1 and n2 KCL rows.
        for (const node in dV) {
          const j = N(node), g = dV[node];
          if (a >= 0 && j >= 0) A[a][j].re += g;
          if (c >= 0 && j >= 0) A[c][j].re -= g;
        }
        for (const src in dI)  {
          const col = findBranchCol(src); if (col === undefined) continue;
          const g = dI[src];
          if (a >= 0) A[a][col].re += g;
          if (c >= 0) A[c][col].re -= g;
        }
      }
    }
    else if (el.type === "S" || el.type === "W") {
      // Small-signal switch: the bias conductance g, plus the control-port transconductance
      // gc = (dg/dVc)·V_switch. gc is what carries a modulated control into the switched branch;
      // at either rail (fully on / fully off) it is ~0 and the element degenerates to a resistor,
      // which is exactly right.
      const L = lin[el.name] ?? {};
      const g = L.g ?? O.gmin, gc = L.gc ?? 0;
      const a = N(el.n1), c = N(el.n2);
      stampY2(a, c, g, 0);
      if (el.type === "S") {
        const p = N(el.nc1), q = N(el.nc2);
        addRe(a, p, gc); addRe(a, q, -gc); addRe(c, p, -gc); addRe(c, q, gc);
      } else {
        const col = ix.branch(`V:${el.vsrc}`);
        if (a >= 0) A[a][col].re += gc;
        if (c >= 0) A[c][col].re -= gc;
      }
    }
    else if (el.type === "VDMOS") {
      // Small-signal VDMOS: channel (gm, gds) between the prime nodes, the body diode's
      // conductance and junction cap, Cgs and the bias-point Cgd. Rd/Rs/Rg use the same prime
      // nodes the DC stamp allocated, so the AC matrix sees the identical topology.
      const L = lin[el.name] ?? {};
      const mo = el.model;
      const gds = L.gds ?? O.gmin, gm = L.gm ?? 0, gdio = L.gdio ?? O.gmin;
      const Cgd = L.Cgd ?? 0, Cgs = L.Cgs ?? 0, Cj = L.Cj ?? 0;
      const dE = N(el.nD), gE = N(el.nG), sE = N(el.nS);
      const useRd = mo.Rd > 1e-9, useRs = mo.Rs > 1e-9, useRg = mo.Rg > 1e-9;
      const d = useRd ? ix.internal(`VDd:${el.name}`) : dE;
      const s = useRs ? ix.internal(`VDs:${el.name}`) : sE;
      const g = useRg ? ix.internal(`VDg:${el.name}`) : gE;
      if (useRd) stampY2(dE, d, 1 / mo.Rd, 0);
      if (useRs) stampY2(sE, s, 1 / mo.Rs, 0);
      if (useRg) stampY2(gE, g, 1 / mo.Rg, 0);
      if (mo.Rds > 0) stampY2(d, s, 1 / mo.Rds, 0);
      const sgn = mo.kind === "vdmos-p" ? -1 : 1;   // still needed to orient the body diode
      stampY2(d, s, gds, 0);
      // No p-channel sign flip - see the note in the "M" stamp above.
      const gmS = gm;
      if (d >= 0 && g >= 0) A[d][g].re += gmS;
      if (d >= 0 && s >= 0) A[d][s].re -= gmS;
      if (s >= 0 && g >= 0) A[s][g].re -= gmS;
      if (s >= 0) A[s][s].re += gmS;
      const anodeExt = sgn > 0 ? s : d, cathodeExt = sgn > 0 ? d : s;
      const useRb = mo.Rb > 1e-9;
      const anode = useRb ? ix.internal(`VDb:${el.name}`) : anodeExt;
      if (useRb) stampY2(anodeExt, anode, 1 / mo.Rb, 0);
      stampY2(anode, cathodeExt, gdio, w * Cj);
      if (Cgs > 0) stampY2(g, s, 0, w * Cgs);
      if (Cgd > 0) stampY2(g, d, 0, w * Cgd);
    }
    else if (el.type === "K") {
      // mutual coupling: introduces a cross term −jωM between the two L-branch unknowns
      const b1 = ix.branch(`L:${el.l1}`), b2 = ix.branch(`L:${el.l2}`);
      const u1 = el.l1.toUpperCase(), u2 = el.l2.toUpperCase();
      const Lp1 = els.find(e => e.type === "L" && e.name.toUpperCase() === u1) as any;
      const Lp2 = els.find(e => e.type === "L" && e.name.toUpperCase() === u2) as any;
      if (Lp1 && Lp2) {
        const M = Math.max(-1, Math.min(1, el.k)) * Math.sqrt(Math.max(Math.abs(Lp1.value), 1e-15) * Math.max(Math.abs(Lp2.value), 1e-15));
        A[b1][b2].im -= w * M;
        A[b2][b1].im -= w * M;
      }
    }
  }
  return { A, b };
}

/** Solve one AC frequency point. Thin wrapper over assembleAC - unchanged behaviour. */
function solveAC(ix: Indexer, els: NetlistElement[], O: SimOptions, f: number, lin: Record<string, any>): Complex[] | null {
  const { A, b } = assembleAC(ix, els, O, f, lin);
  return solveComplex(A, b);
}
function readComplexSignals(ix: Indexer, els: NetlistElement[], x: Complex[]): { v: Record<string, Complex>; units: Record<string, string> } {
  const v: Record<string, Complex> = {}; const units: Record<string, string> = {};
  for (const [name, i] of ix.nodeIndex) { if (i >= 0) { v[`V(${name})`] = x[i]; units[`V(${name})`] = "V"; } }
  v["V(0)"] = { re: 0, im: 0 };
  for (const el of els) {
    if (el.type === "V" || el.type === "L") { const key = el.type === "V" ? `V:${el.name}` : `L:${el.name}`; const c = ix.branchOf.get(key); if (c !== undefined) { v[`I(${el.name})`] = x[ix.nNodes + c]; units[`I(${el.name})`] = "A"; } }
  }
  return { v, units };
}

// ---------- helpers ----------
function now() { return typeof performance !== "undefined" ? performance.now() : Date.now(); }
function res(a: Analysis, sweep: number[], sweepName: string, sweepUnit: string, sg: { signals: Record<string, number[]>; units: Record<string, string>; components?: Record<string, ComponentReadout> }, converged: boolean, errors: SimError[], log: string[], matrixSize: number, t0: number, iters?: number): SimResult {
  return { analysis: a, title: titleOf(a), sweepName, sweepUnit, sweep, complex: false, signals: sg.signals, units: sg.units, log, errors, converged, stats: { matrixSize, points: sweep.length, iterations: iters, timeMs: now() - t0 }, ...(sg.components ? { components: sg.components } : {}) };
}

/** Per-component analytical readouts (power, region) at the converged DC operating point.
 *  Surface for the Inspector's Operating-point section. The values here are computed from the
 *  same scratch state the engine already attaches to each element during stamping. */
function computeComponentReadouts(els: NetlistElement[], ix: Indexer, x: number[]): Record<string, ComponentReadout> {
  // Engine's Indexer uses `nodeIndex` (Map<string, number>) for node-name→matrix-row lookup.
  const nodeOf = (n: string): number => (n === "0" ? -1 : ((ix as unknown as { nodeIndex: Map<string, number> }).nodeIndex.get(n) ?? -1));
  const v = (n: string) => { const i = nodeOf(n); return i < 0 ? 0 : (x[i] ?? 0); };
  const out: Record<string, ComponentReadout> = {};
  for (const el of els) {
    const ro: ComponentReadout = {};
    switch (el.type) {
      case "R": {
        const r = el as unknown as { n1: string; n2: string; value: number; _Reff?: number };
        const dv = v(r.n1) - v(r.n2);
        const Re = r._Reff ?? (Math.abs(r.value) < 1e-12 ? (r.value < 0 ? -1e-12 : 1e-12) : r.value);
        const i = dv / Re;  // signed + temperature-scaled (uses _Reff cached by the R stamp)
        ro.power = Math.abs(dv * i);
        break;
      }
      case "D": {
        const d = el as unknown as { nA: string; nK: string; _Id?: number };
        const i = d._Id ?? 0;
        const dv = v(d.nA) - v(d.nK);
        ro.power = Math.abs(dv * i);
        break;
      }
      case "M": {
        const m = el as unknown as { nD: string; nS: string; _Id?: number; _region?: number };
        const Vds = v(m.nD) - v(m.nS);
        const Id = m._Id ?? 0;
        ro.power = Math.abs(Vds * Id);
        // Reuse the stamp's verdict (0=cutoff, 1=subthreshold, 2=triode, 3=saturation), which was
        // decided in the NMOS-equivalent frame on the exact overdrive the small-signal model was
        // linearised on — the same rule the J and VDMOS cases below follow, so the readout can
        // never disagree with the numbers beside it.
        //
        // The previous code compared this NUMBER against the STRINGS "cutoff"/"triode"/
        // "saturation", so the comparison was dead and the fallback always ran; and the fallback
        // read `kind` off the ELEMENT, where it does not exist (it lives on `el.model`), so `isP`
        // was always false. For a PMOS that made Vgst = Vgs − Vth negative (both terms are
        // negative) and EVERY conducting PMOS was reported as "cutoff".
        const rg = m._region;
        ro.region = rg === 0 || rg === 1 ? "cutoff" : rg === 2 ? "triode" : rg === 3 ? "saturation" : undefined;
        break;
      }
      case "J": {
        const j = el as unknown as { nD: string; nS: string; _Id?: number; _region?: number };
        const Id = j._Id ?? 0;
        ro.power = Math.abs((v(j.nD) - v(j.nS)) * Id);
        // The stamp already decided the region from the exact overdrive it linearised on, so
        // reuse its verdict rather than re-deriving one that could disagree with it.
        ro.region = j._region === 0 ? "cutoff" : j._region === 2 ? "triode" : "saturation";
        break;
      }
      case "Q": {
        const q = el as unknown as { nC: string; nB: string; nE: string; _Ic?: number; _Ib?: number; _region?: number };
        const Vce = v(q.nC) - v(q.nE);
        const Vbe = v(q.nB) - v(q.nE);
        const Ic = q._Ic ?? 0;
        const Ib = q._Ib ?? 0;
        ro.power = Math.abs(Vce * Ic + Vbe * Ib);
        // Reuse the stamp's verdict (0=cutoff, 1=forward-active, 2=saturation, 3=reverse), taken
        // in the NPN-equivalent frame from the junction conductances it actually linearised on.
        //
        // This used to re-derive the region from terminal voltages and a `kind` field read off
        // the ELEMENT — but `kind` lives on `el.model`, so `isP` was always false. For a PNP,
        // Vbe and Vbc are both negative, both fell below the +0.4 V "on" threshold, and EVERY
        // PNP — conducting or not — was reported as "cutoff".
        const rg = q._region;
        ro.region = rg === 0 ? "cutoff" : rg === 1 ? "forward-active" : rg === 2 ? "saturation" : rg === 3 ? "reverse" : undefined;
        break;
      }
      case "S": case "W": {
        // Conduction loss in the switch: i²·Ron while closed, v²/Roff while open. Both are real
        // dissipation and both are what decides a converter's efficiency, so report the full
        // v·i product rather than only the on-state term.
        const sw = el as unknown as { n1: string; n2: string; _g?: number };
        const dv = v(sw.n1) - v(sw.n2);
        const g = sw._g;
        if (typeof g === "number") ro.power = Math.abs(dv * dv * g);
        break;
      }
      case "VDMOS": {
        const q = el as unknown as { nD: string; nS: string; _Id?: number; _Idiode?: number; _Vdiode?: number; _region?: number };
        const Vds = v(q.nD) - v(q.nS);
        const Id = q._Id ?? 0;
        // Channel conduction + body-diode conduction. Switching (capacitive) loss is a
        // time-domain quantity and is deliberately NOT folded into this DC-frame readout.
        ro.power = Math.abs(Vds * Id) + Math.abs((q._Vdiode ?? 0) * (q._Idiode ?? 0));
        const rg = q._region;
        ro.region = rg === 0 || rg === 1 ? "cutoff" : rg === 2 ? "triode" : rg === 3 ? "saturation" : undefined;
        break;
      }
      case "V": case "I": case "C": case "L": case "E": case "F": case "G": case "H": case "K": case "OPAMP": case "B": case "X": {
        // Power on sources / reactive / dependent / black-box: leave blank - meaning differs
        // by topology context (source delivers vs absorbs depending on direction).
        break;
      }
    }
    if (ro.power != null || ro.region != null) out[el.name] = ro;
  }
  return out;
}
