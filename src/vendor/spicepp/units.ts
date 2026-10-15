/**
 * SPICE-style value parsing & formatting.
 * SI suffixes are case-insensitive; "Meg" = 1e6, "M" = 1e-3 (the SPICE gotcha), "Mil" = 25.4e-6.
 * Trailing letters that aren't a recognized suffix are ignored ("2.2uF" -> 2.2e-6, "100ohm" -> 100).
 * Also accepts EU style "4k7" -> 4700, "1u5" -> 1.5e-6, and scientific notation "1e-9".
 */

const SUFFIX: Record<string, number> = {
  t: 1e12, g: 1e9, meg: 1e6, k: 1e3,
  m: 1e-3, u: 1e-6, "µ": 1e-6, n: 1e-9, p: 1e-12, f: 1e-15,
  mil: 25.4e-6,
};

export interface ParseValueOpts {
  /**
   * Treat an uppercase trailing `F` as FEMTO rather than as the unit "Farads".
   *
   * SPICE itself is fully case-insensitive, so inside a `.model` card `IS=6.734F` means
   * 6.734e-15 A and nothing else — there are no units in a model card for `F` to be. Vendor
   * cards from onsemi / TI / Vishay are routinely published ALL-CAPS, and parsing that `F` as a
   * unit turns a 6.7 fA saturation current into 6.7 A: the junction becomes a short and every
   * bias point built on it is silently, wildly wrong. (Every other suffix already round-trips
   * case-insensitively — `2N`, `4.493P`, `1MEG` — so `F` was the lone exception.)
   *
   * The default stays FALSE for SCHEMATIC ATTRIBUTE values, where `F` really is the unit a user
   * means when they type a capacitance and where "10F" reading as 10 femtofarads would be its
   * own surprise. Suffixed forms like `10uF` / `4.7nF` are unaffected either way: the longest
   * suffix (`u`, `n`) matches first and the `F` is discarded as a trailing unit.
   */
  femtoF?: boolean;
}

/** Parse a value string to a number. Returns NaN if unparseable. */
export function parseValue(input: string | number | undefined | null, opts?: ParseValueOpts): number {
  if (input === undefined || input === null) return NaN;
  if (typeof input === "number") return input;
  const original = input.trim();
  let s = original.toLowerCase();
  if (s === "") return NaN;
  // Pure scientific / decimal first
  if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return parseFloat(s);

  // Sign
  let sign = 1;
  let originalNoSign = original;
  if (s[0] === "+") { s = s.slice(1); originalNoSign = originalNoSign.slice(1); }
  else if (s[0] === "-") { sign = -1; s = s.slice(1); originalNoSign = originalNoSign.slice(1); }

  // Match leading number, then a suffix (longest-first: "meg" before "m"), then maybe a fractional
  // remainder ("4k7"), then any trailing unit chars. We accept ANY trailing non-digit run as the
  // unit (Ω, F, V, °C, ohm, …) - previously the regex `[a-z%]*` rejected Unicode units like Ω.
  const m = s.match(/^(\d+\.?\d*|\.\d+)\s*(meg|mil|t|g|k|m|u|µ|n|p|f)?(\d*)\s*([^\d.+\-eE]*)$/);
  if (!m) return NaN;
  const intPart = m[1];
  let suf: string | undefined = m[2];
  const frac = m[3]; // EU-style fractional digits after the suffix letter
  const trailingUnit = m[4];
  let value = parseFloat(intPart);
  // CASE GOTCHA: lowercase 'f' means femto, uppercase 'F' means Farads (a unit, not a multiplier).
  // Look at the SAME index in the original (case-preserved) string. If it's uppercase 'F' AND
  // there are no EU-style fractional digits, treat it as a unit instead of a multiplier.
  if (suf === "f" && !frac && !opts?.femtoF) {
    const idxOfSuffix = intPart.length + (originalNoSign.slice(intPart.length).match(/^\s*/)?.[0].length ?? 0);
    const ch = originalNoSign[idxOfSuffix];
    if (ch === "F") {
      // Uppercase F → unit, not femto. Drop the suffix. (Suppressed by opts.femtoF, which the
      // .model-card parser sets — see ParseValueOpts.)
      suf = undefined;
    }
  }
  void trailingUnit;
  if (suf) {
    const mult = SUFFIX[suf];
    if (mult === undefined) return NaN;
    if (frac && frac.length > 0) {
      // "4k7" -> 4.7 * k ; "1u5" -> 1.5u
      value = parseFloat(intPart + "." + frac) * mult;
    } else {
      value = value * mult;
    }
  }
  return sign * value;
}

/** True if a string looks like an arbitrary SPICE expression / parameter ({...} or contains operators). */
export function isExpression(s: string): boolean {
  if (!s) return false;
  const t = s.trim();
  return t.startsWith("{") || /[+\-*/^()]|[a-z_][a-z0-9_]*\s*\(/i.test(t.replace(/^[-+]?[\d.]+(e[-+]?\d+)?$/i, ""));
}

const SI_DOWN = [
  { v: 1e12, s: "T" }, { v: 1e9, s: "G" }, { v: 1e6, s: "Meg" }, { v: 1e3, s: "k" },
  { v: 1, s: "" }, { v: 1e-3, s: "m" }, { v: 1e-6, s: "µ" }, { v: 1e-9, s: "n" }, { v: 1e-12, s: "p" }, { v: 1e-15, s: "f" },
];

/** Format a number with an SI suffix and (optionally) a unit. e.g. formatValue(4700, "Ω") -> "4.7 kΩ" */
export function formatValue(n: number, unit = "", sig = 4): string {
  if (!isFinite(n)) return n === Infinity ? "∞" : n === -Infinity ? "−∞" : "NaN";
  if (n === 0) return `0${unit ? " " + unit : ""}`;
  const a = Math.abs(n);
  let chosen = SI_DOWN[SI_DOWN.length - 1];
  for (const e of SI_DOWN) { if (a >= e.v) { chosen = e; break; } }
  const scaled = n / chosen.v;
  const rounded = Number(scaled.toPrecision(sig));
  const str = String(rounded);
  return `${str} ${chosen.s}${unit}`.trim().replace(/\s+(?=Ω|V|A|F|H|s|Hz|W|°)/, "");
}

/** Standard E-series (resistor) values, given as the 1..10 decade band. */
const E_SERIES: Record<string, number[]> = {
  E12: [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2],
  E24: [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1],
  E96: [
    1.00,1.02,1.05,1.07,1.10,1.13,1.15,1.18,1.21,1.24,1.27,1.30,1.33,1.37,1.40,1.43,1.47,1.50,1.54,1.58,1.62,1.65,1.69,1.74,
    1.78,1.82,1.87,1.91,1.96,2.00,2.05,2.10,2.15,2.21,2.26,2.32,2.37,2.43,2.49,2.55,2.61,2.67,2.74,2.80,2.87,2.94,3.01,3.09,
    3.16,3.24,3.32,3.40,3.48,3.57,3.65,3.74,3.83,3.92,4.02,4.12,4.22,4.32,4.42,4.53,4.64,4.75,4.87,4.99,5.11,5.23,5.36,5.49,
    5.62,5.76,5.90,6.04,6.19,6.34,6.49,6.65,6.81,6.98,7.15,7.32,7.50,7.68,7.87,8.06,8.25,8.45,8.66,8.87,9.09,9.31,9.53,9.76,
  ],
};

/** Snap a value to the nearest standard E-series value (geometric distance). */
export function nearestEValue(n: number, series: keyof typeof E_SERIES = "E24"): number {
  if (!isFinite(n) || n === 0) return n;
  const decade = Math.floor(Math.log10(Math.abs(n)));
  const norm = Math.abs(n) / Math.pow(10, decade); // ~1..10
  const band = E_SERIES[series] ?? E_SERIES.E24;
  let best = band[0], bd = Infinity;
  // The candidate set must include the NEXT DECADE'S 1.0 (i.e. 10 in normalised terms). The
  // series stops at 9.1 (E24) / 9.76 (E96), so a value in the gap above it — 9900 Ω, say — was
  // forced DOWN to 9.1 k even though 10 k is nearer in log space by a factor of eight
  // (|ln 10 − ln 9.9| = 0.0100 vs |ln 9.1 − ln 9.9| = 0.0843). 10 k is a stocked value in every
  // series; 9.1 k for a 9.9 k target is simply the wrong part. The lower edge needs no such
  // sentinel because every series starts at exactly 1.00.
  for (const c of band) {
    const d = Math.abs(Math.log(c) - Math.log(norm));
    if (d < bd) { bd = d; best = c; }
  }
  if (Math.abs(Math.log(10) - Math.log(norm)) < bd) return Math.sign(n) * Math.pow(10, decade + 1);
  return Math.sign(n) * best * Math.pow(10, decade);
}
