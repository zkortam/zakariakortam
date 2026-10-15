/** Types for the simulation engine: the netlist it consumes and the results it produces. */

export interface Complex { re: number; im: number; }
export const cAdd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
export const cMul = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
export const cAbs = (a: Complex): number => Math.hypot(a.re, a.im);
export const cPhaseDeg = (a: Complex): number => (Math.atan2(a.im, a.re) * 180) / Math.PI;

export type TransientSource =
  | { kind: "dc"; v: number }
  | { kind: "pulse"; v1: number; v2: number; td: number; tr: number; tf: number; pw: number; per: number; ncycles?: number }
  | { kind: "sin"; voff: number; vamp: number; freq: number; td: number; theta: number; phase: number }
  | { kind: "pwl"; points: [number, number][] }
  | { kind: "exp"; v1: number; v2: number; td1: number; tau1: number; td2: number; tau2: number }
  | { kind: "sffm"; voff: number; vamp: number; fc: number; mdi: number; fs: number }
  | { kind: "am"; vamp: number; voff: number; fm: number; fc: number; td: number };

export interface ACSpec { mag: number; phase: number; }

/** SPICE3-style diode model - exponential I-V, junction capacitance, reverse breakdown, temperature scaling. */
export interface DiodeModel {
  Is: number;       // saturation current
  N: number;        // emission coefficient
  Rs: number;       // series resistance
  Cjo: number;      // zero-bias junction capacitance
  Vj: number;       // junction (built-in) potential
  M: number;        // grading coefficient
  Bv: number;       // reverse breakdown voltage (0 = ideal, no breakdown)
  Ibv: number;      // breakdown knee current
  Tnom: number;     // nominal temperature (°C) the parameters were extracted at
  XTI: number;      // saturation-current temperature exponent (3 for pn junction)
  Eg: number;       // bandgap energy at 300 K (eV; 1.11 Si, 0.67 Ge)
  // Flicker (1/f) noise, SPICE3 form: S_i(f) = KF·|Id|^AF / f  [A²/Hz]. Consumed ONLY by
  // .noise (src/lib/sim/noise.ts). Optional so every existing DiodeModel literal still
  // type-checks; absent ⇒ 0 ⇒ no flicker noise (never a silent fabricated floor).
  Kf?: number;
  Af?: number;
}

/** Shichman-Hodges Level 1 + body effect + subthreshold + simple overlap capacitances. */
export interface MosModel {
  kind: "nmos" | "pmos";
  Vto: number;       // zero-bias threshold (NMOS positive, PMOS negative)
  Kp: number;        // transconductance parameter (µ*Cox)
  Lambda: number;    // channel-length modulation
  Gamma: number;     // body-effect coefficient √V
  Phi: number;       // surface inversion potential (2|φF|), V
  W: number;         // width
  L: number;         // length
  Cgso: number;      // gate-source overlap capacitance per metre of width
  Cgdo: number;      // gate-drain overlap capacitance per metre of width
  Cgbo: number;      // gate-bulk overlap capacitance per metre of length
  Cbd: number;       // bulk-drain zero-bias capacitance
  Cbs: number;       // bulk-source zero-bias capacitance
  Pb: number;        // bulk junction built-in potential
  Mj: number;        // bulk junction grading coefficient
  Tnom: number;      // nominal temperature
  // Flicker (1/f) noise, SPICE3 MOS1 form:  S_id(f) = KF·|Id|^AF / (Cox·L²·f)   [A²/Hz].
  // Used by .noise (src/lib/sim/noise.ts). KF=0 (the default) disables flicker entirely.
  Kf: number;        // flicker noise coefficient
  Af: number;        // flicker noise exponent
  /** Gate-oxide capacitance per unit area (F/m²). Only the flicker-noise term needs it.
   *  Optional: when absent, noise.ts derives it from Kp with an EXPLICIT mobility assumption
   *  and says so in the result notes rather than silently inventing a number. */
  Cox?: number;
  Nsubvt: number;    // subthreshold slope factor (1 = ideal, real ~1.3–2)
}

/**
 * SPICE3 JFET (`NJF` / `PJF`) — Shichman-Hodges square law plus the two gate junctions.
 *
 * The gate of a JFET is a REVERSE-BIASED DIODE, not an oxide, and that is the whole character of
 * the device: it conducts at zero gate drive (depletion mode, `Vto` < 0 for n-channel), it is
 * pinched off by pulling the gate negative, and forward-biasing the gate clamps the input at a
 * diode drop. Modelling the junctions rather than treating the gate as an open circuit is what
 * makes the clamp, the gate leakage and the input capacitance come out right — those are the
 * reasons a JFET is chosen over a MOSFET in the first place.
 *
 * `Beta` is the full transconductance parameter (A/V²): Id_sat = Beta·(Vgs−Vto)². Unlike the
 * MOSFET there is no W/L, because a JFET is characterised from its datasheet transfer curve
 * (Idss and Vgs(off)) rather than from a drawn geometry: Beta = Idss / Vto².
 */
export interface JfetModel {
  kind: "njf" | "pjf";
  Vto: number;       // pinch-off / gate cutoff voltage (NEGATIVE for n-channel depletion devices)
  Beta: number;      // transconductance parameter, A/V²
  Lambda: number;    // channel-length modulation, 1/V
  Rd: number;        // drain ohmic resistance (Ω)
  Rs: number;        // source ohmic resistance (Ω)
  Cgs: number;       // zero-bias gate-source junction capacitance (F)
  Cgd: number;       // zero-bias gate-drain junction capacitance (F)
  Pb: number;        // gate junction built-in potential (V)
  Is: number;        // gate junction saturation current (A)
  N: number;         // gate junction emission coefficient
  Fc: number;        // forward-bias depletion-capacitance coefficient
  Tnom: number;      // temperature the parameters were extracted at (°C)
  // Flicker noise on the drain current, SPICE3 form: S_id(f) = KF·|Id|^AF / f  [A²/Hz].
  // 0 (the default) disables it — an unfitted 1/f corner would be a fabricated number.
  Kf: number;
  Af: number;
}

/** Ebers-Moll injection model with forward/reverse Early voltage. */
export interface BjtModel {
  kind: "npn" | "pnp";
  Is: number;        // saturation current
  Bf: number;        // forward beta
  Br: number;        // reverse beta
  Ne: number;        // BE emission coefficient
  Nc: number;        // BC emission coefficient
  Vaf: number;       // forward Early voltage (0 ⇒ infinite)
  Var: number;       // reverse Early voltage (0 ⇒ infinite)
  Rb: number;        // base resistance
  Rc: number;        // collector resistance
  Re: number;        // emitter resistance
  Cje: number;       // BE zero-bias depletion capacitance
  Vje: number;       // BE built-in potential
  Mje: number;       // BE grading
  Cjc: number;       // BC zero-bias depletion capacitance
  Vjc: number;       // BC built-in potential
  Mjc: number;       // BC grading
  Tnom: number;
  XTI: number;
  XTB: number;       // forward/reverse beta temperature exponent
  Eg: number;
  // Flicker noise on the BASE current, SPICE3 form: S_ib(f) = KF·|Ib|^AF / f  [A²/Hz].
  // Optional (absent ⇒ 0) so existing BjtModel literals keep type-checking.
  Kf?: number;
  Af?: number;
}

/**
 * SPICE `S` (voltage-controlled) / `W` (current-controlled) switch.
 *
 *   .model SW  SW (Ron=… Roff=… Vt=… Vh=… [Vtr=…])
 *   .model CSW CSW(Ron=… Roff=… It=… Ih=… [Itr=…])
 *
 * `Vt`/`Vh` carry the threshold and hysteresis half-width in VOLTS for an S element and in
 * AMPERES for a W element (SPICE spells them It/Ih there; the field names are shared because
 * the maths is identical).
 *
 * SEMANTICS THE ENGINE GUARANTEES (see engine.ts `switchGeometry`):
 *   • the switch turns ON around control = Vt+Vh and OFF around control = Vt−Vh — the SPICE
 *     hysteresis definition. While open the transition is centred on Vt+Vh; while closed, on
 *     Vt−Vh. A control excursion that stays INSIDE [Vt−Vh, Vt+Vh] therefore leaves the switch
 *     where it was, which is the whole point of hysteresis.
 *   • the conductance moves SMOOTHLY through the threshold (a logistic in log-conductance), so
 *     the Newton Jacobian is continuous. A hard Ron/Roff step is what makes SPICE3's own SW
 *     model notorious for non-convergence, and a converter that will not converge is useless.
 *   • the latch flips only once the transition has completed, so re-centring it on the opposite
 *     threshold never steps the conductance.
 *   • `Vtr` is the transition half-width (the logistic's e-folding scale). Absent ⇒ Vh/8 when
 *     hysteretic, else 5 % of |Vt| (floored so a Vt=0 switch still has a finite, physical
 *     transition). It is never 0: an infinitely sharp switch is neither physical nor solvable.
 */
export interface SwitchModel {
  kind: "vswitch" | "iswitch";
  Ron: number;       // on-state resistance (Ω)
  Roff: number;      // off-state resistance (Ω)
  Vt: number;        // threshold  (V for S, A for W)
  Vh: number;        // hysteresis half-width (V for S, A for W); 0 ⇒ no latch
  /** Transition half-width. Optional: derived from Vh/Vt when absent. Never 0. */
  Vtr?: number;
}

/**
 * VDMOS — LTspice's de-facto-standard power-MOSFET model. Three terminals (D G S); the bulk is
 * tied to the source internally, as it is in every real vertical-DMOS die, and the resulting
 * body diode is an INTRINSIC part of the device (it carries the freewheeling current in every
 * synchronous converter — omitting it makes those circuits silently wrong).
 *
 * Unlike the Level-1 `M` model there is no W/L: `Kp` IS the full transconductance parameter
 * (A/V²), because a power MOSFET is characterised from its datasheet transfer curve, not from
 * a drawn geometry.
 */
export interface VdmosModel {
  kind: "vdmos-n" | "vdmos-p";
  Vto: number;       // gate threshold (positive for n-channel, negative for p-channel)
  Kp: number;        // transconductance parameter, A/V² (Id_sat = Kp/2·(Vgs−Vto)²)
  Lambda: number;    // channel-length modulation, 1/V
  Rd: number;        // drain series resistance (Ω) — the bulk of Rds(on) in a real VDMOS
  Rs: number;        // source series resistance (Ω)
  Rg: number;        // gate series resistance (Ω) — sets the gate-drive time constant with Ciss
  Rds: number;       // drain-source shunt resistance (Ω); ≤0 ⇒ omitted (infinite)
  Cgs: number;       // gate-source capacitance (F), bias-independent
  Cgdmax: number;    // gate-drain capacitance with the channel accumulated (drain low), F
  Cgdmin: number;    // gate-drain capacitance with the drain depleted (drain high), F
  Cgda: number;      // sharpness of the Cgd(Vgd) transition, 1/V (LTspice's `a`)
  Nsubvt: number;    // subthreshold slope factor (smooths the Vto knee; 1 = ideal)
  Tnom: number;      // temperature the parameters were extracted at (°C)
  /** Body-diode series resistance (LTspice `Rb`), Ω. 0 ⇒ no internal node allocated. */
  Rb: number;
  /** The intrinsic body diode (source→drain for n-channel). `Rs` inside is unused: use `Rb`. */
  body: DiodeModel;
}

/** Mutual coupling between two inductors: M = k * sqrt(L1·L2). */
export interface MutualCouple { name: string; l1: string; l2: string; k: number; }

export type NetlistElement =
  | { type: "R"; name: string; n1: string; n2: string; value: number; tc1?: number; tc2?: number; tnom?: number }
  | { type: "C"; name: string; n1: string; n2: string; value: number; ic?: number; esr?: number; rpar?: number }
  | { type: "L"; name: string; n1: string; n2: string; value: number; ic?: number; rser?: number }
  | { type: "V"; name: string; n1: string; n2: string; dc: number; ac?: ACSpec; tran?: TransientSource }
  | { type: "I"; name: string; n1: string; n2: string; dc: number; ac?: ACSpec; tran?: TransientSource }
  | { type: "D"; name: string; nA: string; nK: string; model: DiodeModel; area?: number }
  | { type: "E"; name: string; n1: string; n2: string; nc1: string; nc2: string; gain: number }  // VCVS
  | { type: "G"; name: string; n1: string; n2: string; nc1: string; nc2: string; gain: number }  // VCCS
  | { type: "F"; name: string; n1: string; n2: string; vsrc: string; gain: number }               // CCCS (current through V-source vsrc)
  | { type: "H"; name: string; n1: string; n2: string; vsrc: string; gain: number }               // CCVS
  | { type: "OPAMP"; name: string; nOut: string; nInP: string; nInN: string; gain: number; vmax: number; vmin: number; rin: number; rout: number; slew: number; gbw: number } // saturating, finite Z, finite GBW
  | { type: "M"; name: string; nD: string; nG: string; nS: string; nB: string; model: MosModel }
  | { type: "Q"; name: string; nC: string; nB: string; nE: string; model: BjtModel; area?: number }
  | { type: "K"; name: string; l1: string; l2: string; k: number }
  // Subcircuit instance. Resolved before the engine sees the netlist: src/lib/sim/subckt.ts
  // expandSubckts() rewrites every X into mangled-node primitive elements. The engine never
  // stamps an X directly - if one survives expansion it's an undefined-subckt error.
  | { type: "X"; name: string; subcktName: string; nodes: string[] }
  // Behavioral source: V={expr} or I={expr} where expr is a function of V(node), V(a,b),
  // I(Vsrc), time, and built-ins (exp/log/sqrt/sin/cos/tan/tanh/abs/min/max/pow/if/limit/pwl).
  // Compiled by src/lib/sim/bsource.ts; stamped nonlinearly with a finite-difference Jacobian
  // (see engine.ts case "B"). ctrl="V" => voltage-mode (adds a branch unknown); "I" => current.
  | { type: "B"; name: string; n1: string; n2: string; ctrl: "V" | "I"; expr: string }
  // Voltage-controlled switch (SPICE `S`): S<name> n+ n- nc+ nc- <model>
  | { type: "S"; name: string; n1: string; n2: string; nc1: string; nc2: string; model: SwitchModel }
  // Current-controlled switch (SPICE `W`): W<name> n+ n- <vsrc> <model>
  | { type: "W"; name: string; n1: string; n2: string; vsrc: string; model: SwitchModel }
  // Power MOSFET (LTspice VDMOS): 3 terminals, intrinsic body diode, nonlinear Cgd.
  | { type: "VDMOS"; name: string; nD: string; nG: string; nS: string; model: VdmosModel }
  // JFET (SPICE `J`): J<name> nD nG nS <model>. Square-law channel + two gate junctions.
  | { type: "J"; name: string; nD: string; nG: string; nS: string; model: JfetModel; area?: number }
  // Ideal lossless transmission line (SPICE `T`): T<name> n1 n2 n3 n4 Z0=… TD=…
  // Port 1 is (n1,n2), port 2 is (n3,n4). Stamped by Branin's method: each port sees its own
  // characteristic resistance in series with a source carrying the far end's state delayed by TD.
  | { type: "T"; name: string; n1: string; n2: string; n3: string; n4: string; z0: number; td: number }
  // Digital-to-analog bridge: drives node n1 (against n2) from digital signals of the event-
  // driven simulator (see mixed.ts). The output is a Thevenin source in series with `rout`:
  // level = v0 + code·vstep, where `code` is the unsigned value of `bits` (LSB first). A change
  // of level is a linear ramp, never a step: `tr` for a full-swing rise, `tf` for a full-swing
  // fall, scaled by the fraction of the swing actually travelled. X drives `vundef`; Z (every
  // bit Z) ramps the output conductance down to 1/roff over the same time.
  | { type: "D2A"; name: string; n1: string; n2: string; bits: string[]; v0: number; vstep: number; vundef: number; rout: number; roff: number; tr: number; tf: number };

// ---------- digital logic coupled to the analog solver (see src/lib/sim/mixed.ts) ----------

/**
 * Analog-to-digital bridge: watches V(node) − V(ref) and drives digital `signal` with
 * hysteresis. It reads 1 once the voltage reaches `vhi` and 0 once it falls to `vlo`; between
 * the two it keeps its state. It loads nothing: an input's resistance and capacitance, when a
 * part has them, are ordinary R and C elements in the netlist.
 */
export interface A2DBridge { name: string; node: string; ref: string; vhi: number; vlo: number; signal: string; }

/** One digital part, in terms of digital signal names (all 1 bit). `null` = unconnected. */
export interface DigitalPartSpec {
  kind: string;
  name: string;
  /** Schematic reference designator the part came from, carried into causality records. */
  ref?: string;
  ins: Record<string, string | null>;
  outs: Record<string, string | null>;
  params?: Record<string, number | string | boolean>;
}

export interface DigitalNetSpec {
  name: string;
  /** Driven from outside the digital design (an analog-to-digital bridge output). */
  host?: boolean;
}

/** A logic analyzer instrument: named channels, each a digital signal. */
export interface AnalyzerSpec { name: string; channels: { label: string; signal: string }[]; }
/** A 7-segment display: the signals on segments a..g and dp (null = unconnected). */
export interface DisplaySpec { name: string; kind: "seg7"; segs: (string | null)[]; }

export interface DigitalDesign {
  nets: DigitalNetSpec[];
  parts: DigitalPartSpec[];
  a2d: A2DBridge[];
  analyzers?: AnalyzerSpec[];
  displays?: DisplaySpec[];
  /** Signal name → the schematic net it stands for (absent when they are the same). */
  netOf?: Record<string, string>;
}

/** The recorded history of one digital signal. `t` in seconds, strictly increasing, starting
 *  at 0; `v[i]` (MSB first, characters 0 1 x z) holds from t[i] until t[i+1]. */
export interface DigitalTrace { name: string; width: number; t: number[]; v: string[]; net?: string; }

export interface DigitalResult {
  traces: DigitalTrace[];
  analyzers: AnalyzerSpec[];
  displays: DisplaySpec[];
  stats: { events: number; steps: number; crossings: number; d2aEdges: number };
}

export type AnalysisKind = "op" | "dc" | "tran" | "ac" | "noise";
export type Analysis =
  | { kind: "op" }
  | { kind: "dc"; src: string; start: number; stop: number; step: number }
  | { kind: "tran"; tstep: number; tstop: number; tstart: number; uic: boolean; dtmax?: number }
  | { kind: "ac"; sweep: "lin" | "dec" | "oct"; n: number; fstart: number; fstop: number }
  // Small-signal noise. `out` is the output node, `ref` the reference node it is measured
  // against (default ground), `src` the independent source the result is input-referred to.
  // The frequency grid is specified exactly as for .ac.
  | { kind: "noise"; out: string; ref?: string; src: string; sweep: "lin" | "dec" | "oct"; n: number; fstart: number; fstop: number };

// ---------- parameter / temperature stepping ----------
export type StepMode = "lin" | "dec" | "oct" | "list";
/** One `.step` (or `.temp`) sweep axis.
 *
 *  `values` is authoritative - lin/dec/oct/list are all expanded into it by the parser, so the
 *  engine never has to re-derive a grid (and can never disagree with what the user was told).
 *  `refdes`/`start`/`stop`/`step` are retained for the legacy single-axis linear form. */
export interface StepSpec {
  /** What the axis varies:
   *   "device" - a component's `value` (passives) or `dc` (sources)
   *   "param"  - a `.param` name; every element value bound to that param is rewritten
   *   "temp"   - the global simulation temperature in °C */
  what: "device" | "param" | "temp";
  /** Refdes, param name, or the literal "temp". Named `refdes` for backwards compatibility. */
  refdes: string;
  mode: StepMode;
  values: number[];
  start: number; stop: number; step: number;
}

/** A `.param NAME=value` binding that an element value was resolved from. `.step param NAME …`
 *  rewrites `field` on `refdes` at every sweep point - this is what makes stepping a .param
 *  (rather than a single refdes) possible without re-running the netlister. */
export interface ParamBinding { param: string; refdes: string; field: "value" | "dc"; }

export interface Netlist {
  elements: NetlistElement[];
  nodes: string[];           // distinct node names, excluding ground "0"
  analyses: Analysis[];
  errors: SimError[];
  /** Per-doc SimOptions overrides parsed from `.options reltol=… abstol=… gmin=… method=…`. */
  options?: Partial<SimOptions>;
  /** Initial conditions from `.ic V(node)=value`. Applied after the t=0 solve in transient. */
  ics?: { node: string; value: number }[];
  /** The OUTER `.step` axis (== steps[0]). Kept as its own field because callers and tests
   *  read `nl.step.refdes`. Undefined → no parameter sweep (default path). */
  step?: StepSpec;
  /** All `.step` axes, outermost first (max 2 - nested sweeps beyond 2 levels are refused by
   *  the parser rather than silently dropped). The engine emits ONE SimResult per base
   *  analysis with signals suffixed by `[<name>=<value>]` per axis, so a Bode dock can
   *  overlay the whole family on a single canvas. */
  steps?: StepSpec[];
  /** `.nodeset V(node)=value` - an INITIAL GUESS for the DC solve (not a constraint). Used to
   *  pick a branch on bistable circuits (latches, comparators, bandgap startup). */
  nodesets?: { node: string; value: number }[];
  /** Element values that came from a `.param`; lets `.step param NAME …` rewrite them. */
  paramBindings?: ParamBinding[];
  /** Event-driven digital logic coupled to the analog circuit through A2D bridges and D2A
   *  elements. Absent for purely analog circuits, whose results are unchanged by its existence. */
  digital?: DigitalDesign;
}

export interface SimError { severity: "error" | "warning" | "info"; message: string; location?: string; hint?: string; }

export interface SimResult {
  analysis: Analysis;
  title: string;             // "Operating Point" | "Transient" | "DC Sweep" | "AC Sweep"
  sweepName: string;         // "" | "time" | "<src>" | "frequency"
  sweepUnit: string;         // "" | "s" | "V"/"A" | "Hz"
  sweep: number[];           // x-axis values (single element for .op)
  complex: boolean;
  signals: Record<string, number[]>;          // for real results: V(node), I(elem)
  csignals?: Record<string, Complex[]>;       // for AC: complex spectra
  units: Record<string, string>;              // signal name -> "V" | "A"
  log: string[];
  errors: SimError[];
  converged: boolean;
  stats: { matrixSize: number; points: number; iterations?: number; timeMs: number };
  /** Per-component analytical readouts at the converged DC operating point. The Inspector
   *  consumes these to render the "Power" and "Region" rows. NEVER decorate the canvas with
   *  this data; it lives only in the property panel where the user has selected a component. */
  components?: Record<string, ComponentReadout>;
  /** Present only on `.noise` results - the ranked contributor table is the whole point. */
  noise?: NoiseAnalysisResult;
  /** How the DC solve was reached (or why it wasn't), including the guilty device. */
  convergence?: ConvergenceReport;
  /** Digital signal histories, logic analyzers and displays, when the circuit has digital logic. */
  digital?: DigitalResult;
}

/** One component's share of the total output noise. Ranked by `pct` descending; this table is
 *  the product ("R2 is 61% of your noise" is a design action, "3.4 nV/√Hz" is not). */
export interface NoiseContribution {
  component: string;                    // refdes
  type: string;                         // "R" | "D" | "M" | "Q"
  /** Integrated mean-square contribution AT THE OUTPUT over [fstart, fstop], in V². */
  v2: number;
  /** sqrt(v2) - this component's own RMS contribution at the output, in V. */
  rms: number;
  /** Share of the total output noise POWER, 0..100. Powers add; RMS values do not. */
  pct: number;
  /** v2 split by physical mechanism. */
  mechanisms: { thermal?: number; shot?: number; flicker?: number };
}

export interface NoiseAnalysisResult {
  out: string; ref: string; src: string;
  freqs: number[];
  onoise: number[];        // output-referred noise density, V/√Hz
  inoise: number[];        // input-referred noise density, V/√Hz (onoise / |gain|)
  gain: number[];          // |V(out,ref) / src| at each frequency
  /** Band-integrated RMS. null (never 0, never a guess) when the band could not be integrated. */
  totalOutRms: number | null;
  totalInRms: number | null;
  contributions: NoiseContribution[];
  notes: string[];
}

/** What the DC continuation ladder did, and - when it failed - WHICH DEVICE is to blame.
 *  "Singular matrix" is not an actionable message; "Q3's B-E junction is oscillating" is. */
export interface ConvergenceReport {
  converged: boolean;
  /** The rung that produced the accepted solution (or "none"). */
  method: "direct" | "gmin" | "source-stepping" | "pseudo-transient" | "none";
  /** Human-readable trace of every rung attempted, in order. */
  attempts: string[];
  guilty?: { component: string; detail: string; node?: string; swing?: number };
  /** A directive the user can paste, e.g. ".nodeset V(bias)=0.65". */
  suggestion?: string;
  message: string;
}

/** Per-component readout for the Inspector. `power` is signed (sourced/absorbed); `region`
 *  is non-null only for MOSFETs and BJTs. */
export interface ComponentReadout {
  power?: number;            // average power in W over the simulated window (or .op-frame)
  region?: "cutoff" | "triode" | "saturation" | "forward-active" | "reverse" | "breakdown";
}

export interface SimOptions {
  gmin: number; reltol: number; abstol: number; vntol: number; itl1: number; itl4: number;
  method: "trap" | "be"; temp: number;
}
export const DEFAULT_OPTIONS: SimOptions = {
  gmin: 1e-12, reltol: 1e-3, abstol: 1e-12, vntol: 1e-6, itl1: 200, itl4: 50, method: "trap", temp: 27,
};

// physical constants
export const KB = 1.380649e-23;
export const Q = 1.602176634e-19;
export const T0K = 273.15;
export const VT = (tempC: number) => KB * (tempC + T0K) / Q; // thermal voltage
export const tempK = (tempC: number) => tempC + T0K;
