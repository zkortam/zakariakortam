/* ============================================================================
 * logicLanes.ts — digital waveform lanes for the plotting engine.
 *
 * Two layers, like plot.ts:
 *   • layoutLogicLanes() is PURE. It turns lanes + a view into a flat list of
 *     draw commands (lines, hatch bands, text, dense markers). No canvas, so
 *     scripts/test_logic_lanes.ts can assert every pixel decision.
 *   • drawLogicLanes() executes those commands on a Canvas2D context.
 *
 * Visual language (RTLPP_PLAN.md 7.6, strict minimal):
 *   single bit  step line between a low and a high level, in the trace colour
 *   bus         top and bottom rails with value text centred in each segment,
 *               two short diagonal strokes at each value change
 *   X           hatched band in status error at low opacity
 *   Z           dashed line at mid level in tertiary ink
 *   dense       sub-pixel activity collapses into ONE marker per pixel run
 * Every lane has its name in the left gutter; identity is never colour alone.
 *
 * Cost model: the visible window is found by binary search, and the walk then
 * jumps column to column (binary search again), so work is bounded by the
 * plot width in pixels, not by the number of events (1e6+ is fine).
 * Events MUST be sorted by ascending t.
 * ========================================================================== */
import { TOKENS } from "./tokens";
import type { PlotRect, PlotGutter, PlotCursors } from "./plot";

/** `label`, when present, is the text a bus segment shows instead of its formatted value
 *  (a decoded protocol frame: "0x41 'A'", "0x50 W ACK"). */
export type LogicEvent = { t: number; v: string; label?: string };
export type LogicRadix = "hex" | "dec" | "signed" | "bin" | "ascii" | { enum: Record<string, string> };

export interface LogicLane {
  name: string;
  /** Bit width. 1 draws a step line; > 1 draws a bus. */
  width: number;
  /** Sorted by t. v is one char per bit, MSB first, each of 0 1 x z. The value
   *  holds from t until the next event. */
  events: LogicEvent[];
  /** hex (default), dec, signed, bin, ascii, or an enum map keyed by the
   *  unsigned decimal value ({ enum: { "0": "IDLE", "1": "RUN" } }). */
  radix?: LogicRadix;
  /** Palette slot override; defaults to the lane's index. */
  colorIndex?: number;
}

export interface LogicView {
  /** Plot area of the lanes (already inside the gutters). */
  rect: PlotRect;
  /** Visible time range, same units as event t. */
  t0: number;
  t1: number;
  /** Shared left gutter (PlotGutter) so lane names align with other panels. */
  gutter?: PlotGutter;
  cursors?: PlotCursors;
}

export interface LogicOpts {
  theme?: "dark" | "light";
  laneHeight?: number;   // default 28
  laneGap?: number;      // default 6
  padY?: number;         // vertical inset of the high/low rails, default 5
  slant?: number;        // max horizontal size of a bus change stroke, default 3
  /** Pixel column width used to detect dense activity. Default 1. */
  columnPx?: number;
  fontSize?: number;     // default 11
  /** Text measurer. Default estimates 0.6 em per char; drawLogicLanes passes ctx.measureText. */
  measure?: (s: string) => number;
}

export type LogicCmd =
  | { kind: "line"; lane: number; x0: number; y0: number; x1: number; y1: number; color: string; width: number; dash?: number[] }
  | { kind: "hatch"; lane: number; x: number; y: number; w: number; h: number; color: string; alpha: number; spacing: number }
  | { kind: "dense"; lane: number; x: number; y: number; w: number; h: number; color: string; alpha: number }
  | { kind: "text"; lane: number; x: number; y: number; text: string; color: string; align: "left" | "center"; maxW: number; role: "name" | "value" }
  | { kind: "cursor"; x: number; y0: number; y1: number; color: string; which: "a" | "b" };

export interface LogicLayout {
  cmds: LogicCmd[];
  laneTops: number[];
  height: number;
  /** Instrumentation for the efficiency tests. */
  stats: { visited: number; dense: number; segments: number };
}

const FONT = (px: number) => `${px}px Inter, ui-sans-serif, sans-serif`;

// ── value classification and radix formatting ───────────────────────────────

export type BitClass = "def" | "x" | "z";

/** def = fully 0/1; z = every bit z; x = anything else unknown (mixed X/Z is X). */
export function classifyValue(v: string): BitClass {
  let hasX = false, hasZ = false, hasDef = false;
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i) | 32;
    if (c === 120) hasX = true; else if (c === 122) hasZ = true; else hasDef = true;
  }
  if (hasX) return "x";
  if (hasZ) return hasDef ? "x" : "z";
  return "def";
}

function normalise(v: string, width: number): string {
  let s = v.toLowerCase();
  if (s.length < width) s = (s.length && s[0] !== "0" && s[0] !== "1" ? s[0] : "0").repeat(width - s.length) + s;
  else if (s.length > width) s = s.slice(s.length - width);
  return s;
}

/** Format a bit string for display. Unknown bits give "x" / "z"; hex is per nibble. */
export function formatLogicValue(v: string, width: number, radix: LogicRadix = "hex"): string {
  const s = normalise(v, Math.max(1, width));
  if (radix === "bin") return s;
  if (radix === "hex") {
    const pad = (4 - (s.length % 4)) % 4;
    const p = (s[0] === "x" || s[0] === "z" ? s[0] : "0").repeat(pad) + s;
    let out = "";
    for (let i = 0; i < p.length; i += 4) {
      const n = p.slice(i, i + 4);
      if (/^[01]+$/.test(n)) out += parseInt(n, 2).toString(16);
      else if (/^z+$/.test(n)) out += "z";
      else out += "x";
    }
    return out;
  }
  const cls = classifyValue(s);
  if (cls !== "def") return cls;
  const u = BigInt("0b" + s);
  if (radix === "dec") return u.toString(10);
  if (radix === "signed") {
    const neg = s[0] === "1" && s.length > 1;
    return neg ? (u - (BigInt(1) << BigInt(s.length))).toString(10) : u.toString(10);
  }
  if (radix === "ascii") {
    const p = "0".repeat((8 - (s.length % 8)) % 8) + s;
    let out = "";
    for (let i = 0; i < p.length; i += 8) {
      const c = parseInt(p.slice(i, i + 8), 2);
      out += c >= 0x20 && c <= 0x7e ? String.fromCharCode(c) : ".";
    }
    return out;
  }
  // enum: unmapped values fall back to hex
  const name = radix.enum[u.toString(10)];
  return name !== undefined ? name : formatLogicValue(s, s.length, "hex");
}

// ── search ──────────────────────────────────────────────────────────────────

/** First index in [lo,hi] whose t >= target (hi+1 if none). */
function lowerBoundT(ev: LogicEvent[], target: number, lo: number, hi: number): number {
  let a = lo, b = hi + 1;
  while (a < b) { const m = (a + b) >>> 1; if (ev[m].t < target) a = m + 1; else b = m; }
  return a;
}
/** First index in [lo,hi] whose t > target (hi+1 if none). */
function upperBoundT(ev: LogicEvent[], target: number, lo: number, hi: number): number {
  let a = lo, b = hi + 1;
  while (a < b) { const m = (a + b) >>> 1; if (ev[m].t <= target) a = m + 1; else b = m; }
  return a;
}

/** Value of a lane at time t (undefined before its first event). The cursor readout. */
export function logicValueAt(lane: LogicLane, t: number): string | undefined {
  const i = upperBoundT(lane.events, t, 0, lane.events.length - 1) - 1;
  return i < 0 ? undefined : lane.events[i].v;
}

// ── colours ─────────────────────────────────────────────────────────────────

export function logicColors(theme: "dark" | "light") {
  const light = theme === "light";
  return {
    tertiary: light ? TOKENS.ink.tertiaryLight : TOKENS.ink.tertiary,
    label: light ? TOKENS.ink.secondaryLight : TOKENS.ink.secondary,
    text: light ? TOKENS.ink.primaryLight : TOKENS.ink.primary,
    error: TOKENS.status.error,
    accent: TOKENS.accent,
  };
}

// ── layout ──────────────────────────────────────────────────────────────────

type Piece =
  | { dense: false; idx: number; x: number }
  | { dense: true; idx: number; last: number; x: number; x1: number };

export function layoutLogicLanes(lanes: LogicLane[], view: LogicView, opts: LogicOpts = {}): LogicLayout {
  const col = logicColors(opts.theme ?? "dark");
  const laneH = opts.laneHeight ?? 28;
  const gap = opts.laneGap ?? 6;
  const padY = opts.padY ?? 5;
  const slantMax = opts.slant ?? 3;
  const colW = Math.max(0.25, opts.columnPx ?? 1);
  const fs = opts.fontSize ?? 11;
  const measure = opts.measure ?? ((s: string) => s.length * fs * 0.6);
  const { rect, t0, t1 } = view;
  const span = t1 - t0;
  const cmds: LogicCmd[] = [];
  const laneTops: number[] = [];
  const stats = { visited: 0, dense: 0, segments: 0 };
  const xr = rect.x + rect.w;
  const valid = span > 0 && rect.w > 0;
  const xOf = (t: number) => rect.x + ((t - t0) / span) * rect.w;
  const labelX = rect.x - (view.gutter?.left ?? 0) + 6;

  for (let li = 0; li < lanes.length; li++) {
    const lane = lanes[li];
    const top = rect.y + li * (laneH + gap);
    laneTops.push(top);
    const hiY = top + padY, loY = top + laneH - padY, midY = (hiY + loY) / 2;
    const color = TOKENS.traces[(lane.colorIndex ?? li) % TOKENS.traces.length];
    const bus = lane.width > 1;
    const radix = lane.radix ?? "hex";

    cmds.push({ kind: "text", lane: li, x: labelX, y: top + laneH / 2, text: lane.name, color: col.label, align: "left", maxW: Math.max(0, rect.x - labelX - 6), role: "name" });
    if (!valid) continue;

    const ev = lane.events;
    const n = ev.length;
    if (n === 0 || ev[0].t > t1) continue;

    // The value in effect at t0, then everything up to t1 (binary search).
    const start = Math.max(0, upperBoundT(ev, t0, 0, n - 1) - 1);
    const end = upperBoundT(ev, t1, start, n - 1); // exclusive

    // Walk by pixel column: each step consumes at least one event and one
    // column, and jumps over a whole column's events with a binary search.
    const pieces: Piece[] = [];
    let i = start;
    while (i < end) {
      stats.visited++;
      const x = Math.max(rect.x, xOf(ev[i].t));
      const c = Math.floor((x - rect.x) / colW);
      const tEnd = t0 + (((c + 1) * colW) / rect.w) * span;
      const j = Math.min(end, lowerBoundT(ev, tEnd, i + 1, end - 1));
      if (j - i >= 2) {
        const x0 = rect.x + c * colW, x1 = Math.min(xr, x0 + colW);
        const prev = pieces[pieces.length - 1];
        if (prev && prev.dense && x0 <= prev.x1 + 1e-9) { prev.x1 = x1; prev.last = j - 1; }
        else pieces.push({ dense: true, idx: i, last: j - 1, x: x0, x1 });
        i = j;
      } else {
        pieces.push({ dense: false, idx: i, x });
        i++;
      }
    }

    const np = pieces.length;
    const holdX = (k: number) => (pieces[k].dense ? (pieces[k] as { x1: number }).x1 : pieces[k].x); // where piece k's value starts to hold
    const nextX = (k: number) => (k + 1 < np ? pieces[k + 1].x : xr);                              // where piece k's value stops
    const valOf = (k: number) => { const p = pieces[k]; return ev[p.dense ? p.last : p.idx].v; };
    const labelOf = (k: number) => { const p = pieces[k]; return ev[p.dense ? p.last : p.idx].label; };

    let prevLevel: number | null = null;
    for (let k = 0; k < np; k++) {
      const p = pieces[k];
      if (p.dense) {
        stats.dense++;
        cmds.push({ kind: "dense", lane: li, x: p.x, y: hiY, w: Math.max(1, p.x1 - p.x), h: loY - hiY, color, alpha: 0.45 });
      }
      const xa = holdX(k), xb = nextX(k);
      if (xb - xa < 1e-9) { prevLevel = null; continue; }
      stats.segments++;
      const v = valOf(k);
      const cls = classifyValue(v);

      if (!bus) {
        const level = v.endsWith("1") ? hiY : loY;
        if (cls === "x") {
          cmds.push({ kind: "hatch", lane: li, x: xa, y: hiY, w: xb - xa, h: loY - hiY, color: col.error, alpha: 0.28, spacing: 4 });
        } else if (cls === "z") {
          cmds.push({ kind: "line", lane: li, x0: xa, y0: midY, x1: xb, y1: midY, color: col.tertiary, width: 1, dash: [3, 3] });
        } else {
          if (!p.dense && prevLevel !== null && prevLevel !== level) {
            cmds.push({ kind: "line", lane: li, x0: xa, y0: prevLevel, x1: xa, y1: level, color, width: 1.5 });
          }
          cmds.push({ kind: "line", lane: li, x0: xa, y0: level, x1: xb, y1: level, color, width: 1.5 });
        }
        prevLevel = cls === "def" ? level : null;
        continue;
      }

      // Bus segment. Slants are 0 at the view edges and beside dense markers.
      const w = xb - xa;
      const leftTrans = k > 0 && !p.dense && !pieces[k - 1].dense;
      const rightTrans = k + 1 < np && !pieces[k + 1].dense;
      const sL = leftTrans ? Math.min(slantMax, w / 2) : 0;
      const sR = rightTrans ? Math.min(slantMax, w / 2) : 0;
      if (cls === "x") {
        cmds.push({ kind: "hatch", lane: li, x: xa, y: hiY, w, h: loY - hiY, color: col.error, alpha: 0.28, spacing: 4 });
      } else if (cls === "z") {
        cmds.push({ kind: "line", lane: li, x0: xa, y0: midY, x1: xb, y1: midY, color: col.tertiary, width: 1, dash: [3, 3] });
      } else {
        cmds.push({ kind: "line", lane: li, x0: xa + sL, y0: hiY, x1: xb - sR, y1: hiY, color, width: 1.5 });
        cmds.push({ kind: "line", lane: li, x0: xa + sL, y0: loY, x1: xb - sR, y1: loY, color, width: 1.5 });
        // Text only when it fits whole; narrower segments stay blank.
        const avail = w - sL - sR - 4;
        if (avail > 0) {
          const text = labelOf(k) ?? formatLogicValue(v, lane.width, radix);
          if (measure(text) <= avail) {
            cmds.push({ kind: "text", lane: li, x: (xa + xb) / 2, y: midY, text, color: col.text, align: "center", maxW: avail, role: "value" });
          }
        }
      }
      // The change itself: two short diagonal strokes, only where a defined
      // value is involved (hatch and dashed Z carry their own edges).
      if (rightTrans) {
        const q = pieces[k + 1];
        const w2 = nextX(k + 1) - holdX(k + 1);
        const sx = Math.min(slantMax, w / 2, w2 / 2);
        if (sx > 0 && (cls === "def" || classifyValue(valOf(k + 1)) === "def")) {
          const xc = q.x;
          cmds.push({ kind: "line", lane: li, x0: xc - sx, y0: hiY, x1: xc + sx, y1: loY, color, width: 1.5 });
          cmds.push({ kind: "line", lane: li, x0: xc - sx, y0: loY, x1: xc + sx, y1: hiY, color, width: 1.5 });
        }
      }
    }
  }

  const height = lanes.length ? lanes.length * (laneH + gap) - gap : 0;
  if (valid && view.cursors) {
    for (const which of ["a", "b"] as const) {
      const t = view.cursors[which];
      if (t == null || t < t0 || t > t1) continue;
      cmds.push({ kind: "cursor", x: xOf(t), y0: rect.y, y1: rect.y + height, color: col.accent, which });
    }
  }
  return { cmds, laneTops, height, stats };
}

// ── drawing ─────────────────────────────────────────────────────────────────

export function drawLogicLanes(ctx: CanvasRenderingContext2D, lanes: LogicLane[], view: LogicView, opts: LogicOpts = {}): LogicLayout {
  ctx.save();
  ctx.font = FONT(opts.fontSize ?? 11);
  const layout = layoutLogicLanes(lanes, view, { ...opts, measure: opts.measure ?? ((s) => ctx.measureText(s).width) });
  ctx.textBaseline = "middle";
  for (const c of layout.cmds) {
    switch (c.kind) {
      case "line":
        ctx.globalAlpha = 1; ctx.strokeStyle = c.color; ctx.lineWidth = c.width;
        ctx.setLineDash(c.dash ?? []);
        ctx.beginPath(); ctx.moveTo(c.x0, c.y0); ctx.lineTo(c.x1, c.y1); ctx.stroke();
        break;
      case "hatch":
        ctx.save();
        ctx.beginPath(); ctx.rect(c.x, c.y, c.w, c.h); ctx.clip();
        ctx.strokeStyle = c.color; ctx.globalAlpha = c.alpha; ctx.lineWidth = 1; ctx.setLineDash([]);
        ctx.beginPath();
        for (let x = c.x - c.h; x < c.x + c.w; x += c.spacing) { ctx.moveTo(x, c.y + c.h); ctx.lineTo(x + c.h, c.y); }
        ctx.stroke();
        ctx.restore();
        break;
      case "dense":
        ctx.globalAlpha = c.alpha; ctx.fillStyle = c.color; ctx.fillRect(c.x, c.y, c.w, c.h);
        break;
      case "text":
        // Lane names that do not fit the gutter are dropped, never overflowed.
        if (c.role === "name" && ctx.measureText(c.text).width > c.maxW) break;
        ctx.globalAlpha = 1; ctx.fillStyle = c.color; ctx.textAlign = c.align;
        ctx.fillText(c.text, c.x, c.y);
        break;
      case "cursor":
        ctx.globalAlpha = 0.9; ctx.strokeStyle = c.color; ctx.lineWidth = 1; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(c.x, c.y0); ctx.lineTo(c.x, c.y1); ctx.stroke();
        break;
    }
  }
  ctx.restore();
  return layout;
}
