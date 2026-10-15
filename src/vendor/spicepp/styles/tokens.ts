/**
 * Raw design tokens for use outside Tailwind (Canvas 2D rendering, plotting).
 * Mirror of tailwind.config.ts. Dark theme is the default.
 */
export const TOKENS = {
  canvas: { dark: "#0B0B0C", light: "#FAFAFB" },
  ink: {
    primary: "#F4F4F6",
    secondary: "#9A9AA0",
    tertiary: "#5A5A60",
    primaryLight: "#1A1A1C",
    secondaryLight: "#6A6A70",
    tertiaryLight: "#A8A8AE",
  },
  hairline: "#262628",
  hairlineLight: "#E6E6E9",
  accent: "#0A84FF",
  wire: { idle: "#A6A6AC", hot: "#0A84FF" },
  grid: "#19191B",
  gridLight: "#ECECEE",
  status: { error: "#FF453A", warn: "#FF9F0A", ok: "#30D158" },
  /** A lit display segment (7-segment parts on the canvas): the colour of a red LED digit. */
  led: "#FF5E3A",
  /**
   * Categorical trace palette — 8 slots, assigned in this fixed order, never
   * re-ordered. The ORDER is the colour-blind-safety mechanism, not decoration:
   * it is what the adjacent-pair gate is measured on.
   *
   * VALIDATED against the house data-viz checks on the #0B0B0C canvas
   * (OKLab ΔE ×100, Machado-Oliveira-Fernandes 2009 at severity 1.0):
   *
   *   lightness band  PASS  all 8 inside OKLCH L 0.48–0.67
   *   chroma floor    PASS  all 8 ≥ 0.10 (none reads as grey)
   *   CVD adjacent    PASS  worst ΔE 11.8 (deutan), target ≥ 8
   *   normal adjacent PASS  worst ΔE 18.7, hard floor ≥ 15 (worst pair: olive↔green)
   *   CVD all-pairs   WARN  worst ΔE 6.0 (deutan) — inside the legal 6–8 floor band
   *   normal all-pairs PASS worst ΔE 15.1, hard floor ≥ 15
   *   contrast        PASS  all 8 ≥ 3:1 on the canvas
   *
   * The previous 10-slot list FAILED three of those checks outright: six entries
   * sat above the dark lightness band, "#AC8E68" fell under the chroma floor (it
   * rendered as grey), and #AC8E68↔#FF6482 collided at ΔE 5.1 under deuteranopia.
   * It also carried #64D2FF and #5AC8FA, which are near-duplicates of each other.
   * These eight are the same design-system hue families re-stepped into the dark
   * band and re-ordered; the two genuinely unresolvable hues were dropped rather
   * than kept as look-alikes.
   *
   * WHY 8 AND NOT MORE: past eight, a ninth hue cannot be separated from an
   * existing slot under CVD — no ordering or re-stepping fixes it. Trace 9 wraps
   * to slot 1 by design.
   *
   * THE ALL-PAIRS WARN IS PAID FOR. Overlaid traces put every series on screen
   * with every other, so the 6–8 floor band applies, and that band is legal only
   * with secondary encoding. This product ships four independent channels beyond
   * hue: the in-plot legend carries a per-trace colour key and name, the probe
   * strip repeats the key as a labelled chip, the hover readout names every trace
   * beside its value, and right-axis traces are dashed. Identity is never
   * colour-alone. Do NOT add a 9th colour to dodge this — cut traces or facet.
   *
   * STATUS HUES SIT LATE ON PURPOSE. The evidence overlay paints pass/fail in
   * status green and red, so a trace in the same hue could be misread as a
   * verdict. The order was chosen among the passing orderings to push red and
   * green to slots 8 and 6 — a plot has to carry six signals before either
   * appears, and by then the legend is doing the identifying anyway. (The
   * evidence marks are also structurally distinct: dashed limit lines, 10%
   * washes and ringed dots, never a solid 2 px stroke.)
   *
   * Re-validate with the data-viz skill's validator before changing ANY value:
   *   node scripts/validate_palette.js "<comma-separated>" --mode dark --surface "#0B0B0C"
   */
  traces: [
    "#0059EF", // 1 blue   — the primary trace; the house accent family
    "#D67900", // 2 orange
    "#A43959", // 3 rose
    "#00A0DB", // 4 cyan
    "#827000", // 5 olive
    "#00B151", // 6 green  — status-adjacent hue, deliberately late
    "#B861FF", // 7 purple
    "#EC0C13", // 8 red    — status-adjacent hue, deliberately last
  ],
  // grid spacing in canvas units (the schematic snap grid)
  gridStep: 16,
} as const;

/** A perceptually-monotonic diverging ramp for live-mode node voltage coloring. */
export function voltageColor(v: number, vmin: number, vmax: number): string {
  const span = Math.max(1e-9, vmax - vmin);
  let t = (v - vmin) / span; // 0..1
  t = Math.max(0, Math.min(1, t));
  // cool (blue) -> neutral gray -> warm (red); luminance monotonic
  const lerp = (a: number, b: number, k: number) => Math.round(a + (b - a) * k);
  if (t < 0.5) {
    const k = t / 0.5;
    return `rgb(${lerp(59, 142, k)},${lerp(130, 142, k)},${lerp(246, 144, k)})`;
  }
  const k = (t - 0.5) / 0.5;
  return `rgb(${lerp(142, 255, k)},${lerp(142, 69, k)},${lerp(144, 58, k)})`;
}
