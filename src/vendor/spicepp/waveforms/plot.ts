/* ============================================================================
 * plot.ts — the waveform renderer.
 *
 * Design contract (kept identical everywhere so two panels of a Bode pair, a
 * transient and an FFT all read as ONE chart language):
 *   • The DATA is the highest-contrast ink on screen. Grid and axis rules are
 *     recessive hairlines one step off the surface; tick text is tertiary ink.
 *   • Nothing overlaps anything. Every band (legend / plot / tick row / axis
 *     title) is measured and RESERVED before a single pixel is drawn, so a
 *     label can never land on the frame and the layout can never jump when a
 *     trace arrives.
 *   • One formatter for every number on the canvas (`formatTick`). "100 Hz"
 *     and "1 kHz" are produced by the same code path, so they can't disagree.
 *   • Absent options render byte-identically to a plot without them: the
 *     evidence overlay (`targets` / `markers` / `bands`) is purely additive.
 *
 * The geometry and formatting helpers below are exported and PURE so
 * scripts/test_plot.ts can assert them without a canvas.
 * ========================================================================== */
import { TOKENS } from "../styles/tokens";
import { formatValue } from "../units";

// ── public shape ────────────────────────────────────────────────────────────
export interface PlotRect { x: number; y: number; w: number; h: number; }
export interface PlotSeries { name: string; color: string; y: number[]; }

/** Which y-scale an annotation is measured against. Defaults to the left axis. */
export type PlotAxis = "L" | "R";
/** Verdict colour for evidence overlays. `neutral` = informational, no verdict. */
export type EvidenceStatus = "ok" | "warn" | "error" | "neutral";

/** A dashed spec line + label. Give `y` for a horizontal target (a gain/level
 *  limit) or `x` for a vertical one (a deadline/corner frequency). */
export interface PlotTarget { y?: number; x?: number; label: string; axis?: PlotAxis; status?: EvidenceStatus; }
/** A called-out measurement: a ringed dot at (x,y) with a leader line to a label. */
export interface PlotMarker { x: number; y: number; label: string; axis?: PlotAxis; status?: EvidenceStatus; }
/** A shaded acceptance region. Omit a bound to make the band span that whole
 *  axis (y0/y1 only ⇒ a full-width horizontal band). `pass` drives the tint:
 *  true = ok green, false = error red, undefined = neutral. */
export interface PlotBand { x0?: number; x1?: number; y0?: number; y1?: number; label?: string; pass?: boolean; axis?: PlotAxis; }

/** A/B measurement cursors, in DATA space (so pan/zoom never drifts them). */
export interface PlotCursors { a: number | null; b: number | null; }

/** Left/right margins in px. Passed in to force two stacked panels to share a
 *  plot rect to the pixel (the Bode view); omitted, each panel measures its own. */
export interface PlotGutter { left: number; right: number; }

/** What the caller learns about the rendered geometry — enough to hit-test,
 *  to place DOM overlays (the draggable cursor grips) and to pan/zoom. */
export interface PlotGeometry {
  plotX: number; plotY: number; plotW: number; plotH: number;
  xMin: number; xMax: number; xLog: boolean;
  /** Left-axis range actually drawn, and what it excluded. `yClipLow/High` mean
   *  a finite excursion runs off that edge and is marked there. */
  yMin: number; yMax: number;
  yClipLow: boolean; yClipHigh: boolean;
  yDataMin: number; yDataMax: number;
}

export interface PlotOpts {
  x: number[];
  series: PlotSeries[];                    // left-axis series (voltages, dB, etc.)
  seriesR?: PlotSeries[];                  // optional right-axis series (currents, phase, etc.)
  xLabel: string;
  yLabel: string;                          // label/unit for the left axis
  yLabelR?: string;                        // label/unit for the right axis (only used when seriesR is non-empty)
  xLog?: boolean;
  yLog?: boolean;
  yLogR?: boolean;
  title?: string;
  cursor?: number | null;  // mouse x in CSS px (canvas-relative); draws a value crosshair when set
  xDomain?: [number, number]; // explicit x-range (pan/zoom); when omitted, auto-fits the data
  onDomain?: (g: PlotGeometry) => void;
  /** dB-magnitude floor. When set (e.g. −250), left-axis y-values ≤ this are treated as a
   *  transmission-zero null: excluded from y-autorange AND broken from the polyline (instead
   *  of plotting the −6000 dB the 1e-300 magnitude floor produces, which would otherwise
   *  flatten the whole passband). Only affects the left axis. */
  dbFloor?: number;

  // ── evidence overlay (purely additive; absent ⇒ renders exactly as before) ──
  targets?: PlotTarget[];
  markers?: PlotMarker[];
  bands?: PlotBand[];

  // ── measurement cursors ────────────────────────────────────────────────────
  /** A/B cursors in data space. Drawn snapped to the nearest sample. */
  cursors?: PlotCursors;

  // ── shared-axis composition (the AC Bode pair) ─────────────────────────────
  /** Force the horizontal margins so stacked panels align to the pixel. */
  gutter?: PlotGutter;
  /** false ⇒ draw the x grid + rule but NO tick row and NO axis title. The panel
   *  below carries the shared x-axis, so the pair costs one axis, not two. */
  showXAxis?: boolean;
  /** How much of the hover readout this panel renders.
   *  `full` (default) — crosshair, per-series dots, and a box led by the x row.
   *  `series` — the same box WITHOUT the x row, for the second panel of a
   *             shared-x pair (repeating "frequency = 1 kHz" twice is noise).
   *  `line` — crosshair and dots only. */
  readout?: "full" | "series" | "line";
  /** false ⇒ no in-canvas legend. For hosts that already key every trace by colour
   *  in their own chrome, where a second legend inside the plot only repeats it. */
  legend?: boolean;
  /** false ⇒ no axis titles ("time", "voltage"). The tick labels already carry
   *  the unit, so a host that wants the quietest plot can drop the words. */
  axisTitles?: boolean;

  // ── designed states ────────────────────────────────────────────────────────
  /** Nothing probed. Renders a centred call-to-action and NO axes — an empty
   *  framed box with 0 / 0.5 / 1 on it reads as broken, so we never draw one. */
  empty?: { title: string; hint?: string };
  /** Results pending. Renders the final layout in ghost form (zero layout shift
   *  when the data lands) instead of a spinner that displaces the plot. */
  loading?: boolean;
  /** Non-converged / solver-warned. Dims and hatches the traces and stamps the
   *  plot so the curve can never be screenshotted as if it were authoritative.
   *  The string is drawn as the watermark, so keep it SHORT ("unreliable"). */
  degraded?: string;

  // ── divergence / robust range ──────────────────────────────────────────────
  /** Force robust y-ranging on (true) or off (false). Default: on for linear,
   *  dimensioned axes only — a dB or phase axis is already compressed and a
   *  filter notch there is real data, not an outlier. */
  robustY?: boolean;
  /** x at which the solution left the physical envelope and never returned.
   *  Drawn as a marked rule on the x axis: on a failed run this is the single
   *  most useful number on the screen. */
  divergenceX?: number | null;
}

// ── ink ─────────────────────────────────────────────────────────────────────
const AXIS_RULE = TOKENS.ink.tertiary;
const GRID = TOKENS.hairline;
const TEXT = TOKENS.ink.secondary;
const TEXT_DIM = TOKENS.ink.tertiary;
const STATUS: Record<EvidenceStatus, string> = {
  ok: TOKENS.status.ok, warn: TOKENS.status.warn, error: TOKENS.status.error, neutral: TOKENS.ink.secondary,
};

// ── metrics (all multiples of 4 except the optical text offsets) ────────────
const FONT_TICK = "11px Inter, ui-sans-serif, sans-serif";
const FONT_LABEL = "11px Inter, ui-sans-serif, sans-serif";
const FONT_EMPTY_TITLE = "13px Inter, ui-sans-serif, sans-serif";
const TICK_LEN = 4;          // tick mark length outside the axis rule
const TICK_GAP = 8;          // axis rule → tick label
const TICK_ASCENT = 8;       // cap height of the 11px tick face
const AXIS_TITLE_GAP = 8;    // tick label → axis title
const LEGEND_ROW = 16;
const LEGEND_MAX_ROWS = 3;
const MIN_TICK_GAP_X = 12;   // minimum whitespace between two x tick labels
const MIN_TICK_GAP_Y = 14;   // minimum vertical pitch between two y tick labels

// ═══════════════════════════════════════════════════════════════════════════
// PURE GEOMETRY / FORMATTING  (exported for scripts/test_plot.ts)
// ═══════════════════════════════════════════════════════════════════════════

/** Extract the unit from an axis label like "time (s)" → "s". "" when unlabelled. */
export function axisUnit(label: string | undefined): string {
  if (!label) return "";
  const m = /\(([^)]+)\)/.exec(label);
  return m ? m[1] : "";
}
/** The axis label without its parenthesised unit: "time (s)" → "time". */
export function axisTitle(label: string | undefined): string {
  return (label || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function niceNum(range: number, round: boolean): number {
  if (!isFinite(range) || range <= 0) return 1;
  const exp = Math.floor(Math.log10(range));
  const f = range / Math.pow(10, exp);
  let nf: number;
  if (round) nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  else nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * Math.pow(10, exp);
}

/**
 * Linear "nice" ticks covering lo..hi, always a 1/2/5×10ⁿ step.
 *
 * Two failure modes this guards, both of which produced garbage axes before:
 *  1. Floating-point accumulation. Stepping `v += step` across ~10 ticks drifts
 *     enough that a tick meant to be exactly 0 lands on 3.5e-17 and formats as
 *     "35 a" — so we index (start + i*step) and snap near-zero to exact 0.
 *  2. A degenerate span (lo === hi, or NaN from an all-flat trace) used to
 *     return a single-element array and the axis rendered one lonely label.
 *     We synthesise a ±1 span instead, which is what the caller's y-padding
 *     already does for data.
 */
export function linearTicks(lo: number, hi: number, maxTicks = 6): number[] {
  if (!isFinite(lo) || !isFinite(hi)) return [];
  if (lo > hi) [lo, hi] = [hi, lo];
  if (lo === hi) { lo -= 1; hi += 1; }
  const step = niceNum(niceNum(hi - lo, false) / Math.max(1, maxTicks - 1), true);
  if (!isFinite(step) || step <= 0) return [lo, hi];
  const start = Math.ceil(lo / step - 1e-9) * step;
  const out: number[] = [];
  const n = Math.floor((hi - start) / step + 1e-9);
  for (let i = 0; i <= n; i++) {
    const v = start + i * step;
    out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  }
  return out;
}

/**
 * Log-axis ticks. `major` carries a label; `minor` is the 2..9 comb inside each
 * decade that makes a log axis *readable as* a log axis (without it a decade
 * grid is indistinguishable from a linear one).
 *
 * Under ~2 decades of span, whole decades give at most two labels and the axis
 * reads as empty — so we promote the 1/2/5 sub-decade steps to major. This is
 * the case that shows up constantly in practice: a 100 Hz…1 kHz AC sweep.
 */
export function logTicks(lo: number, hi: number): { major: number[]; minor: number[] } {
  if (!isFinite(lo) || !isFinite(hi) || lo <= 0 || hi <= 0) return { major: [], minor: [] };
  if (lo > hi) [lo, hi] = [hi, lo];
  if (lo === hi) { lo /= 10; hi *= 10; }
  const e0 = Math.floor(Math.log10(lo) - 1e-9);
  const e1 = Math.ceil(Math.log10(hi) + 1e-9);
  const decades = Math.log10(hi) - Math.log10(lo);
  // Guard against a pathological domain (1e-300 … 1e300) generating 600 decades
  // of ticks and stalling the frame — the thinner would drop them all anyway.
  const majorEvery = decades > 24 ? Math.ceil(decades / 12) : 1;
  const dense = decades < 2;
  const major: number[] = [];
  const minor: number[] = [];
  const inRange = (v: number) => v >= lo * (1 - 1e-9) && v <= hi * (1 + 1e-9);
  for (let e = e0; e <= e1; e++) {
    const base = Math.pow(10, e);
    if (!isFinite(base) || base === 0) continue;
    for (let m = 1; m <= 9; m++) {
      const v = m * base;
      if (!inRange(v)) continue;
      const isDecade = m === 1;
      const isMajor = isDecade
        ? (e - e0) % majorEvery === 0
        : dense && (m === 2 || m === 5);
      if (isMajor) major.push(v); else minor.push(v);
    }
  }
  // A sub-decade window (zoomed in to 1.2 k … 3.4 k) may contain one 1/2/5
  // value or none at all, and an axis with a single label on it is worse than
  // no axis. Under a decade the mapping is very nearly linear anyway, so we
  // hand the majors to the linear tick generator — which is exactly what the
  // reader expects to see there (1.5 k, 2 k, 2.5 k, 3 k).
  if (major.length < 3 && decades < 1) {
    const lin = linearTicks(lo, hi, 5).filter((v) => v > 0);
    if (lin.length >= 2) {
      const on = new Set(lin);
      return { major: lin, minor: minor.filter((v) => !on.has(v)) };
    }
  }
  // Still nothing (a pathological range): the endpoints beat an empty axis.
  if (major.length === 0) return { major: [lo, hi], minor };
  return { major, minor };
}

/**
 * Drop ticks until no two labels are within `minGap` px of each other.
 *
 * We thin by STRIDE (keep every k-th) rather than greedily skipping neighbours,
 * because a greedy pass produces an irregular comb (0, 20, 50, 70…) that reads
 * as a rendering bug. Stride keeps the axis rhythmic. `pos` and `size` are the
 * label's centre coordinate and its measured extent along the axis, so this one
 * function thins both the x row (widths) and the y column (line height).
 */
export function thinTicks(ticks: number[], pos: number[], size: number[], minGap: number): number[] {
  const n = ticks.length;
  if (n <= 1) return ticks.slice();
  // `pos` may ascend (x axis) or descend (y axis maps larger values to smaller
  // px), so the gap is measured on |Δpos| rather than a signed edge comparison.
  const fits = (stride: number): boolean => {
    let prev = -1;
    for (let i = 0; i < n; i += stride) {
      if (prev >= 0) {
        const gap = Math.abs(pos[i] - pos[prev]) - size[i] / 2 - size[prev] / 2;
        if (gap < minGap) return false;
      }
      prev = i;
    }
    return true;
  };
  for (let stride = 1; stride <= n; stride++) {
    if (!fits(stride)) continue;
    const out: number[] = [];
    for (let i = 0; i < n; i += stride) out.push(ticks[i]);
    return out;
  }
  // Even two labels collide (a panel narrower than one label): keep the first
  // rather than returning an axis with nothing on it.
  return [ticks[0]];
}

/**
 * THE tick formatter. Every number that lands on an axis, a cursor readout or a
 * legend goes through here, which is the only way "100Hz" and "1 kHz" can be
 * stopped from appearing side by side.
 *
 * Two deliberate deviations from `formatValue`, both display-only:
 *  • "Meg" → "M". formatValue speaks SPICE (where `M` is milli, so mega must be
 *    spelled `Meg`); an axis speaks SI, where 1e6 Hz is "1 MHz". Writing "1 MegHz"
 *    on a Bode plot would be wrong to every reader of the chart.
 *  • Exactly one space between the number and the prefixed unit. formatValue
 *    strips the space before bare units ("100Hz") but keeps it before a prefix
 *    ("1 kHz") — the inconsistency the axis was shipping.
 * A unitless axis (dB, degrees, a bare ratio) gets a plain decimal: an SI prefix
 * on a dB value ("−1.2 m dB") is meaningless.
 */
export function formatTick(v: number, unit: string): string {
  if (!isFinite(v)) return v > 0 ? "∞" : v < 0 ? "−∞" : "NaN";
  if (!unit) return formatPlain(v);
  // Units that are already logarithmic or dimensionless must NEVER take an SI
  // prefix: −0.5 dB is "−0.5 dB", not "−500 mdB", and 0.5° is not "500 m°".
  // This is the single most visible way a unit formatter can look broken.
  if (NO_PREFIX_UNITS.has(unit)) return TIGHT_UNITS.has(unit) ? `${formatPlain(v)}${unit}` : `${formatPlain(v)} ${unit}`;
  const raw = formatValue(v, unit);
  const m = /^(-?[\d.]+(?:[eE][-+]?\d+)?)\s*(.*)$/.exec(raw);
  if (!m) return raw;
  const suffixed = m[2].replace(/^Meg/, "M");
  return suffixed ? `${m[1]} ${suffixed}` : m[1];
}

/** Logarithmic / dimensionless units — an SI prefix on these is meaningless. */
const NO_PREFIX_UNITS = new Set(["dB", "dBm", "dBV", "deg", "°", "%", "rad", "ratio"]);
/** …of those, the ones that are set tight against the number typographically. */
const TIGHT_UNITS = new Set(["°", "%"]);

/** Plain decimal for unitless axes: 4 significant digits, exponent form only
 *  where a decimal would be unreadable (|v| ≥ 1e6 or < 1e-3). */
export function formatPlain(v: number): string {
  if (!isFinite(v)) return v > 0 ? "∞" : v < 0 ? "−∞" : "NaN";
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1e6 || a < 1e-3) {
    const e = Math.floor(Math.log10(a));
    const mant = v / Math.pow(10, e);
    const ms = Math.abs(mant - Math.round(mant)) < 1e-9 ? String(Math.round(mant)) : mant.toFixed(1);
    return `${ms}e${e}`;
  }
  return String(Number(v.toPrecision(4)));
}

/** A linear-or-log mapping between data space and pixels, plus its inverse. */
export interface PlotScale {
  toPx: (v: number) => number;
  toValue: (px: number) => number;
  min: number; max: number; log: boolean; px0: number; pxLen: number; invert: boolean;
}
/** Build a scale. `invert` flips the pixel direction (a y axis grows upward). */
export function makeScale(min: number, max: number, px0: number, pxLen: number, log = false, invert = false): PlotScale {
  // A log scale cannot represent ≤ 0. Clamping here (rather than at every call
  // site) is what keeps a single stray 0 in the data from producing NaN pixels
  // and a silently blank trace.
  let lo = min, hi = max;
  if (log) { if (!(lo > 0)) lo = 1e-12; if (!(hi > lo)) hi = lo * 10; }
  if (!isFinite(lo) || !isFinite(hi) || lo === hi) { lo = log ? lo : lo - 1; hi = log ? lo * 10 : hi + 1; }
  const l0 = log ? Math.log10(lo) : lo;
  const l1 = log ? Math.log10(hi) : hi;
  const span = l1 - l0 || 1;
  const toPx = (v: number): number => {
    const t = ((log ? Math.log10(v) : v) - l0) / span;
    return invert ? px0 + pxLen - t * pxLen : px0 + t * pxLen;
  };
  const toValue = (px: number): number => {
    const t = invert ? (px0 + pxLen - px) / pxLen : (px - px0) / pxLen;
    const l = l0 + t * span;
    return log ? Math.pow(10, l) : l;
  };
  return { toPx, toValue, min: lo, max: hi, log, px0, pxLen, invert };
}

/** Min/max of a numeric array, skipping non-finite values (and non-positive
 *  ones on a log axis). Written as a loop on purpose: `Math.min(...arr)` throws
 *  RangeError past ~120 k arguments, which is exactly the record length this
 *  viewer is expected to survive. */
export function extent(arrays: ArrayLike<number>[], opts: { positiveOnly?: boolean; floor?: number } = {}): [number, number] | null {
  let lo = Infinity, hi = -Infinity, seen = false;
  const { positiveOnly, floor } = opts;
  for (const a of arrays) {
    for (let i = 0; i < a.length; i++) {
      const v = a[i];
      if (!isFinite(v)) continue;
      if (positiveOnly && v <= 0) continue;
      if (floor != null && v <= floor) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
      seen = true;
    }
  }
  return seen ? [lo, hi] : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// ROBUST RANGE + DIVERGENCE  (the "12 V circuit auto-scaled to 200 V" failure)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * What a robust auto-range decided, and — crucially — what it EXCLUDED.
 *
 * `lo`/`hi` are the range worth drawing. `dataLo`/`dataHi` are the raw finite
 * extremes. When they differ the renderer MUST mark the excursion at the plot
 * edge and label the axis as clipped: a range that silently drops data is a
 * different lie from the one it fixes.
 */
export interface RobustDomain {
  lo: number; hi: number;
  dataLo: number; dataHi: number;
  /** True when a real, finite excursion lies outside [lo,hi] on that side. */
  clipLow: boolean; clipHigh: boolean;
  /** How many finite samples fall outside [lo,hi], and how many were considered. */
  outliers: number; total: number;
}

export interface RobustOpts {
  positiveOnly?: boolean;
  floor?: number;
  /**
   * The solver flagged this run (non-converged / errored). THE policy switch.
   *
   * On a HEALTHY run the plot must essentially never intervene: a diode I–V on a
   * linear current axis, a step response and a decaying ring all look like "most
   * of the record is small, the interesting part is huge", and hiding any of
   * them would be a far worse bug than the one being fixed. So the healthy tier
   * only removes a rare, egregious glitch (a single-sample 1000× spike).
   *
   * On a FLAGGED run the curve is already known not to be a solution, the panel
   * is already banner-ed and hatched, and the useful thing is to see the 12 V
   * signal instead of the 200 V artefact — so the tier is aggressive.
   */
  degraded?: boolean;
  /** Clip only when the raw span is at least this many times the kept span. */
  factor?: number;
  /** …and only when the excursion is a TAIL. Past this fraction of the record
   *  the "outlier" is the signal, and hiding it would be the bigger error. */
  maxOutlierFrac?: number;
  /** Tukey fence multiplier on the IQR. */
  fenceK?: number;
}

/** Healthy tier: an excursion must be ≥ 20× the kept span AND ≤ 2 % of the
 *  record. A diode sweep's conduction knee (~10 % of the points) survives; a
 *  1-sample glitch does not. */
const HEALTHY = { factor: 20, maxOutlierFrac: 0.02, fenceK: 4 };
/** Flagged tier: the run is already known to be wrong, so a divergence tail up
 *  to a third of the record is treated as the artefact it is. */
const DEGRADED = { factor: 6, maxOutlierFrac: 0.35, fenceK: 3 };
/** Quantiles are estimated from at most this many samples. A 200 k-point record
 *  sorted every frame would cost the frame; a 4 k stride estimates a quartile to
 *  far better than one pixel of axis. */
const QUANTILE_SAMPLES = 4096;

/** Nearest-rank quantile of an ASCENDING array. */
function quantile(sorted: ArrayLike<number>, p: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const i = Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))));
  return sorted[i];
}

/**
 * Robust y-range for one axis.
 *
 * THE failure this exists for: a transient that diverged to 200 V on a 12 V
 * circuit auto-scaled the axis to the divergence, so the real signal was an
 * invisible smear while the artefact owned the plot. Raw min/max is the wrong
 * statistic when a trace has a divergence tail.
 *
 * The rule, in order:
 *  1. Estimate the quartiles from a strided subsample and build a Tukey fence —
 *     the UNION of the fences across every series on the axis (they share it).
 *  2. NEVER clip across zero. A transient that starts at 0 V and settles at 5 V
 *     puts 99 % of its samples on the rail, so a pure quantile fence would fence
 *     off the entire rising edge. Data that spans zero always keeps zero, which
 *     protects every "starts at rest and rises" shape there is — the single most
 *     common waveform in the product.
 *  3. The kept range is the exact min/max of the samples inside that acceptance
 *     interval, over EVERY sample — so a genuine 1-sample spike inside the fence
 *     still sets the range and is never smoothed away.
 *  4. Clip only when the excursion is both extreme (raw span ≥ `factor` × kept
 *     span) and rare (≤ `maxOutlierFrac` of the record). Thresholds come from
 *     the tier: see RobustOpts.degraded. Otherwise the raw extremes are returned
 *     untouched, so an ordinary waveform ranges byte-identically to before.
 *
 * Returns null when nothing plottable is left after filtering.
 */
export function robustDomain(arrays: ArrayLike<number>[], opts: RobustOpts = {}): RobustDomain | null {
  const { positiveOnly, floor } = opts;
  const tier = opts.degraded ? DEGRADED : HEALTHY;
  const factor = opts.factor ?? tier.factor;
  const maxOutlierFrac = opts.maxOutlierFrac ?? tier.maxOutlierFrac;
  const fenceK = opts.fenceK ?? tier.fenceK;
  const keep = (v: number) => isFinite(v) && !(positiveOnly && v <= 0) && !(floor != null && v <= floor);

  let dataLo = Infinity, dataHi = -Infinity, total = 0;
  let fenceLo = Infinity, fenceHi = -Infinity, haveFence = false;

  for (const a of arrays) {
    const n = a.length;
    if (n === 0) continue;
    // One pass per array: raw extremes plus a strided subsample for the
    // quantiles. The stride is derived from the array length (an upper bound on
    // the kept count), which keeps this single-pass.
    const stride = Math.max(1, Math.ceil(n / QUANTILE_SAMPLES));
    const sample: number[] = [];
    let kept = 0;
    for (let i = 0; i < n; i++) {
      const v = a[i];
      if (!keep(v)) continue;
      if (v < dataLo) dataLo = v;
      if (v > dataHi) dataHi = v;
      if (kept % stride === 0) sample.push(v);
      kept++;
      total++;
    }
    if (sample.length < 8) continue;      // too few points for a meaningful quartile
    sample.sort((p, q) => p - q);
    const q25 = quantile(sample, 0.25), q75 = quantile(sample, 0.75);
    let spread = q75 - q25;
    // A trace that is flat for three quarters of its length (a rail, a pulse
    // train that is mostly idle) has a zero IQR. Fall back to the 2.5/97.5
    // span; if THAT is zero too there is no robust basis at all and the caller
    // must keep the raw range — clipping on a zero spread would erase the pulse.
    if (!(spread > 0)) spread = quantile(sample, 0.975) - quantile(sample, 0.025);
    if (!(spread > 0)) continue;
    haveFence = true;
    fenceLo = Math.min(fenceLo, q25 - fenceK * spread);
    fenceHi = Math.max(fenceHi, q75 + fenceK * spread);
  }

  if (total === 0 || !isFinite(dataLo) || !isFinite(dataHi)) return null;
  const raw: RobustDomain = { lo: dataLo, hi: dataHi, dataLo, dataHi, clipLow: false, clipHigh: false, outliers: 0, total };
  if (!haveFence) return raw;

  // Rule 2, unconditionally: zero is always inside the acceptance interval.
  // This is what protects a rise from rest. A .tran that starts at 0 V and
  // settles on a 5 V rail puts 99 % of its samples on the rail, so the quartile
  // fence sits at 5 ± ripple and would fence off the entire rising edge — the
  // most common waveform in the product, deleted by a "robustness" feature.
  // Widening to zero costs nothing when no samples lie between: the kept range
  // is still the min/max of the samples that ARE inside.
  fenceLo = Math.min(fenceLo, 0);
  fenceHi = Math.max(fenceHi, 0);

  // Nothing can be outside the interval ⇒ nothing to decide. This is the common
  // case (every healthy waveform), and skipping the second pass here is what
  // keeps a 200 k-point record's first draw off the frame budget.
  if (dataLo >= fenceLo && dataHi <= fenceHi) return raw;

  // Second pass: the extremes INSIDE the acceptance interval, exactly.
  let lo = Infinity, hi = -Infinity, outliers = 0;
  for (const a of arrays) {
    for (let i = 0; i < a.length; i++) {
      const v = a[i];
      if (!keep(v)) continue;
      if (v < fenceLo || v > fenceHi) { outliers++; continue; }
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  if (!isFinite(lo) || !isFinite(hi)) return raw;   // everything fenced out ⇒ trust the data

  const keptSpan = hi - lo;
  const dataSpan = dataHi - dataLo;
  const frac = outliers / total;
  // `keptSpan > 0` is the guard that protects a mostly-flat trace with a real
  // pulse: with no in-fence spread there is nothing to scale to, and clipping
  // would delete the only interesting feature.
  const worth = keptSpan > 0 && outliers > 0 && dataSpan >= factor * keptSpan && frac <= maxOutlierFrac;
  if (!worth) return raw;
  return { lo, hi, dataLo, dataHi, clipLow: lo > dataLo, clipHigh: hi < dataHi, outliers, total };
}

/**
 * Whether robust ranging applies to an axis at all.
 *
 * Only linear, dimensioned axes. A dB or phase axis is ALREADY compressed — a
 * 200:1 excursion is 46 dB there and does not destroy the plot — and a filter
 * notch legitimately spans 100 dB, so fencing a Bode magnitude would hide real
 * physics. Exported so the panel and the renderer can never disagree about
 * which axes were clipped.
 */
export function robustRangeApplies(unit: string, log?: boolean): boolean {
  return !log && !!unit && !NO_PREFIX_UNITS.has(unit);
}

/** Where a solution left the physical envelope and never came back. */
export interface Divergence {
  /** Index of the FIRST sample of the terminal excursion. */
  index: number;
  /** Its x value, when an x array was supplied. */
  x: number | null;
  /** The value at that sample (NaN/±Inf for a solver blow-up). */
  value: number;
  kind: "nonfinite" | "runaway";
}

/**
 * Find the point at which a trace diverges: the first sample of the run of
 * non-finite or out-of-envelope values that reaches the END of the record.
 *
 * The "and never came back" requirement is what separates a divergence from a
 * glitch. A 1000× spike in the middle of an otherwise healthy transient is an
 * outlier — it gets a clip marker, not a divergence rule — whereas a run that
 * terminates the record is the solver coming apart, and the user needs the x
 * value where that started far more than they need the artefact drawn to scale.
 *
 * Returns null when the ENTIRE record is out of envelope: a trace that was never
 * good did not diverge, it is simply absent, and pointing at t = 0 as "where it
 * went wrong" would be a fabricated diagnosis.
 */
export function detectDivergence(
  xs: ArrayLike<number> | null, ys: ArrayLike<number>, envelope: { lo: number; hi: number },
): Divergence | null {
  const n = ys.length;
  if (n < 2) return null;
  const bad = (v: number) => !isFinite(v) || v < envelope.lo || v > envelope.hi;
  if (!bad(ys[n - 1])) return null;
  let i = n - 1;
  while (i > 0 && bad(ys[i - 1])) i--;
  if (i === 0) return null;
  const v = ys[i];
  return {
    index: i,
    x: xs && i < xs.length && isFinite(xs[i]) ? xs[i] : null,
    value: v,
    kind: isFinite(v) ? "runaway" : "nonfinite",
  };
}

/** One min/max envelope column: everything needed to draw a pixel-wide slice
 *  of the trace without losing a 1-sample spike. */
export interface PlotColumn { col: number; yFirst: number; yLast: number; yMin: number; yMax: number; }

/**
 * Decimate a dense trace to one column per x-pixel, keeping BOTH extremes.
 *
 * A naive `lineTo` per sample at 100 k+ points costs a frame (dropped frames
 * while panning) and — worse — *loses data*: a 1-sample spike inside a pixel
 * column is drawn as a 1 px-wide sliver that round joins swallow entirely, so
 * the user sees a clean waveform where there is actually a glitch. Emitting a
 * vertical segment from the column's min to its max makes it impossible for any
 * extremum to disappear, at a fixed cost of one column per pixel.
 *
 * `null` entries mark a BREAK (non-finite sample, out-of-domain, floored dB
 * null). The renderer must not connect across them or it fabricates a segment.
 */
export function decimateMinMax(
  xs: ArrayLike<number>, ys: ArrayLike<number>,
  i0: number, i1: number,
  toCol: (x: number) => number,
  valid: (x: number, y: number) => boolean,
): (PlotColumn | null)[] {
  const out: (PlotColumn | null)[] = [];
  let cur: PlotColumn | null = null;
  const hi = Math.min(i1, xs.length - 1, ys.length - 1);
  for (let i = Math.max(0, i0); i <= hi; i++) {
    const xv = xs[i], yv = ys[i];
    if (!valid(xv, yv)) {
      if (cur) { out.push(cur); cur = null; }
      // Only one break marker per run of bad samples — a 50 k-sample NaN gap
      // must not push 50 k nulls.
      if (out.length && out[out.length - 1] !== null) out.push(null);
      continue;
    }
    const col = toCol(xv);
    if (!cur || col !== cur.col) {
      if (cur) out.push(cur);
      cur = { col, yFirst: yv, yLast: yv, yMin: yv, yMax: yv };
    } else {
      if (yv < cur.yMin) cur.yMin = yv;
      if (yv > cur.yMax) cur.yMax = yv;
      cur.yLast = yv;
    }
  }
  if (cur) out.push(cur);
  return out;
}

const ASCENDING = new WeakMap<object, boolean>();
/** True when the array is non-decreasing. Cached per array instance, because
 *  the answer is a property of the data and the cursor asks 60×/second. */
export function isAscending(xs: number[]): boolean {
  const hit = ASCENDING.get(xs);
  if (hit !== undefined) return hit;
  let ok = true;
  for (let i = 1; i < xs.length; i++) if (xs[i] < xs[i - 1]) { ok = false; break; }
  ASCENDING.set(xs, ok);
  return ok;
}

/** Index range whose samples can land inside [lo,hi], with one sample of
 *  overhang on each side so the polyline still enters/leaves the plot edge.
 *  O(log n) on sorted x; falls back to the whole record otherwise. */
export function visibleRange(xs: number[], lo: number, hi: number): [number, number] {
  const n = xs.length;
  if (n === 0) return [0, -1];
  if (!isAscending(xs)) return [0, n - 1];
  const lower = (target: number): number => {
    let a = 0, b = n - 1;
    while (a < b) { const m = (a + b) >>> 1; if (xs[m] < target) a = m + 1; else b = m; }
    return a;
  };
  const i0 = Math.max(0, lower(lo) - 1);
  const i1 = Math.min(n - 1, lower(hi) + 1);
  return [i0, i1];
}

/** Index of the sample nearest `xv`. This is what makes a cursor readout an
 *  actual measurement rather than an interpolation the solver never produced. */
export function snapToSample(xs: number[], xv: number): number {
  const n = xs.length;
  if (n === 0) return -1;
  if (!isAscending(xs)) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < n; i++) { const d = Math.abs(xs[i] - xv); if (d < bd) { bd = d; best = i; } }
    return best;
  }
  if (xv <= xs[0]) return 0;
  if (xv >= xs[n - 1]) return n - 1;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >>> 1; if (xs[m] <= xv) lo = m; else hi = m; }
  return Math.abs(xs[lo] - xv) <= Math.abs(xs[hi] - xv) ? lo : hi;
}

/**
 * Clip a band to the plot rect. Returns null when the band lies entirely
 * outside — a band that has scrolled off must vanish, not collapse into a
 * 1 px line glued to the edge (which reads as a real, wrong, annotation).
 */
export function clipBand(
  band: { x0?: number; x1?: number; y0?: number; y1?: number },
  xToPx: (v: number) => number, yToPx: (v: number) => number, rect: PlotRect,
): PlotRect | null {
  const rx1 = rect.x + rect.w, ry1 = rect.y + rect.h;
  let ax = band.x0 != null ? xToPx(band.x0) : rect.x;
  let bx = band.x1 != null ? xToPx(band.x1) : rx1;
  let ay = band.y0 != null ? yToPx(band.y0) : ry1;
  let by = band.y1 != null ? yToPx(band.y1) : rect.y;
  if (!isFinite(ax) || !isFinite(bx) || !isFinite(ay) || !isFinite(by)) return null;
  if (ax > bx) [ax, bx] = [bx, ax];
  if (ay > by) [ay, by] = [by, ay];
  const x0 = Math.max(ax, rect.x), x1 = Math.min(bx, rx1);
  const y0 = Math.max(ay, rect.y), y1 = Math.min(by, ry1);
  if (!(x1 > x0) || !(y1 > y0)) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * One verified obligation, in the shape the plot needs to draw it.
 *
 * Structurally compatible with `TargetResult` from src/lib/ai/verify.ts, but
 * declared here so plot.ts imports NOTHING from the AI/sim layer — pulling
 * verify.ts (and through it the whole solver) into the chart module would drag
 * it into the client bundle for the sake of six field names.
 */
export interface EvidenceSpec {
  metric: string;
  signal?: string;
  /** ">=" | "<=" | ">" | "<" | "==" | "~=" */
  op: string;
  target: number;
  measured: number | null;
  pass: boolean;
  unit?: string;
  /** Fractional tolerance for "~=". Defaults to 5 %, matching verify.ts. */
  tol?: number;
  /** x position of the measurement (the `at` of a *_at metric). Without it we
   *  can still draw the target line and the band, just not the point marker. */
  at?: number;
  axis?: PlotAxis;
}

/**
 * Turn verified obligations into the three overlay arrays.
 *
 * This is the step that makes "the spec passes" into a picture: a dashed line
 * at the limit, a tinted region for everything that would satisfy it, and a
 * ringed dot on the measurement that did. Green when it passed, red when it
 * did not — the verdict is in the tint, not in a caption the reader has to find.
 */
export function evidenceOverlay(specs: EvidenceSpec[]): { targets: PlotTarget[]; markers: PlotMarker[]; bands: PlotBand[] } {
  const targets: PlotTarget[] = [];
  const markers: PlotMarker[] = [];
  const bands: PlotBand[] = [];
  const OPS: Record<string, string> = { ">=": "≥", "<=": "≤", "==": "=", "~=": "≈", ">": ">", "<": "<" };
  for (const s of specs) {
    if (!isFinite(s.target)) continue;
    const status: EvidenceStatus = s.pass ? "ok" : "error";
    const unit = s.unit ?? "";
    const label = `${s.metric} ${OPS[s.op] ?? s.op} ${formatTick(s.target, unit)}`;
    targets.push({ y: s.target, label, axis: s.axis, status });

    // The acceptance region: everything that WOULD satisfy the obligation. An
    // open-ended comparison leaves the far bound undefined, which makes the
    // band run to the edge of the plot — which is exactly what "≥ 20 dB" means.
    if (s.op === "~=" || s.op === "==") {
      const tol = s.op === "~=" ? (s.tol ?? 0.05) : 0;
      const half = Math.abs(s.target * tol);
      // An exact "==" has no width to shade; the dashed line already says it.
      if (half > 0) bands.push({ y0: s.target - half, y1: s.target + half, pass: s.pass, axis: s.axis });
    } else if (s.op === ">=" || s.op === ">") {
      bands.push({ y0: s.target, pass: s.pass, axis: s.axis });
    } else if (s.op === "<=" || s.op === "<") {
      bands.push({ y1: s.target, pass: s.pass, axis: s.axis });
    }

    if (s.measured != null && isFinite(s.measured) && s.at != null && isFinite(s.at)) {
      markers.push({ x: s.at, y: s.measured, label: formatTick(s.measured, unit), axis: s.axis, status });
    }
  }
  return { targets, markers, bands };
}

export interface MarkerLabelPlacement {
  leaderX: number; leaderY: number;   // elbow of the leader line
  textX: number; textY: number;       // text anchor (baseline)
  align: "left" | "right";
  visible: boolean;                   // false ⇒ the dot itself is off-plot
}
/**
 * Place a marker's leader + label so it never leaves the plot rect.
 *
 * Default is up-and-right (the reading direction, and the quadrant least often
 * occupied by a rising trace). We flip to the left when the label would run past
 * the right edge and flip downward when it would clear the top — clipping the
 * text, or letting it escape the plot onto the axis, is the failure this
 * prevents. Pure so the flip logic is testable at the exact edge.
 */
export function placeMarkerLabel(px: number, py: number, textW: number, rect: PlotRect, lead = 10): MarkerLabelPlacement {
  const PAD = 6, TEXT_GAP = 6, TEXT_H = 11;
  const visible = px >= rect.x - 0.5 && px <= rect.x + rect.w + 0.5 && py >= rect.y - 0.5 && py <= rect.y + rect.h + 0.5;
  const roomRight = rect.x + rect.w - PAD - (px + lead + TEXT_GAP);
  const goLeft = roomRight < textW;
  const goDown = py - lead - TEXT_H < rect.y + PAD;
  const leaderX = goLeft ? px - lead : px + lead;
  const leaderY = goDown ? py + lead : py - lead;
  const textX = goLeft ? leaderX - TEXT_GAP : leaderX + TEXT_GAP;
  // Baseline sits on the elbow, nudged by half the cap height for optical centring.
  let textY = leaderY + 4;
  textY = Math.max(rect.y + TEXT_H, Math.min(rect.y + rect.h - 2, textY));
  return { leaderX, leaderY, textX, textY, align: goLeft ? "right" : "left", visible };
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYOUT
// ═══════════════════════════════════════════════════════════════════════════

interface Domain { lo: number; hi: number; clipLow: boolean; clipHigh: boolean; dataLo: number; dataHi: number; }

// ── robust-range cache ──────────────────────────────────────────────────────
// planLayout runs on EVERY draw, i.e. on every mousemove of a hover or a pan.
// robustDomain is two passes plus a 4 k sort, so without a cache a 200 k-point
// record would pay it 60×/second and drop frames — the exact regression the
// decimator was written to avoid. The key is the array identity PLUS a cheap
// content fingerprint, so an array mutated in place cannot serve a stale range.
let ARRAY_SEQ = 0;
const ARRAY_ID = new WeakMap<object, number>();
const ROBUST_CACHE = new Map<string, RobustDomain | null>();
const ROBUST_CACHE_MAX = 24;
function fingerprint(a: ArrayLike<number>): string {
  let id = ARRAY_ID.get(a as unknown as object);
  if (id === undefined) { id = ++ARRAY_SEQ; ARRAY_ID.set(a as unknown as object, id); }
  const n = a.length;
  return n === 0 ? `${id}:0` : `${id}:${n}:${a[0]}:${a[n >> 1]}:${a[n - 1]}`;
}
function robustDomainCached(arrays: ArrayLike<number>[], opts: RobustOpts): RobustDomain | null {
  const key = `${arrays.map(fingerprint).join("|")}#${opts.positiveOnly ? 1 : 0}#${opts.floor ?? ""}#${opts.degraded ? 1 : 0}`;
  const hit = ROBUST_CACHE.get(key);
  if (hit !== undefined) return hit;
  const val = robustDomain(arrays, opts);
  if (ROBUST_CACHE.size >= ROBUST_CACHE_MAX) ROBUST_CACHE.delete(ROBUST_CACHE.keys().next().value as string);
  ROBUST_CACHE.set(key, val);
  return val;
}

/**
 * Auto-range one axis. Linear axes get 6 % headroom so a peak never touches the
 * frame; log axes snap outward to whole decades so the grid starts on a
 * labelled line instead of an arbitrary value.
 *
 * On a linear, dimensioned axis the range is ROBUST (see robustDomain): a
 * divergence tail no longer sets the scale. When that clips something, the
 * flags travel with the domain so the renderer can mark the excursion at the
 * plot edge and tag the axis — an axis that hides data without saying so would
 * be a worse bug than the one being fixed.
 */
function autoRange(series: PlotSeries[], log: boolean | undefined, floor: number | undefined, unit: string, robust: boolean | undefined, degraded: boolean): Domain {
  const arrays = series.map((s) => s.y);
  const useRobust = robust ?? robustRangeApplies(unit, log);
  const rd = useRobust ? robustDomainCached(arrays, { positiveOnly: !!log, floor, degraded }) : null;
  const ext = rd ? [rd.lo, rd.hi] as [number, number] : extent(arrays, { positiveOnly: !!log, floor });
  if (!ext) return log ? { lo: 1, hi: 10, clipLow: false, clipHigh: false, dataLo: 1, dataHi: 10 } : { lo: 0, hi: 1, clipLow: false, clipHigh: false, dataLo: 0, dataHi: 1 };
  let [lo, hi] = ext;
  const dataLo = rd ? rd.dataLo : lo, dataHi = rd ? rd.dataHi : hi;
  if (lo === hi) { const d = Math.abs(lo) || 1; lo -= d * 0.5; hi += d * 0.5; }
  if (log) {
    if (lo <= 0) lo = 1e-12;
    lo = Math.pow(10, Math.floor(Math.log10(lo)));
    hi = Math.pow(10, Math.ceil(Math.log10(hi)));
    if (hi <= lo) hi = lo * 10;
  } else {
    const pad = (hi - lo) * 0.06;
    lo -= pad; hi += pad;
  }
  // The padded range can swallow a small excursion; the clip flag must describe
  // what is ACTUALLY off-plot, not what the unpadded statistic excluded.
  return { lo, hi, clipLow: !!rd && rd.clipLow && dataLo < lo, clipHigh: !!rd && rd.clipHigh && dataHi > hi, dataLo, dataHi };
}

interface LegendItem { label: string; colors: string[]; axis: PlotAxis; }

/**
 * Collapse `.step` variant families into one legend row.
 *
 * Names look like `V(out)[R1=1k]`; a 12-value sweep would otherwise emit 12
 * rows, overflow, and get truncated — losing trace identity entirely. We group
 * by base + swept parameter and render ONE row, "V(out)  R1: 1k→20k", with a
 * gradient key spanning the family's shade ramp.
 */
function buildLegend(series: PlotSeries[], seriesR: PlotSeries[]): LegendItem[] {
  const raw = [
    ...series.map((s) => ({ s, axis: "L" as const })),
    ...seriesR.map((s) => ({ s, axis: "R" as const })),
  ];
  type G = LegendItem & { param?: string; lo?: string; hi?: string };
  const groups = new Map<string, G>();
  const order: string[] = [];
  for (const { s, axis } of raw) {
    const m = /^(.*?)\[([^=\]]+)=([^\]]*)\]$/.exec(s.name);
    if (m) {
      const key = `${axis}|${m[1]}|${m[2]}`;
      let g = groups.get(key);
      if (!g) { g = { label: m[1], colors: [], axis, param: m[2] }; groups.set(key, g); order.push(key); }
      if (g.lo === undefined) g.lo = m[3];
      g.hi = m[3];
      g.colors.push(s.color);
    } else {
      const key = `single|${axis}|${s.name}|${order.length}`;
      groups.set(key, { label: s.name, colors: [s.color], axis });
      order.push(key);
    }
  }
  return order.map((k) => {
    const g = groups.get(k)!;
    if (g.param !== undefined) {
      const range = g.lo === g.hi ? g.lo : `${g.lo}→${g.hi}`;
      return { label: `${g.label}  ${g.param}: ${range}`, colors: g.colors, axis: g.axis };
    }
    return { label: g.label, colors: g.colors, axis: g.axis };
  });
}

interface LegendRow { items: { item: LegendItem; x: number; w: number }[]; }
const LEGEND_KEY_W = 12, LEGEND_KEY_GAP = 6, LEGEND_ITEM_GAP = 18;

/** Flow legend items left→right, wrapping. Rows are counted BEFORE anything is
 *  drawn so the top band can be reserved — the plot never resizes when a trace
 *  is added, which is the layout shift the brief forbids. */
function layoutLegend(ctx: CanvasRenderingContext2D, items: LegendItem[], maxW: number): { rows: LegendRow[]; overflow: number } {
  ctx.font = FONT_LABEL;
  const rows: LegendRow[] = [];
  let row: LegendRow = { items: [] };
  let x = 0;
  let overflow = 0;
  for (let i = 0; i < items.length; i++) {
    const w = LEGEND_KEY_W + LEGEND_KEY_GAP + ctx.measureText(items[i].label).width;
    if (row.items.length > 0 && x + w > maxW) {
      rows.push(row);
      if (rows.length >= LEGEND_MAX_ROWS) { overflow = items.length - i; break; }
      row = { items: [] }; x = 0;
    }
    row.items.push({ item: items[i], x, w });
    x += w + LEGEND_ITEM_GAP;
  }
  if (overflow === 0 && row.items.length) rows.push(row);
  return { rows, overflow };
}

interface Layout {
  plot: PlotRect;
  xs: PlotScale; ysL: PlotScale; ysR: PlotScale | null;
  xMajor: number[]; xMinor: number[];
  yMajor: number[]; yMinorL: number[];
  yMajorR: number[];
  xUnit: string; yUnit: string; yUnitR: string;
  legend: { rows: LegendRow[]; overflow: number };
  showX: boolean;
  gutter: PlotGutter;
  topBand: number; bottomBand: number;
  dL: Domain; dR: Domain;
}

/** Everything the renderer needs, measured. Split out from drawing so
 *  `measureGutter` can run it without painting (the shared-axis Bode pair). */
function planLayout(ctx: CanvasRenderingContext2D, rect: PlotRect, opts: PlotOpts): Layout {
  const { x, series, seriesR = [], xLabel, yLabel, yLabelR, xLog, yLog, yLogR, xDomain, dbFloor } = opts;
  const hasR = seriesR.length > 0;
  const showX = opts.showXAxis !== false;
  const xUnit = axisUnit(xLabel);
  const yUnit = axisUnit(yLabel);
  const yUnitR = axisUnit(yLabelR);

  // ── x domain ──
  let xLo = 0, xHi = 1;
  const xExt = extent([x], { positiveOnly: !!xLog });
  if (xExt) { xLo = xExt[0]; xHi = xExt[1]; }
  if (xLo === xHi) { xLo -= 1; xHi += 1; }
  if (xDomain && isFinite(xDomain[0]) && isFinite(xDomain[1]) && xDomain[0] !== xDomain[1]
      && (!xLog || (xDomain[0] > 0 && xDomain[1] > 0))) {
    xLo = Math.min(xDomain[0], xDomain[1]); xHi = Math.max(xDomain[0], xDomain[1]);
  }
  if (xLog) { if (xLo <= 0) xLo = 1e-12; if (xHi <= xLo) xHi = xLo * 10; }

  // ── y domains ──
  const dL = autoRange(series, yLog, dbFloor, yUnit, opts.robustY, !!opts.degraded);
  const dR = hasR ? autoRange(seriesR, yLogR, undefined, yUnitR, opts.robustY, !!opts.degraded)
    : { lo: 0, hi: 1, clipLow: false, clipHigh: false, dataLo: 0, dataHi: 1 };

  // ── vertical bands (independent of the horizontal gutter) ──
  const titles = opts.axisTitles !== false;
  const legendItems = opts.legend !== false && series.length + seriesR.length >= 2 ? buildLegend(series, seriesR) : [];
  // Legend width is bounded by the rect, not the plot: measuring against the
  // plot width would need the gutter, which needs the legend row count. One
  // pass with a slightly generous bound; a wrapped row costs 16 px, not a jump.
  const legend = legendItems.length
    ? layoutLegend(ctx, legendItems, Math.max(80, rect.w - 56))
    : { rows: [] as LegendRow[], overflow: 0 };
  // +10 rather than +6: the topmost y tick label is CENTRED on the axis top and
  // reaches ~4 px above it, so the legend's descenders need that much clearance
  // or the two rows touch on a short panel.
  const legendH = legend.rows.length ? legend.rows.length * LEGEND_ROW + 10 : 0;
  // 8 px of head-room keeps the topmost y tick label (centred on the axis top)
  // from clipping against the rect edge.
  const topBand = Math.max(8, legendH);
  const bottomBand = !showX ? 8
    : TICK_LEN + TICK_GAP + TICK_ASCENT + (titles && axisTitle(xLabel) ? AXIS_TITLE_GAP + TICK_ASCENT + 4 : 4);

  // ── horizontal gutter: measure the widest tick label that will actually be
  //    drawn. Done in two passes because tick VALUES depend on plot height,
  //    which depends on nothing horizontal — so one pass is exact here. ──
  const plotH0 = Math.max(1, rect.h - topBand - bottomBand);
  ctx.font = FONT_TICK;
  const measureAxis = (d: Domain, log: boolean | undefined, unit: string, hasTitle: boolean): { width: number; ticks: number[]; minor: number[] } => {
    const t = log ? logTicks(d.lo, d.hi) : { major: linearTicks(d.lo, d.hi, Math.max(2, Math.min(8, Math.round(plotH0 / 44)))), minor: [] as number[] };
    const scale = makeScale(d.lo, d.hi, 0, plotH0, !!log, true);
    // Thin FIRST, then measure only the survivors — sizing the gutter against
    // labels that will be dropped wastes plot width on every axis.
    const kept = thinTicks(t.major, t.major.map(scale.toPx), t.major.map(() => TICK_ASCENT), MIN_TICK_GAP_Y);
    let wMax = 0;
    for (const v of kept) wMax = Math.max(wMax, ctx.measureText(formatTick(v, unit)).width);
    return { width: Math.ceil(wMax) + TICK_LEN + TICK_GAP + (hasTitle ? TICK_ASCENT + 6 : 0) + 2, ticks: kept, minor: t.minor };
  };
  const leftM = measureAxis(dL, yLog, yUnit, titles && (!!axisTitle(yLabel) || !!yUnit));
  const rightM = hasR ? measureAxis(dR, yLogR, yUnitR, titles && (!!axisTitle(yLabelR) || !!yUnitR)) : null;

  const gutter: PlotGutter = opts.gutter ?? {
    left: Math.max(28, leftM.width),
    // Without a right axis we still reserve 14 px so the final x tick label,
    // which is centred on the axis end, has somewhere to sit.
    right: rightM ? Math.max(28, rightM.width) : 14,
  };

  const plot: PlotRect = {
    x: rect.x + gutter.left,
    y: rect.y + topBand,
    w: Math.max(1, rect.w - gutter.left - gutter.right),
    h: Math.max(1, rect.h - topBand - bottomBand),
  };
  const xs = makeScale(xLo, xHi, plot.x, plot.w, !!xLog, false);
  const ysL = makeScale(dL.lo, dL.hi, plot.y, plot.h, !!yLog, true);
  const ysR = hasR ? makeScale(dR.lo, dR.hi, plot.y, plot.h, !!yLogR, true) : null;

  // ── x ticks, thinned against MEASURED label widths ──
  const xt = xLog ? logTicks(xs.min, xs.max) : { major: linearTicks(xs.min, xs.max, Math.max(2, Math.min(9, Math.round(plot.w / 88)))), minor: [] };
  const xLabels = xt.major.map((v) => formatTick(v, xUnit));
  const xMajor = thinTicks(xt.major, xt.major.map(xs.toPx), xLabels.map((s) => ctx.measureText(s).width), MIN_TICK_GAP_X);
  // Minor ticks only earn their ink when the majors are sparse enough to leave
  // room; at 3 px pitch they turn the plot into a grey wash.
  const xMinorRaw = xt.minor.filter((v) => v >= xs.min && v <= xs.max);
  const xMinor = xMinorRaw.length && plot.w / xMinorRaw.length >= 5 ? xMinorRaw : [];

  const yMinorRaw = leftM.minor.filter((v) => v >= ysL.min && v <= ysL.max);
  const yMinorL = yMinorRaw.length && plot.h / yMinorRaw.length >= 5 ? yMinorRaw : [];

  return {
    plot, xs, ysL, ysR,
    xMajor, xMinor,
    yMajor: leftM.ticks, yMinorL,
    yMajorR: rightM ? rightM.ticks : [],
    xUnit, yUnit, yUnitR,
    legend, showX, gutter, topBand, bottomBand,
    dL, dR,
  };
}

/**
 * The horizontal margins this panel needs. Take the max across the panels of a
 * stacked pair and feed it back as `PlotOpts.gutter` so both plot rects start
 * and end on the same pixel column — a shared x-axis that is off by 3 px reads
 * as two unrelated charts and makes a shared cursor a lie.
 */
export function measureGutter(ctx: CanvasRenderingContext2D, rect: PlotRect, opts: PlotOpts): PlotGutter {
  ctx.save();
  const g = planLayout(ctx, rect, { ...opts, gutter: undefined }).gutter;
  ctx.restore();
  return g;
}
/** Merge two panels' gutters into the one both must use. */
export function mergeGutters(a: PlotGutter, b: PlotGutter): PlotGutter {
  return { left: Math.max(a.left, b.left), right: Math.max(a.right, b.right) };
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════════════════

const crisp = (v: number) => Math.round(v) + 0.5;

export function drawLinePlot(ctx: CanvasRenderingContext2D, rect: PlotRect, opts: PlotOpts): void {
  const { x, series, seriesR = [], xLabel, yLabel, yLabelR, yLog, yLogR, cursor, dbFloor } = opts;
  const hasR = seriesR.length > 0;
  const isFloored = (v: number) => dbFloor != null && v <= dbFloor;

  ctx.save();
  ctx.font = FONT_TICK;
  ctx.textBaseline = "alphabetic";

  // ── EMPTY STATE ──
  // No axes, no frame, no phantom 0 / 0.5 / 1. A framed box with a synthetic
  // axis on it is indistinguishable from a broken plot; a sentence and a
  // call-to-action is not.
  if (series.length === 0 && !hasR && !opts.loading) {
    const e = opts.empty;
    if (e) drawEmptyState(ctx, rect, e);
    ctx.restore();
    return;
  }

  const L = planLayout(ctx, rect, opts);
  const { plot, xs, ysL, ysR } = L;
  opts.onDomain?.({
    plotX: plot.x, plotY: plot.y, plotW: plot.w, plotH: plot.h,
    xMin: xs.min, xMax: xs.max, xLog: !!opts.xLog,
    yMin: ysL.min, yMax: ysL.max,
    yClipLow: L.dL.clipLow, yClipHigh: L.dL.clipHigh,
    yDataMin: L.dL.dataLo, yDataMax: L.dL.dataHi,
  });

  // ── plot-area surface: a barely-there lift so the data field reads as its
  //    own surface without needing a border around it ──
  ctx.fillStyle = "rgba(255,255,255,0.013)";
  ctx.fillRect(plot.x, plot.y, plot.w, plot.h);

  // ── LOADING ──
  // Reserve the real plot rect, draw the axis rules and ghost traces, and stop.
  // Crucially we do NOT draw ticks: the caller has no data yet, so any tick row
  // would be the invented "0 / 0.5 / 1" axis that reads as a broken chart. The
  // rect is measured from the same layout the results will use, so nothing
  // moves when they arrive.
  if (opts.loading) {
    ctx.save();
    ctx.strokeStyle = AXIS_RULE; ctx.globalAlpha = 0.4; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(crisp(plot.x), plot.y); ctx.lineTo(crisp(plot.x), plot.y + plot.h);
    ctx.moveTo(plot.x, crisp(plot.y + plot.h)); ctx.lineTo(plot.x + plot.w, crisp(plot.y + plot.h));
    ctx.stroke();
    ctx.restore();
    drawSkeleton(ctx, plot);
    ctx.restore();
    return;
  }

  // ── evidence: acceptance bands, UNDER the grid so the grid still reads
  //    through them and the band never competes with the data ──
  if (opts.bands?.length) drawBands(ctx, plot, opts.bands, xs, ysL, ysR);

  // ── grid ──
  ctx.lineWidth = 1;
  if (L.xMinor.length || L.yMinorL.length) {
    ctx.save();
    ctx.strokeStyle = GRID; ctx.globalAlpha = 0.42;
    ctx.beginPath();
    for (const t of L.xMinor) { const px = crisp(xs.toPx(t)); ctx.moveTo(px, plot.y); ctx.lineTo(px, plot.y + plot.h); }
    for (const t of L.yMinorL) { const py = crisp(ysL.toPx(t)); ctx.moveTo(plot.x, py); ctx.lineTo(plot.x + plot.w, py); }
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.strokeStyle = GRID; ctx.globalAlpha = 0.9;
  ctx.beginPath();
  for (const t of L.xMajor) { if (t < xs.min || t > xs.max) continue; const px = crisp(xs.toPx(t)); ctx.moveTo(px, plot.y); ctx.lineTo(px, plot.y + plot.h); }
  // Horizontal grid follows the LEFT axis only (LTspice convention). Two
  // interleaved grids for two scales is unreadable; the right axis gets ticks.
  for (const t of L.yMajor) { if (t < ysL.min || t > ysL.max) continue; const py = crisp(ysL.toPx(t)); ctx.moveTo(plot.x, py); ctx.lineTo(plot.x + plot.w, py); }
  ctx.stroke();
  ctx.restore();

  // zero line: one step above the grid, because "is this trace above or below
  // zero" is the single most common read on a transient.
  if (!yLog && ysL.min < 0 && ysL.max > 0) {
    ctx.save();
    ctx.strokeStyle = TOKENS.ink.tertiary; ctx.globalAlpha = 0.8; ctx.lineWidth = 1;
    const z = crisp(ysL.toPx(0));
    ctx.beginPath(); ctx.moveTo(plot.x, z); ctx.lineTo(plot.x + plot.w, z); ctx.stroke();
    ctx.restore();
  }

  // ── axis rules: left + bottom (+ right when a second scale exists). No top
  //    or full box — whitespace separates the plot from the legend above it. ──
  ctx.save();
  ctx.strokeStyle = AXIS_RULE; ctx.globalAlpha = 0.75; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(crisp(plot.x), plot.y); ctx.lineTo(crisp(plot.x), plot.y + plot.h);
  ctx.moveTo(plot.x, crisp(plot.y + plot.h)); ctx.lineTo(plot.x + plot.w, crisp(plot.y + plot.h));
  if (hasR) { ctx.moveTo(crisp(plot.x + plot.w), plot.y); ctx.lineTo(crisp(plot.x + plot.w), plot.y + plot.h); }
  ctx.stroke();
  ctx.restore();

  // ── tick marks + labels ──
  ctx.fillStyle = TEXT_DIM;
  ctx.strokeStyle = AXIS_RULE;
  ctx.save();
  ctx.globalAlpha = 0.75; ctx.beginPath();
  for (const t of L.yMajor) { if (t < ysL.min || t > ysL.max) continue; const py = crisp(ysL.toPx(t)); ctx.moveTo(plot.x - TICK_LEN, py); ctx.lineTo(plot.x, py); }
  if (L.showX) for (const t of L.xMajor) { if (t < xs.min || t > xs.max) continue; const px = crisp(xs.toPx(t)); ctx.moveTo(px, plot.y + plot.h); ctx.lineTo(px, plot.y + plot.h + TICK_LEN); }
  if (ysR) for (const t of L.yMajorR) { if (t < ysR.min || t > ysR.max) continue; const py = crisp(ysR.toPx(t)); ctx.moveTo(plot.x + plot.w, py); ctx.lineTo(plot.x + plot.w + TICK_LEN, py); }
  ctx.stroke();
  ctx.restore();

  ctx.font = FONT_TICK;
  ctx.textAlign = "right";
  for (const t of L.yMajor) {
    if (t < ysL.min || t > ysL.max) continue;
    ctx.fillText(formatTick(t, L.yUnit), plot.x - TICK_LEN - TICK_GAP + 4, ysL.toPx(t) + 3.5);
  }
  if (ysR) {
    ctx.textAlign = "left";
    for (const t of L.yMajorR) {
      if (t < ysR.min || t > ysR.max) continue;
      ctx.fillText(formatTick(t, L.yUnitR), plot.x + plot.w + TICK_LEN + TICK_GAP - 4, ysR.toPx(t) + 3.5);
    }
  }
  if (L.showX) {
    const rowY = plot.y + plot.h + TICK_LEN + TICK_GAP + TICK_ASCENT - 2;
    ctx.textAlign = "center";
    for (const t of L.xMajor) {
      if (t < xs.min || t > xs.max) continue;
      const label = formatTick(t, L.xUnit);
      const w = ctx.measureText(label).width;
      // Clamp the end labels into the rect instead of letting them bleed past
      // the panel edge (where a neighbouring panel would clip them).
      const cx = Math.max(rect.x + w / 2 + 2, Math.min(rect.x + rect.w - w / 2 - 2, xs.toPx(t)));
      ctx.fillText(label, cx, rowY);
    }
    // x-axis title sits a full text-height BELOW the tick row — the collision
    // the previous layout shipped ("time (s)" drawn on top of the ticks).
    //
    // The title carries the QUANTITY only ("time"), never the unit: every tick
    // below it already reads "200 ms". Printing "time (s)" under a row of
    // millisecond labels states the unit twice and, worse, states it in a
    // different one. The y axis is titled by the same rule, so both axes agree.
    const xt = opts.axisTitles !== false ? axisTitle(xLabel) : "";
    if (xt) {
      ctx.fillStyle = TEXT;
      ctx.font = FONT_LABEL;
      ctx.textAlign = "center";
      ctx.fillText(xt, plot.x + plot.w / 2, rowY + AXIS_TITLE_GAP + TICK_ASCENT);
    }
  }

  // ── y-axis titles: rotated in their own reserved column. Rotation is what
  //    lets the title live beside the ticks instead of on top of them. ──
  // The " · clipped" suffix is not decoration: an axis whose range excludes part
  // of the data must SAY so, or the reader takes the visible peak for the peak.
  if (opts.axisTitles !== false) {
    drawRotatedAxisTitle(ctx, yLabel, plot, "left", L.gutter.left, L.dL.clipLow || L.dL.clipHigh);
    if (hasR) drawRotatedAxisTitle(ctx, yLabelR, plot, "right", L.gutter.right, L.dR.clipLow || L.dR.clipHigh);
  }

  // ── traces ──
  ctx.save();
  ctx.beginPath(); ctx.rect(plot.x, plot.y, plot.w, plot.h); ctx.clip();
  ctx.lineWidth = 2;                     // house mark spec: 2 px lines
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // 0.45, not 0.6: a degraded curve has to read as *withdrawn* at a glance, and
  // the hatch drawn over it below has to remain visible through the ink.
  if (opts.degraded) ctx.globalAlpha = 0.45;
  drawSeriesSet(ctx, x, series, xs, ysL, plot, { log: yLog, floor: dbFloor, xLog: opts.xLog });
  if (ysR) {
    // Right-axis traces are dashed so it is instantly clear they are read
    // against a different scale — the dual-scale ambiguity is otherwise silent.
    ctx.setLineDash([5, 3]);
    drawSeriesSet(ctx, x, seriesR, xs, ysR, plot, { log: yLogR, xLog: opts.xLog });
    ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;

  // ── clipped excursions ──
  // Everything the robust range excluded is marked ON the edge it left through,
  // in its own trace colour. Nothing is hidden: the reader can see exactly WHERE
  // and HOW OFTEN the curve went off-scale, which is the whole justification for
  // not letting it set the scale.
  if (L.dL.clipLow || L.dL.clipHigh) drawClipMarks(ctx, plot, x, series, xs, ysL, opts.xLog);
  if (ysR && (L.dR.clipLow || L.dR.clipHigh)) drawClipMarks(ctx, plot, x, seriesR, xs, ysR, opts.xLog);

  // ── divergence ──
  if (opts.divergenceX != null && isFinite(opts.divergenceX)) drawDivergenceRule(ctx, plot, xs, opts.divergenceX, L.xUnit);

  // ── evidence: targets then markers, above the data so a spec line is never
  //    buried under a trace ──
  if (opts.targets?.length) drawTargets(ctx, plot, opts.targets, xs, ysL, ysR);
  if (opts.markers?.length) drawMarkers(ctx, plot, opts.markers, xs, ysL, ysR);
  ctx.restore();

  // ── A/B cursors ──
  if (opts.cursors && x.length) drawABCursors(ctx, plot, xs, x, opts.cursors);

  // ── legend ──
  if (L.legend.rows.length) drawLegend(ctx, L, rect);

  // ── degraded: a faint red wash over the whole data field, on top of the
  //    dimmed traces. Deliberately NOT a corner badge — a badge has to win a
  //    fight with the hover readout and the legend for the same 200 px, and it
  //    would be the fourth place this is already said (DOM banner, red-tinted
  //    analysis tab, dimmed curve). The wash cannot collide with anything and
  //    survives a screenshot, which is the point: this curve must never be
  //    croppable into something that looks authoritative. ──
  if (opts.degraded) {
    ctx.save();
    ctx.beginPath(); ctx.rect(plot.x, plot.y, plot.w, plot.h); ctx.clip();
    ctx.fillStyle = "rgba(255,69,58,0.035)";
    ctx.fillRect(plot.x, plot.y, plot.w, plot.h);
    // Diagonal hatch: the one mark in this chart language that cannot be
    // mistaken for data (no waveform is a 45° comb) and that survives a crop.
    // Dashing the traces themselves is not available — a dash already means
    // "read against the right axis" here, and two meanings for one mark is how
    // a chart starts lying.
    ctx.strokeStyle = TOKENS.status.error;
    ctx.globalAlpha = 0.075;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let d = -Math.ceil(plot.h); d < plot.w; d += 9) {
      ctx.moveTo(plot.x + d, plot.y + plot.h);
      ctx.lineTo(plot.x + d + plot.h, plot.y);
    }
    ctx.stroke();
    // Centre watermark. Dead centre is the only region no other element claims
    // (legend top, ticks at the edges, readout box top-corner, cursor caps
    // bottom), so it can never collide. Skipped outright when it would not fit
    // with padding — a clipped word would read as a rendering fault.
    const mark = (opts.degraded.length <= 24 ? opts.degraded : "unreliable").toUpperCase();
    ctx.font = FONT_EMPTY_TITLE;
    const mw = ctx.measureText(mark).width;
    if (mw + 24 <= plot.w && plot.h >= 48) {
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = TOKENS.status.error;
      ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillText(mark, plot.x + plot.w / 2, plot.y + plot.h / 2 + 4);
    }
    ctx.restore();
  }

  // ── hover crosshair + readout ──
  if (cursor != null && cursor >= plot.x && cursor <= plot.x + plot.w && x.length > 0) {
    drawHoverReadout(ctx, plot, opts, L, xs, ysL, ysR, cursor, isFloored);
  }

  ctx.restore();
}

// ── trace rendering ─────────────────────────────────────────────────────────

function drawSeriesSet(
  ctx: CanvasRenderingContext2D, x: number[], set: PlotSeries[],
  xs: PlotScale, ys: PlotScale, plot: PlotRect,
  o: { log?: boolean; floor?: number; xLog?: boolean },
): void {
  if (!set.length || !x.length) return;
  // Only walk the samples that can land inside the visible window. Zoomed into
  // 1 % of a 200 k-point transient this turns a 200 k-sample loop per frame
  // into a 2 k-sample loop, which is the difference between 60 fps panning and
  // a slideshow.
  const [i0, i1] = visibleRange(x, xs.min, xs.max);
  const nVis = i1 - i0 + 1;
  const decimate = nVis > plot.w * 2 && nVis > 4;
  const validX = (v: number) => isFinite(v) && (!o.xLog || v > 0);
  for (const s of set) {
    const valid = (xv: number, yv: number) =>
      validX(xv) && isFinite(yv) && (!o.log || yv > 0) && !(o.floor != null && yv <= o.floor);
    ctx.strokeStyle = s.color;
    ctx.beginPath();
    if (!decimate) {
      const hi = Math.min(i1, s.y.length - 1);
      let started = false;
      for (let i = i0; i <= hi; i++) {
        const xv = x[i], yv = s.y[i];
        if (!valid(xv, yv)) { started = false; continue; }
        const px = xs.toPx(xv), py = ys.toPx(yv);
        if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
      }
    } else {
      const cols = decimateMinMax(x, s.y, i0, i1, (v) => Math.round(xs.toPx(v)), valid);
      let prev: PlotColumn | null = null;
      for (const c of cols) {
        if (c === null) { prev = null; continue; }
        // Connect from the previous column's LAST sample to this column's FIRST
        // so the trace is continuous and no false vertical jump is invented.
        if (prev) { ctx.moveTo(prev.col, ys.toPx(prev.yLast)); ctx.lineTo(c.col, ys.toPx(c.yFirst)); }
        // The column's full vertical extent: this is what makes a 1-sample
        // spike survive decimation.
        ctx.moveTo(c.col, ys.toPx(c.yMin));
        ctx.lineTo(c.col, ys.toPx(c.yMax));
        prev = c;
      }
    }
    ctx.stroke();
  }
}

/**
 * Mark every excursion the y-range excluded, on the edge it left through.
 *
 * A 3 px bar in the trace's own colour spans the x-range of each run that is
 * off-scale, with an outward chevron at its midpoint. This is the contract that
 * makes robust ranging honest: the scale ignores the artefact, the edge still
 * says "the curve is off the plot HERE, and here, and here". A minimum 2 px bar
 * width guarantees a single-sample excursion is still visible.
 */
function drawClipMarks(
  ctx: CanvasRenderingContext2D, plot: PlotRect, x: number[], set: PlotSeries[],
  xs: PlotScale, ys: PlotScale, xLog?: boolean,
): void {
  if (!set.length || !x.length) return;
  const [i0, i1] = visibleRange(x, xs.min, xs.max);
  const BAR = 3;
  ctx.save();
  ctx.beginPath(); ctx.rect(plot.x, plot.y, plot.w, plot.h); ctx.clip();
  for (const s of set) {
    const hi = Math.min(i1, s.y.length - 1, x.length - 1);
    let runStart = -1, runSide = 0;
    const flush = (endIdx: number) => {
      if (runStart < 0) return;
      const a = xs.toPx(x[runStart]), b = xs.toPx(x[endIdx]);
      runStart = -1;
      if (!isFinite(a) || !isFinite(b)) return;
      const x0 = Math.max(plot.x, Math.min(a, b));
      const x1 = Math.min(plot.x + plot.w, Math.max(a, b));
      if (x1 < plot.x || x0 > plot.x + plot.w) return;
      const w = Math.max(2, x1 - x0);
      const top = runSide > 0;
      const y0 = top ? plot.y : plot.y + plot.h - BAR;
      ctx.fillStyle = s.color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x0, y0, w, BAR);
      // Outward chevron: the direction the data went, at a glance.
      const cx = x0 + w / 2;
      ctx.beginPath();
      if (top) { ctx.moveTo(cx - 4, plot.y + BAR + 5); ctx.lineTo(cx, plot.y + BAR + 1); ctx.lineTo(cx + 4, plot.y + BAR + 5); }
      else { ctx.moveTo(cx - 4, plot.y + plot.h - BAR - 5); ctx.lineTo(cx, plot.y + plot.h - BAR - 1); ctx.lineTo(cx + 4, plot.y + plot.h - BAR - 5); }
      ctx.closePath();
      ctx.globalAlpha = 0.95;
      ctx.fill();
    };
    for (let i = Math.max(0, i0); i <= hi; i++) {
      const xv = x[i], yv = s.y[i];
      const usable = isFinite(xv) && (!xLog || xv > 0) && isFinite(yv);
      const side = !usable ? 0 : yv > ys.max ? 1 : yv < ys.min ? -1 : 0;
      if (side !== runSide) {
        if (runSide !== 0) flush(i > 0 ? i - 1 : 0);
        runSide = side;
        runStart = side !== 0 ? i : -1;
      }
    }
    if (runSide !== 0) flush(hi);
  }
  ctx.restore();
}

/**
 * The x position where the solution came apart, drawn ON the axis.
 *
 * A failed run's most useful number is "it was fine until here". The rule is
 * solid error-red (a dashed line already means "spec threshold"), it carries a
 * tick on the axis, and it is labelled with the x value in the axis' own units
 * so the reader can go straight to that point in the schematic's timeline.
 */
function drawDivergenceRule(ctx: CanvasRenderingContext2D, plot: PlotRect, xs: PlotScale, xv: number, xUnit: string): void {
  const px = xs.toPx(xv);
  if (!isFinite(px) || px < plot.x - 0.5 || px > plot.x + plot.w + 0.5) return;
  const cx = crisp(Math.max(plot.x, Math.min(plot.x + plot.w, px)));
  ctx.save();
  ctx.beginPath(); ctx.rect(plot.x, plot.y, plot.w, plot.h); ctx.clip();
  ctx.strokeStyle = TOKENS.status.error;
  ctx.globalAlpha = 0.9; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx, plot.y); ctx.lineTo(cx, plot.y + plot.h); ctx.stroke();
  // Solid wedge on the axis, pointing at the sample.
  ctx.globalAlpha = 1;
  ctx.fillStyle = TOKENS.status.error;
  ctx.beginPath();
  ctx.moveTo(cx - 5, plot.y + plot.h);
  ctx.lineTo(cx + 5, plot.y + plot.h);
  ctx.lineTo(cx, plot.y + plot.h - 7);
  ctx.closePath(); ctx.fill();
  // Label above the wedge, flipped to whichever side has room.
  ctx.font = FONT_LABEL;
  const label = `diverges ${formatTick(xv, xUnit)}`;
  const tw = ctx.measureText(label).width;
  if (tw + 20 <= plot.w && plot.h >= 40) {
    const right = cx + 8 + tw + 6 <= plot.x + plot.w;
    // Clamp rather than let the plate run out of the plot: a label half outside
    // the frame reads as a rendering fault on the one annotation that matters.
    const tx = Math.max(plot.x + 6, right ? cx + 8 : cx - 8 - tw);
    // −24 clears the 15 px A/B cursor caps that live flush with the bottom of
    // the plot; at −14 the two plates would stack on the same pixels whenever a
    // cursor is parked near the divergence.
    const ty = plot.y + plot.h - 24;
    ctx.fillStyle = "rgba(11,11,12,0.86)";
    roundRect(ctx, tx - 4, ty - 12, tw + 8, 17, 8); ctx.fill();
    ctx.fillStyle = TOKENS.status.error;
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText(label, tx, ty);
  }
  ctx.restore();
}

// ── evidence overlays ───────────────────────────────────────────────────────

const pickScale = (axis: PlotAxis | undefined, ysL: PlotScale, ysR: PlotScale | null) => (axis === "R" && ysR ? ysR : ysL);

function drawBands(ctx: CanvasRenderingContext2D, plot: PlotRect, bands: PlotBand[], xs: PlotScale, ysL: PlotScale, ysR: PlotScale | null): void {
  ctx.save();
  ctx.beginPath(); ctx.rect(plot.x, plot.y, plot.w, plot.h); ctx.clip();
  ctx.font = FONT_LABEL;
  for (const b of bands) {
    const ys = pickScale(b.axis, ysL, ysR);
    const r = clipBand(b, xs.toPx, ys.toPx, plot);
    if (!r) continue;
    const color = b.pass === true ? TOKENS.status.ok : b.pass === false ? TOKENS.status.error : TOKENS.accent;
    ctx.globalAlpha = 0.10;                 // house spec: an area wash, never a block
    ctx.fillStyle = color;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    // Solid hairline on the BOUNDED edges only, so the reader can see exactly
    // where the acceptance region stops. An unbounded edge gets no rule (there
    // is nothing there to bound).
    ctx.globalAlpha = 0.38;
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath();
    if (b.y1 != null) { ctx.moveTo(r.x, crisp(r.y)); ctx.lineTo(r.x + r.w, crisp(r.y)); }
    if (b.y0 != null) { ctx.moveTo(r.x, crisp(r.y + r.h)); ctx.lineTo(r.x + r.w, crisp(r.y + r.h)); }
    if (b.x0 != null) { ctx.moveTo(crisp(r.x), r.y); ctx.lineTo(crisp(r.x), r.y + r.h); }
    if (b.x1 != null) { ctx.moveTo(crisp(r.x + r.w), r.y); ctx.lineTo(crisp(r.x + r.w), r.y + r.h); }
    ctx.stroke();
    // Only label when the text fits INSIDE the band with padding on both sides.
    // A clipped half-word is worse than no word; the caller's readout carries it.
    if (b.label) {
      const tw = ctx.measureText(b.label).width;
      if (tw + 16 <= r.w && r.h >= 20) {
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = color;
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        ctx.fillText(b.label, r.x + 8, r.y + 14);
      }
    }
  }
  ctx.restore();
}

function drawTargets(ctx: CanvasRenderingContext2D, plot: PlotRect, targets: PlotTarget[], xs: PlotScale, ysL: PlotScale, ysR: PlotScale | null): void {
  ctx.save();
  ctx.font = FONT_LABEL;
  ctx.lineWidth = 1;
  for (const t of targets) {
    const color = STATUS[t.status ?? "neutral"];
    const ys = pickScale(t.axis, ysL, ysR);
    let px0: number, py0: number, px1: number, py1: number;
    if (t.y != null) {
      const py = ys.toPx(t.y);
      if (!isFinite(py) || py < plot.y - 0.5 || py > plot.y + plot.h + 0.5) continue;
      px0 = plot.x; px1 = plot.x + plot.w; py0 = py1 = crisp(py);
    } else if (t.x != null) {
      const px = xs.toPx(t.x);
      if (!isFinite(px) || px < plot.x - 0.5 || px > plot.x + plot.w + 0.5) continue;
      py0 = plot.y; py1 = plot.y + plot.h; px0 = px1 = crisp(px);
    } else continue;
    ctx.strokeStyle = color; ctx.globalAlpha = 0.85;
    // Dashed ON PURPOSE and only here: a dash reads as "threshold", which is
    // exactly what a target is. Grid and axis rules stay solid so the two can
    // never be confused.
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(px1, py1); ctx.stroke();
    ctx.setLineDash([]);
    // Label on a small plate at the far end, so it stays readable where a trace
    // crosses it.
    const tw = ctx.measureText(t.label).width;
    ctx.globalAlpha = 1;
    if (t.y != null) {
      const bx = plot.x + plot.w - tw - 14, by = py0 - 9;
      if (bx > plot.x + 4) {
        ctx.fillStyle = "rgba(11,11,12,0.86)";
        roundRect(ctx, bx - 4, by, tw + 12, 18, 9); ctx.fill();
        ctx.fillStyle = color; ctx.textAlign = "left"; ctx.fillText(t.label, bx + 2, by + 13);
      }
    } else {
      const bx = px0 + 6, by = plot.y + 6;
      const fits = bx + tw + 12 <= plot.x + plot.w;
      const ax = fits ? bx : px0 - tw - 14;
      ctx.fillStyle = "rgba(11,11,12,0.86)";
      roundRect(ctx, ax - 4, by, tw + 12, 18, 9); ctx.fill();
      ctx.fillStyle = color; ctx.textAlign = "left"; ctx.fillText(t.label, ax + 2, by + 13);
    }
  }
  ctx.restore();
}

function drawMarkers(ctx: CanvasRenderingContext2D, plot: PlotRect, markers: PlotMarker[], xs: PlotScale, ysL: PlotScale, ysR: PlotScale | null): void {
  ctx.save();
  ctx.font = FONT_LABEL;
  ctx.textBaseline = "alphabetic";
  for (const m of markers) {
    const ys = pickScale(m.axis, ysL, ysR);
    const px = xs.toPx(m.x), py = ys.toPx(m.y);
    if (!isFinite(px) || !isFinite(py)) continue;
    const tw = ctx.measureText(m.label).width;
    const p = placeMarkerLabel(px, py, tw, plot);
    if (!p.visible) continue;              // off-plot: draw nothing, never clamp to the edge
    const color = STATUS[m.status ?? "neutral"];
    // Leader line first, so the dot's surface ring cuts it cleanly at the mark.
    ctx.strokeStyle = color; ctx.globalAlpha = 0.7; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(p.leaderX, p.leaderY);
    ctx.lineTo(p.align === "right" ? p.textX + 2 : p.textX - 2, p.leaderY); ctx.stroke();
    ctx.globalAlpha = 1;
    // 8 px dot with a 2 px surface ring — legible where it sits on a trace.
    ctx.beginPath(); ctx.arc(px, py, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = TOKENS.canvas.dark; ctx.fill();
    ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    // Label plate keeps the text readable over dense data.
    const lx = p.align === "right" ? p.textX - tw - 6 : p.textX - 2;
    ctx.fillStyle = "rgba(11,11,12,0.86)";
    roundRect(ctx, lx, p.textY - 12, tw + 8, 17, 8); ctx.fill();
    ctx.fillStyle = color;
    ctx.textAlign = p.align === "right" ? "right" : "left";
    ctx.fillText(m.label, p.align === "right" ? p.textX - 2 : p.textX + 2, p.textY);
  }
  ctx.restore();
}

// ── cursors ─────────────────────────────────────────────────────────────────

function drawABCursors(ctx: CanvasRenderingContext2D, plot: PlotRect, xs: PlotScale, xdata: number[], c: PlotCursors): void {
  const paint = (xv: number | null, tag: string) => {
    if (xv == null) return;
    // Snap to the nearest actual sample: a cursor reading a value the solver
    // never computed is a fabricated measurement.
    const idx = snapToSample(xdata, xv);
    if (idx < 0) return;
    const px = xs.toPx(xdata[idx]);
    if (!isFinite(px) || px < plot.x - 0.5 || px > plot.x + plot.w + 0.5) return;
    const cx = crisp(px);
    ctx.save();
    ctx.strokeStyle = TOKENS.accent; ctx.globalAlpha = 0.9; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, plot.y); ctx.lineTo(cx, plot.y + plot.h); ctx.stroke();
    // Cap at the bottom (out of the data's way; the traces live in the middle).
    ctx.globalAlpha = 1;
    ctx.fillStyle = TOKENS.accent;
    roundRect(ctx, cx - 8, plot.y + plot.h - 15, 16, 14, 6); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "10px Inter, ui-sans-serif, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(tag, cx, plot.y + plot.h - 7.5);
    ctx.restore();
  };
  paint(c.a, "A");
  paint(c.b, "B");
}

function drawHoverReadout(
  ctx: CanvasRenderingContext2D, plot: PlotRect, opts: PlotOpts, L: Layout,
  xs: PlotScale, ysL: PlotScale, ysR: PlotScale | null,
  cursorPx: number, isFloored: (v: number) => boolean,
): void {
  const { x, series, seriesR = [], yLog, yLogR, xLabel } = opts;
  const idx = snapToSample(x, xs.toValue(cursorPx));
  if (idx < 0) return;
  const cx = xs.toPx(x[idx]);
  if (!isFinite(cx)) return;

  ctx.save();
  ctx.strokeStyle = TOKENS.ink.secondary; ctx.globalAlpha = 0.4; ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(crisp(cx), plot.y); ctx.lineTo(crisp(cx), plot.y + plot.h); ctx.stroke();
  ctx.restore();

  const mode = opts.readout ?? "full";
  type Row = { name: string; value: string; color: string | null };
  const rows: Row[] = mode === "full"
    ? [{ name: axisTitle(xLabel) || "x", value: formatTick(x[idx], L.xUnit), color: null }]
    : [];
  const addAll = (set: PlotSeries[], ys: PlotScale, log: boolean | undefined, unit: string, floorCheck: boolean) => {
    for (const s of set) {
      const yv = s.y[idx];
      if (!isFinite(yv) || (log && yv <= 0) || (floorCheck && isFloored(yv))) continue;
      const py = ys.toPx(yv);
      if (py >= plot.y - 4 && py <= plot.y + plot.h + 4) {
        // 2 px surface ring so the dot stays legible where traces cross.
        ctx.beginPath(); ctx.arc(cx, py, 5, 0, Math.PI * 2); ctx.fillStyle = TOKENS.canvas.dark; ctx.fill();
        ctx.beginPath(); ctx.arc(cx, py, 3.5, 0, Math.PI * 2); ctx.fillStyle = s.color; ctx.fill();
      }
      rows.push({ name: s.name, value: formatTick(yv, unit), color: s.color });
    }
  };
  addAll(series, ysL, yLog, L.yUnit, true);
  if (ysR) addAll(seriesR, ysR, yLogR, L.yUnitR, false);
  // `line` mode wanted only the crosshair and the dots; both are already drawn.
  if (mode === "line" || rows.length === 0) { ctx.restore(); return; }

  // Two-column readout: names left, values right-aligned to a shared edge.
  // Canvas has no tabular-figure control, so a common right edge is what makes
  // the numbers form an actual column.
  ctx.font = FONT_LABEL;
  const KEY = 16, GAP = 18, PAD = 9;
  let nameW = 0, valW = 0;
  for (const r of rows) {
    nameW = Math.max(nameW, ctx.measureText(r.name).width + (r.color ? KEY : 0));
    valW = Math.max(valW, ctx.measureText(r.value).width);
  }
  const bw = PAD + nameW + GAP + valW + PAD;
  const bh = rows.length * 16 + 10;
  // The box has to fit INSIDE the plot. On a panel too small for it (a 90 px
  // preview, a dock dragged to its minimum with six traces probed) the old code
  // let bx go negative: the readout escaped the canvas on the left and its rows
  // landed on top of the x tick row. Crosshair and per-series dots are already
  // drawn and remain the useful part, so we drop the box rather than print a
  // second, colliding set of numbers over the axis.
  if (bw + 16 > plot.w || bh + 16 > plot.h) { ctx.restore(); return; }
  // Sit on the side the cursor is NOT on, so the box never covers what is
  // being measured.
  const bxRaw = cx > plot.x + plot.w / 2 ? plot.x + 8 : plot.x + plot.w - bw - 8;
  const bx = Math.max(plot.x + 8, Math.min(bxRaw, plot.x + plot.w - bw - 8));
  const by = plot.y + 8;
  ctx.fillStyle = "rgba(18,18,20,0.94)";
  ctx.strokeStyle = GRID; ctx.lineWidth = 1;
  roundRect(ctx, bx, by, bw, bh, 10); ctx.fill(); ctx.stroke();
  ctx.textBaseline = "alphabetic";
  rows.forEach((r, i) => {
    const ry = by + 18 + i * 16;
    if (r.color) {
      ctx.fillStyle = r.color;
      ctx.fillRect(bx + PAD, ry - 6, 10, 2);
    }
    ctx.textAlign = "left";
    ctx.fillStyle = r.color ? TEXT : TEXT_DIM;      // text never wears the data colour
    ctx.fillText(r.name, bx + PAD + (r.color ? KEY : 0), ry);
    ctx.textAlign = "right";
    ctx.fillStyle = r.color ? TOKENS.ink.primary : TEXT_DIM;
    ctx.fillText(r.value, bx + bw - PAD, ry);
  });
  ctx.restore();
}

// ── chrome ──────────────────────────────────────────────────────────────────

function drawLegend(ctx: CanvasRenderingContext2D, L: Layout, rect: PlotRect): void {
  ctx.save();
  ctx.font = FONT_LABEL;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const x0 = L.plot.x;
  L.legend.rows.forEach((row, ri) => {
    const y = rect.y + 4 + ri * LEGEND_ROW;
    for (const { item, x } of row.items) {
      const kx = x0 + x, ky = y + 7;
      if (item.colors.length > 1) {
        // A stepped family: a gradient key across the variant shades, so the
        // ramp is legible without one legend row per swept value.
        const seg = LEGEND_KEY_W / item.colors.length;
        for (let c = 0; c < item.colors.length; c++) {
          ctx.fillStyle = item.colors[c];
          ctx.fillRect(kx + c * seg, ky, Math.ceil(seg), 2);
        }
      } else {
        ctx.fillStyle = item.colors[0];
        if (item.axis === "L") ctx.fillRect(kx, ky, LEGEND_KEY_W, 2);
        else { ctx.fillRect(kx, ky, 5, 2); ctx.fillRect(kx + 7, ky, 5, 2); }  // dashed key = right axis
      }
      ctx.fillStyle = TEXT;
      ctx.fillText(item.label, kx + LEGEND_KEY_W + LEGEND_KEY_GAP, y + 11);
    }
  });
  if (L.legend.overflow > 0) {
    // Never silently drop a trace from the legend — say how many are missing.
    const last = L.legend.rows[L.legend.rows.length - 1];
    const tail = last.items.length ? last.items[last.items.length - 1] : null;
    const y = rect.y + 4 + (L.legend.rows.length - 1) * LEGEND_ROW;
    const tx = tail ? x0 + tail.x + tail.w + LEGEND_ITEM_GAP : x0;
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(`+${L.legend.overflow} more`, Math.min(tx, rect.x + rect.w - 60), y + 11);
  }
  ctx.restore();
}

function drawRotatedAxisTitle(ctx: CanvasRenderingContext2D, label: string | undefined, plot: PlotRect, side: "left" | "right", gutter: number, clipped = false): void {
  const base = axisTitle(label) || axisUnit(label);
  // With no title at all the clipped state still has to be stated somewhere on
  // the axis, so "clipped" stands alone rather than being dropped.
  const title = clipped ? (base ? `${base} · clipped` : "clipped") : base;
  if (!title) return;
  ctx.save();
  ctx.font = FONT_LABEL;
  ctx.fillStyle = clipped ? TOKENS.status.warn : TEXT;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const cy = plot.y + plot.h / 2;
  if (side === "left") {
    ctx.translate(plot.x - gutter + 12, cy);
    ctx.rotate(-Math.PI / 2);
  } else {
    ctx.translate(plot.x + plot.w + gutter - 6, cy);
    ctx.rotate(Math.PI / 2);
  }
  // Truncate rather than let the title run out of its column and over the plot.
  let text = title;
  const maxLen = plot.h - 12;
  if (ctx.measureText(text).width > maxLen) {
    while (text.length > 1 && ctx.measureText(text + "…").width > maxLen) text = text.slice(0, -1);
    text += "…";
  }
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawEmptyState(ctx: CanvasRenderingContext2D, rect: PlotRect, e: { title: string; hint?: string }): void {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  // A quiet 2-line block, optically centred (text sits slightly above true
  // centre so it doesn't read as low).
  ctx.font = FONT_EMPTY_TITLE;
  ctx.fillStyle = TEXT;
  ctx.fillText(e.title, cx, cy - (e.hint ? 6 : 0));
  if (e.hint) {
    ctx.font = FONT_LABEL;
    ctx.fillStyle = TEXT_DIM;
    // Wrap on width so a long hint never runs off a narrow dock.
    const words = e.hint.split(" ");
    const maxW = Math.min(360, rect.w - 48);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (ctx.measureText(next).width > maxW && line) { lines.push(line); line = w; } else line = next;
    }
    if (line) lines.push(line);
    lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, cx, cy + 14 + i * 15));
  }
  ctx.restore();
}

function drawSkeleton(ctx: CanvasRenderingContext2D, plot: PlotRect): void {
  // Ghost traces in the final layout's plot rect. Not a spinner: a spinner
  // occupies no space and the plot jumps when it is replaced.
  ctx.save();
  ctx.beginPath(); ctx.rect(plot.x, plot.y, plot.w, plot.h); ctx.clip();
  ctx.strokeStyle = TOKENS.ink.tertiary;
  ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round";
  for (let k = 0; k < 2; k++) {
    ctx.globalAlpha = 0.16 - k * 0.06;
    ctx.beginPath();
    const amp = plot.h * (0.18 - k * 0.05);
    const mid = plot.y + plot.h * (0.42 + k * 0.18);
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      const px = plot.x + t * plot.w;
      const py = mid + Math.sin(t * Math.PI * (2 + k)) * amp * (1 - t * 0.35);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
