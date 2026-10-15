import { SymbolDef, GridPoint, SymbolPrimitive, SymbolPin, AttrDef } from "./types";
import { parseValue, formatValue } from "../units";
import { DIGITAL_SYMBOLS } from "./digital_parts";

/**
 * Per-instance label anchor.
 *
 * The renderer used to hard-code the label to the RIGHT of the body bbox, which meant the
 * layout planner could only ever RESERVE space for a label and grow the sheet — it could never
 * MOVE a label out of a collision. On a tight circuit (half-wave rectifier with a smoothing cap)
 * that leaves two labels printed on top of each other. Declaring the anchor on the instance is
 * what removes that structural limit; `labelAnchor` absent ⇒ exactly the old behaviour.
 *
 * Augmented onto ComponentInstance rather than edited into types.ts so the schematic data model
 * stays owned by one file.
 */
declare module "./types" {
  interface ComponentInstance {
    /** Where this instance's refdes/value block is drawn. Absent ⇒ solved at draw time. */
    labelAnchor?: LabelAnchor;
  }
}

/**
 * Built-in symbol library - coordinates in canvas units; primary pins land on the 16-unit grid.
 * Design language: 2-pin parts run vertically (pin 1 at top (0,-32), pin 2 at bottom (0,32)); compact bodies,
 * consistent ~16-unit leads, soft round caps/joins (set in drawSymbol), heavily-rounded rects (set in drawPrimitive).
 */

const L = (x1: number, y1: number, x2: number, y2: number) => ({ kind: "line" as const, x1, y1, x2, y2 });
const P = (pts: GridPoint[], closed = true, fill = true) => ({ kind: "poly" as const, pts, closed, fill });
const R = (x1: number, y1: number, x2: number, y2: number) => ({ kind: "rect" as const, x1, y1, x2, y2 });
const C = (cx: number, cy: number, r: number) => ({ kind: "circle" as const, cx, cy, r });
const A = (cx: number, cy: number, r: number, start: number, end: number) => ({ kind: "arc" as const, cx, cy, r, start, end });
// small filled arrowhead with its tip at (tx,ty), pointing "down" / "left" / etc.
const arrow = (tx: number, ty: number, dir: "down" | "up" | "left" | "right", len = 6, w = 5) => {
  if (dir === "down") return P([{ x: tx, y: ty }, { x: tx - w / 2, y: ty - len }, { x: tx + w / 2, y: ty - len }]);
  if (dir === "up") return P([{ x: tx, y: ty }, { x: tx - w / 2, y: ty + len }, { x: tx + w / 2, y: ty + len }]);
  if (dir === "left") return P([{ x: tx, y: ty }, { x: tx + len, y: ty - w / 2 }, { x: tx + len, y: ty + w / 2 }]);
  return P([{ x: tx, y: ty }, { x: tx - len, y: ty - w / 2 }, { x: tx - len, y: ty + w / 2 }]); // right
};
const plus = (cx: number, cy: number, s = 3) => [L(cx - s, cy, cx + s, cy), L(cx, cy - s, cx, cy + s)];
const minus = (cx: number, cy: number, s = 3) => [L(cx - s, cy, cx + s, cy)];
// filled diagonal arrowhead with tip at (tx,ty), pointing away from (fx,fy)
const arrowDiag = (tx: number, ty: number, fx: number, fy: number, len = 5, w = 4) => {
  const dx = tx - fx, dy = ty - fy, m = Math.hypot(dx, dy) || 1;
  const ux = dx / m, uy = dy / m, px = -uy, py = ux;
  const bx = tx - len * ux, by = ty - len * uy;
  return P([{ x: tx, y: ty }, { x: bx + (w / 2) * px, y: by + (w / 2) * py }, { x: bx - (w / 2) * px, y: by - (w / 2) * py }]);
};
/** A shaft from (fx,fy) to (tx,ty) with a filled head at the far end — one call, two primitives. */
const rayDiag = (fx: number, fy: number, tx: number, ty: number, len = 5, w = 4): SymbolPrimitive[] =>
  [L(fx, fy, tx, ty), arrowDiag(tx, ty, fx, fy, len, w)];
/**
 * One full period of a sine, centred on the origin, as an open polyline.
 *
 * Sampled rather than drawn from arcs because the canvas renders `arc` by sampling anyway
 * (drawPrimitive), so this is the same cost and the curve stays exact under every orientation
 * transform — and the global round line-join keeps it smooth at any zoom.
 */
const sineWave = (halfW: number, amp: number, n = 28): SymbolPrimitive => P(
  Array.from({ length: n + 1 }, (_, i) => {
    const x = -halfW + (2 * halfW * i) / n;
    return { x, y: -amp * Math.sin((Math.PI * x) / halfW) };
  }), false, false);

const TOP: GridPoint = { x: 0, y: -32 };
const BOT: GridPoint = { x: 0, y: 32 };
const pp = { passive: "passive" as const };
const twoPin = (n1 = "1", n2 = "2") => [
  { name: n1, pos: TOP, spiceOrder: 1, electrical: pp.passive },
  { name: n2, pos: BOT, spiceOrder: 2, electrical: pp.passive },
];
// label slots - to the right of a 2-pin body, vertically centred on it
const sideLabels = (x: number) => ({ refdesPos: { x, y: -9 }, valuePos: { x, y: 9 } });

// ─── logic-gate geometry, shared by the six gate symbols ─────────────────────────────────
// Solved once here so every gate in the family is the same size and its leads land on the same
// grid; a family whose members are each a few units different is exactly the kind of drift that
// makes a sheet look hand-assembled.
const GATE_PINS_2IN: SymbolPin[] = [
  { name: "a", pos: { x: -32, y: -16 }, spiceOrder: 1, electrical: "in" },
  { name: "b", pos: { x: -32, y: 16 }, spiceOrder: 2, electrical: "in" },
  { name: "out", pos: { x: 32, y: 0 }, spiceOrder: 3, electrical: "out" },
];
const GATE_ATTRS: AttrDef[] = [
  { key: "vhi", label: "Logic high", unit: "V", kind: "value", default: "5" },
  { key: "vth", label: "Threshold", unit: "V", kind: "value", default: "2.5" },
  // Analog (the default, and what every design saved before digital logic existed means) is the
  // behavioural-source gate: a threshold and a rail, no delay. Digital makes it an event-driven
  // gate with a propagation delay and bridges where it meets analog nets (digital_parts.ts).
  { key: "mode", label: "Model", kind: "choice", options: ["Analog", "Digital"], default: "Analog" },
];
/** AND body: flat back, straight top and bottom, true semicircular nose ending at (20, 0). */
const AND_BODY: SymbolPrimitive[] = [
  L(-16, -20, -16, 20), L(-16, -20, 0, -20), L(-16, 20, 0, 20),
  A(0, 0, 20, -90, 90),
];
const GATE_IN_LEADS: SymbolPrimitive[] = [L(-32, -16, -16, -16), L(-32, 16, -16, 16)];
/**
 * OR body: a concave back and two convex flanks meeting at a nose.
 *
 * The three arcs share endpoints BY CONSTRUCTION rather than by eye. Back: centre (−37, 0),
 * r = 29, which passes through (−16, ±20) and bulges right to (−8, 0). Flanks: centre
 * (−9.4, ±16.8), r = 37.4, running from those same corners to the nose at (24, 0).
 */
const OR_BODY: SymbolPrimitive[] = [
  A(-37, 0, 29, -43.6, 43.6),
  A(-9.4, 16.8, 37.4, 26.7, 100.2),
  A(-9.4, -16.8, 37.4, -100.2, -26.7),
];
/** The OR back bulges right, so its input leads stop where that curve actually is (x ≈ −13). */
const OR_IN_LEADS: SymbolPrimitive[] = [L(-32, -16, -13, -16), L(-32, 16, -13, 16)];

export const SYMBOLS: Record<string, SymbolDef> = {
  res: {
    id: "res", name: "Resistor", prefix: "R",
    // Classic ANSI triangular zigzag — sharp resistor silhouette, but the canvas's global
    // lineJoin="round" softens each peak by exactly one stroke radius. Result: instantly readable
    // as a resistor, crisper than a sine wave, still no hard corners.
    //
    // 8 segments / 4 peaks per side, amplitude ±5, body y∈[-16,16] flush with leads. Open polyline
    // (closed=false, fill=false) — no fill mask, no "black box."
    primitives: [
      L(0, -32, 0, -16), L(0, 16, 0, 32),
      P([
        { x:  0, y: -16 },
        { x:  5, y: -12 },
        { x: -5, y:  -8 },
        { x:  5, y:  -4 },
        { x: -5, y:   0 },
        { x:  5, y:   4 },
        { x: -5, y:   8 },
        { x:  5, y:  12 },
        { x:  0, y:  16 },
      ], false, false),
    ],
    pins: twoPin(), attrs: [{ key: "value", label: "Resistance", unit: "Ω", kind: "value", default: "1k" }],
    bbox: { x1: -8, y1: -32, x2: 8, y2: 32 }, ...sideLabels(14),
  },
  cap: {
    id: "cap", name: "Capacitor", prefix: "C",
    primitives: [L(0, -32, 0, -10), L(0, 10, 0, 32), L(-12, -10, 12, -10), L(-12, 10, 12, 10)],
    pins: twoPin(), attrs: [{ key: "value", label: "Capacitance", unit: "F", kind: "value", default: "1µ" }],
    bbox: { x1: -14, y1: -32, x2: 14, y2: 32 }, ...sideLabels(18),
  },
  pot: {
    id: "pot", name: "Potentiometer", prefix: "R",
    // The resistor track with a wiper arrow into the middle of it. The arrow's tip lands exactly
    // on the zigzag's mid-track vertex at (−5, 0), which is literally where the wiper contacts —
    // so the drawing says what the netlist does rather than merely gesturing at it.
    primitives: [
      L(0, -32, 0, -16), L(0, 16, 0, 32),
      P([
        { x:  0, y: -16 }, { x:  5, y: -12 }, { x: -5, y: -8 }, { x:  5, y: -4 },
        { x: -5, y:   0 }, { x:  5, y:   4 }, { x: -5, y:  8 }, { x:  5, y: 12 },
        { x:  0, y:  16 },
      ], false, false),
      L(-32, 0, -11, 0),
      arrow(-5, 0, "right", 6, 5),
    ],
    pins: [
      { name: "1", pos: TOP, spiceOrder: 1, electrical: pp.passive },
      { name: "W", pos: { x: -32, y: 0 }, spiceOrder: 2, electrical: pp.passive },
      { name: "2", pos: BOT, spiceOrder: 3, electrical: pp.passive },
    ],
    attrs: [
      { key: "value", label: "Track", unit: "Ω", kind: "value", default: "10k" },
      { key: "wiper", label: "Wiper", kind: "value", default: "0.5" },
    ],
    bbox: { x1: -32, y1: -32, x2: 8, y2: 32 }, refdesPos: { x: 14, y: -9 }, valuePos: { x: 14, y: 9 },
  },
  xformer: {
    id: "xformer", name: "Transformer", prefix: "TX",
    // Two coils facing a core. Mutual coupling has existed in the engine all along (the `K`
    // element) but only as a DIRECTIVE — you had to place two inductors and then type
    // "K1 L1 L2 0.99" into the directives pane, which is not a transformer, it is homework.
    // This is one part that netlists to exactly that: two L windings and the K that couples them.
    primitives: [
      L(-32, -16, -8, -16), L(-32, 16, -8, 16),
      A(-8, -12, 4, 90, 270), A(-8, -4, 4, 90, 270), A(-8, 4, 4, 90, 270), A(-8, 12, 4, 90, 270),
      L(-2, -18, -2, 18), L(2, -18, 2, 18),                 // laminated core
      A(8, -12, 4, -90, 90), A(8, -4, 4, -90, 90), A(8, 4, 4, -90, 90), A(8, 12, 4, -90, 90),
      L(8, -16, 32, -16), L(8, 16, 32, 16),
    ],
    pins: [
      { name: "P+", pos: { x: -32, y: -16 }, spiceOrder: 1, electrical: pp.passive },
      { name: "P-", pos: { x: -32, y: 16 }, spiceOrder: 2, electrical: pp.passive },
      { name: "S+", pos: { x: 32, y: -16 }, spiceOrder: 3, electrical: pp.passive },
      { name: "S-", pos: { x: 32, y: 16 }, spiceOrder: 4, electrical: pp.passive },
    ],
    attrs: [
      { key: "lp", label: "Primary", unit: "H", kind: "value", default: "10m" },
      { key: "ls", label: "Secondary", unit: "H", kind: "value", default: "10m" },
      { key: "k", label: "Coupling", kind: "value", default: "0.99" },
    ],
    bbox: { x1: -32, y1: -20, x2: 32, y2: 20 }, refdesPos: { x: 0, y: -26 }, valuePos: { x: 0, y: 26 },
  },
  cap_pol: {
    id: "cap_pol", name: "Capacitor (polarised)", prefix: "C",
    // THE MISSING POLARITY. The library's `C-ELEC` part carries a real ESR and was drawn with
    // two identical straight plates — a symbol that says "either way round is fine" about the
    // one component in a first lab that vents when you reverse it. Pin 1 is the ANODE (+).
    //
    // Straight plate on top, bowl-shaped plate below it opening towards the straight one: the
    // standard electrolytic. The bowl is an arc of radius 17 centred at (0,−4), swept −135°→−45°,
    // which puts its ends on (∓12, 8) and its floor on (0, 13) — so the lower lead starts at 13.
    primitives: [
      L(0, -32, 0, -10), L(0, 13, 0, 32),
      L(-12, -10, 12, -10),
      A(0, -4, 17, -135, -45),
      ...plus(-17, -16, 2.5),
    ],
    pins: [
      { name: "+", pos: TOP, spiceOrder: 1, electrical: pp.passive },
      { name: "-", pos: BOT, spiceOrder: 2, electrical: pp.passive },
    ],
    attrs: [{ key: "value", label: "Capacitance", unit: "F", kind: "value", default: "100µ" }],
    bbox: { x1: -20, y1: -32, x2: 14, y2: 32 }, ...sideLabels(18),
  },
  ind: {
    id: "ind", name: "Inductor", prefix: "L",
    primitives: [
      // Standard schematic notation: 4 semicircular humps on the right side of the lead axis,
      // each spanning ~8 grid units vertically. Drawn as half-arcs so the wire visibly bends
      // around each coil rather than punching through stacked dots (the old 4-circle look read
      // as ":::" not as a coil). Leads stop at the body so the trunk line isn't drawn across.
      L(0, -32, 0, -16), L(0, 16, 0, 32),
      // Each half-arc: center (0, cy), radius 4; sweep -90°→+90° (CCW) bulges to the right of
      // the lead axis. SymbolPrimitive uses DEGREES and negates sin (y is down).
      A(0, -12, 4, -90, 90),
      A(0, -4,  4, -90, 90),
      A(0,  4,  4, -90, 90),
      A(0,  12, 4, -90, 90),
    ],
    pins: twoPin(), attrs: [{ key: "value", label: "Inductance", unit: "H", kind: "value", default: "1m" }],
    bbox: { x1: -6, y1: -32, x2: 6, y2: 32 }, ...sideLabels(12),
  },
  vsource: {
    id: "vsource", name: "Voltage source", prefix: "V",
    primitives: [L(0, -32, 0, -15), L(0, 15, 0, 32), C(0, 0, 15), ...plus(0, -7, 2.5), ...minus(0, 7, 2.5)],
    pins: [{ name: "+", pos: TOP, spiceOrder: 1, electrical: pp.passive }, { name: "-", pos: BOT, spiceOrder: 2, electrical: pp.passive }],
    attrs: [{ key: "value", label: "Value", kind: "text", default: "5" }],
    bbox: { x1: -17, y1: -32, x2: 17, y2: 32 }, ...sideLabels(21),
  },
  isource: {
    id: "isource", name: "Current source", prefix: "I",
    primitives: [L(0, -32, 0, -15), L(0, 15, 0, 32), C(0, 0, 15), L(0, -7, 0, 5), arrow(0, 8, "down", 5, 4)],
    pins: [{ name: "+", pos: TOP, spiceOrder: 1, electrical: pp.passive }, { name: "-", pos: BOT, spiceOrder: 2, electrical: pp.passive }],
    attrs: [{ key: "value", label: "Value", kind: "text", default: "1m" }],
    bbox: { x1: -17, y1: -32, x2: 17, y2: 32 }, ...sideLabels(21),
  },
  acsource: {
    id: "acsource", name: "AC source", prefix: "V",
    // A sine drawn inside the circle instead of the ± pair. Same `V` element, same pins, same
    // pin order as `vsource` — the difference is that a bench function generator LOOKS like one
    // on the sheet, and its default value is a waveform rather than a DC level.
    primitives: [L(0, -32, 0, -15), L(0, 15, 0, 32), C(0, 0, 15), sineWave(8, 5)],
    pins: [{ name: "+", pos: TOP, spiceOrder: 1, electrical: pp.passive }, { name: "-", pos: BOT, spiceOrder: 2, electrical: pp.passive }],
    attrs: [{ key: "value", label: "Value", kind: "text", default: "SIN(0 1 1k)" }],
    bbox: { x1: -17, y1: -32, x2: 17, y2: 32 }, ...sideLabels(21),
  },
  battery: {
    id: "battery", name: "Battery", prefix: "V",
    // Two cells: long plate (+) / short plate (−), twice. Pin 1 is the + terminal, so a battery
    // wired the obvious way round gives a positive rail without anyone thinking about it.
    primitives: [
      L(0, -32, 0, -14), L(0, 4, 0, 32),
      L(-12, -14, 12, -14), L(-6, -8, 6, -8),
      L(-12, -2, 12, -2), L(-6, 4, 6, 4),
      ...plus(-17, -22, 2.5),
    ],
    pins: [{ name: "+", pos: TOP, spiceOrder: 1, electrical: pp.passive }, { name: "-", pos: BOT, spiceOrder: 2, electrical: pp.passive }],
    attrs: [{ key: "value", label: "Value", kind: "text", default: "9" }],
    bbox: { x1: -20, y1: -32, x2: 14, y2: 32 }, ...sideLabels(18),
  },
  gnd: {
    id: "gnd", name: "Ground", prefix: "GND", noRefdes: true,
    primitives: [L(0, 0, 0, 5), L(-9, 5, 9, 5), L(-5.5, 9.5, 5.5, 9.5), L(-2, 14, 2, 14)],
    pins: [{ name: "gnd", pos: { x: 0, y: 0 }, spiceOrder: 1, electrical: "power_in" }],
    attrs: [], bbox: { x1: -10, y1: -2, x2: 10, y2: 16 },
  },
  rail: {
    id: "rail", name: "Supply rail", prefix: "V", valueOnlyLabel: true,
    // THE OTHER HALF OF GROUND. Until now `gnd` was the only port on the shelf, so there was
    // nowhere to attach a supply to — which is exactly why builders kept emitting a floating
    // voltage source whose "+" went nowhere (see the note on `opamp` above). A rail port is the
    // mirror of the ground symbol: one stem, one bar, pointing up instead of down.
    //
    // It does BOTH jobs a rail needs. It names the net (like a global net label), and — when
    // `v` holds a number — it supplies it, so "+5 V here" is one part rather than a source plus
    // a wire plus a ground. Clearing `v` leaves a pure named rail for circuits that generate
    // their own supply. netlist.ts emits at most ONE source per distinct rail name, so dropping
    // five `VCC` ports on a sheet wires them together rather than shorting five sources.
    primitives: [L(0, 0, 0, -5), L(-9, -5, 9, -5)],
    pins: [{ name: "rail", pos: { x: 0, y: 0 }, spiceOrder: 1, electrical: "power_out" }],
    attrs: [
      { key: "name", label: "Net", kind: "text", default: "VCC" },
      { key: "v", label: "Supply", unit: "V", kind: "value", default: "5" },
    ],
    bbox: { x1: -10, y1: -7, x2: 10, y2: 2 }, refdesPos: { x: 14, y: -4 }, valuePos: { x: 14, y: -4 },
  },
  diode: {
    id: "diode", name: "Diode", prefix: "D",
    primitives: [L(0, -32, 0, -10), L(0, 10, 0, 32), P([{ x: -9, y: -10 }, { x: 9, y: -10 }, { x: 0, y: 10 }], true, false), L(-9, 10, 9, 10)],
    pins: [{ name: "A", pos: TOP, spiceOrder: 1, electrical: pp.passive }, { name: "K", pos: BOT, spiceOrder: 2, electrical: pp.passive }],
    attrs: [{ key: "model", label: "Model", kind: "model", default: "D" }],
    bbox: { x1: -11, y1: -32, x2: 11, y2: 32 }, ...sideLabels(15),
  },
  // ───── the rest of the diode family ─────
  // The engine has modelled these all along (DEFAULT_MODELS.ZENER / .SCHOTTKY, and the library's
  // 1N47xx / 1N5819 / LED_* cards) — every one of them was DRAWN as a plain rectifier diode. A
  // schematic that draws a zener and a rectifier identically is lying about the circuit: the
  // whole point of the part is the direction it is meant to conduct in. These carry the SAME two
  // pins in the SAME order and netlist to the SAME `D` element, so nothing about wiring, layout
  // or simulation changes — only the silhouette, which is the part that was wrong.
  zener: {
    id: "zener", name: "Zener diode", prefix: "D",
    primitives: [
      L(0, -32, 0, -10), L(0, 10, 0, 32),
      P([{ x: -9, y: -10 }, { x: 9, y: -10 }, { x: 0, y: 10 }], true, false),
      // Cathode bar with a flag at each end, bent to opposite sides — the "Z". One open
      // polyline, so the two bends are round joins rather than butted stroke ends.
      P([{ x: -9, y: 5 }, { x: -9, y: 10 }, { x: 9, y: 10 }, { x: 9, y: 15 }], false, false),
    ],
    pins: [{ name: "A", pos: TOP, spiceOrder: 1, electrical: pp.passive }, { name: "K", pos: BOT, spiceOrder: 2, electrical: pp.passive }],
    attrs: [{ key: "model", label: "Model", kind: "model", default: "ZENER" }],
    bbox: { x1: -11, y1: -32, x2: 11, y2: 32 }, ...sideLabels(15),
  },
  schottky: {
    id: "schottky", name: "Schottky diode", prefix: "D",
    primitives: [
      L(0, -32, 0, -10), L(0, 10, 0, 32),
      P([{ x: -9, y: -10 }, { x: 9, y: -10 }, { x: 0, y: 10 }], true, false),
      // Cathode bar hooked at both ends — the "S". Again one polyline for soft corners.
      P([{ x: -5, y: 5 }, { x: -9, y: 5 }, { x: -9, y: 10 }, { x: 9, y: 10 }, { x: 9, y: 15 }, { x: 5, y: 15 }], false, false),
    ],
    pins: [{ name: "A", pos: TOP, spiceOrder: 1, electrical: pp.passive }, { name: "K", pos: BOT, spiceOrder: 2, electrical: pp.passive }],
    attrs: [{ key: "model", label: "Model", kind: "model", default: "SCHOTTKY" }],
    bbox: { x1: -11, y1: -32, x2: 11, y2: 32 }, ...sideLabels(15),
  },
  led: {
    id: "led", name: "LED", prefix: "D",
    primitives: [
      L(0, -32, 0, -10), L(0, 10, 0, 32),
      P([{ x: -9, y: -10 }, { x: 9, y: -10 }, { x: 0, y: 10 }], true, false),
      L(-9, 10, 9, 10),
      // Emission arrows on the LEFT, so they never collide with the label block that every
      // 2-pin part parks on the right.
      ...rayDiag(-12, -2, -18, -8), ...rayDiag(-12, 5, -18, -1),
    ],
    pins: [{ name: "A", pos: TOP, spiceOrder: 1, electrical: pp.passive }, { name: "K", pos: BOT, spiceOrder: 2, electrical: pp.passive }],
    attrs: [{ key: "model", label: "Model", kind: "model", default: "LED" }],
    bbox: { x1: -20, y1: -32, x2: 11, y2: 32 }, ...sideLabels(15),
  },
  photodiode: {
    id: "photodiode", name: "Photodiode", prefix: "D",
    // Same body as the LED with the arrows REVERSED — light in, not out. `iph` injects the
    // photocurrent (netlist.ts adds a parallel current source), which is the only thing that
    // makes a photodiode behave differently from the diode it physically is.
    primitives: [
      L(0, -32, 0, -10), L(0, 10, 0, 32),
      P([{ x: -9, y: -10 }, { x: 9, y: -10 }, { x: 0, y: 10 }], true, false),
      L(-9, 10, 9, 10),
      ...rayDiag(-18, -8, -12, -2), ...rayDiag(-18, -1, -12, 5),
    ],
    pins: [{ name: "A", pos: TOP, spiceOrder: 1, electrical: pp.passive }, { name: "K", pos: BOT, spiceOrder: 2, electrical: pp.passive }],
    attrs: [
      { key: "model", label: "Model", kind: "model", default: "D" },
      { key: "iph", label: "Photocurrent", unit: "A", kind: "value", default: "10µ" },
    ],
    bbox: { x1: -20, y1: -32, x2: 11, y2: 32 }, ...sideLabels(15),
  },
  opamp: {
    id: "opamp", name: "Op-amp", prefix: "U",
    primitives: [
      P([{ x: -14, y: -18 }, { x: -14, y: 18 }, { x: 18, y: 0 }], true, false), // body triangle (32 × 36)
      L(-32, -16, -14, -16), L(-32, 16, -14, 16), L(18, 0, 32, 0),              // input leads + output lead - pins on the 16-grid
      ...plus(-8, -10, 2), ...minus(-8, 10, 2),                                  // + / − inside, comfortably clear of the slanted edges
    ],
    pins: [
      { name: "in+", pos: { x: -32, y: -16 }, spiceOrder: 1, electrical: "in" },
      { name: "in-", pos: { x: -32, y: 16 }, spiceOrder: 2, electrical: "in" },
      { name: "out", pos: { x: 32, y: 0 }, spiceOrder: 3, electrical: "out" },
    ],
    // THE RAILS LIVE ON THE PART, NOT ON A PAIR OF FLOATING SOURCES.
    //
    // This is a 3-pin ideal macro: in+, in-, out, and no supply pins - the netlist element
    // (types.ts OPAMP) clips its output between `vmax`/`vmin` instead of drawing current from a
    // rail. An agent asked for "a non-inverting amp using a TL072" correctly reasons that a real
    // part needs ±15 V, finds no supply pin to wire to, and adds VCC/VEE sources whose "+"
    // terminal connects to NOTHING. That is what shipped: two floating sources cluttering the
    // schematic, and a "TL072" that was neither powered nor rail-limited (it still clipped at the
    // hard-coded ±15 default no matter what the user asked for).
    //
    // Declaring vmax/vmin HERE is what makes the rails real and reachable. netlist.ts already
    // reads them (netlist.ts: `vmax: num(c, "vmax", 15)`), but build_circuit only copies through
    // attributes the SYMBOL declares (tools.ts extraAttrsOf filters against sym.attrs), so before
    // this every attempt to set a rail from a builder was silently discarded. With them declared:
    // a ±5 V single-op-amp design clips at ±5 V, the properties panel exposes the rails, and no
    // builder ever needs to emit a supply source that goes nowhere.
    attrs: [
      { key: "gain", label: "Open-loop gain", kind: "value", default: "100k" },
      { key: "vmax", label: "V+ rail (output clips here)", unit: "V", kind: "value", default: "15" },
      { key: "vmin", label: "V− rail (output clips here)", unit: "V", kind: "value", default: "-15" },
    ],
    bbox: { x1: -32, y1: -18, x2: 32, y2: 18 }, refdesPos: { x: 0, y: -24 }, valuePos: { x: 0, y: 24 },
  },
  vcvs: {
    id: "vcvs", name: "VCVS (E)", prefix: "E",
    primitives: [
      L(0, -32, 0, -15), L(0, 15, 0, 32), C(0, 0, 15),
      L(-32, -16, -13, -16), L(-13, -16, -13, -7), L(-32, 16, -13, 16), L(-13, 16, -13, 7), // control leads - pins on the 16-grid, short jog to the circle
      ...plus(0, -7, 2.5), ...minus(0, 7, 2.5),   // + / − centered in the circle - matches vsource
    ],
    pins: [
      { name: "out+", pos: TOP, spiceOrder: 1, electrical: "out" }, { name: "out-", pos: BOT, spiceOrder: 2, electrical: "out" },
      { name: "in+", pos: { x: -32, y: -16 }, spiceOrder: 3, electrical: "in" }, { name: "in-", pos: { x: -32, y: 16 }, spiceOrder: 4, electrical: "in" },
    ],
    attrs: [{ key: "gain", label: "Gain (V/V)", kind: "value", default: "1" }],
    bbox: { x1: -32, y1: -32, x2: 17, y2: 32 }, ...sideLabels(21),
  },
  ccvs: {
    id: "ccvs", name: "CCVS (H)", prefix: "H",
    primitives: [
      L(0, -32, 0, -15), L(0, 15, 0, 32),
      P([{ x: 0, y: -15 }, { x: 15, y: 0 }, { x: 0, y: 15 }, { x: -15, y: 0 }], true, false), // diamond body
      ...plus(0, -7, 2.5), ...minus(0, 7, 2.5),
    ],
    pins: [
      { name: "+", pos: TOP, spiceOrder: 1, electrical: "out" },
      { name: "-", pos: BOT, spiceOrder: 2, electrical: "out" },
    ],
    attrs: [
      { key: "vctrl", label: "Sense source", kind: "text", default: "V1" },
      { key: "gain", label: "Transresistance (Ω)", kind: "value", default: "1" },
    ],
    bbox: { x1: -17, y1: -32, x2: 17, y2: 32 }, ...sideLabels(21),
  },
  cccs: {
    id: "cccs", name: "CCCS (F)", prefix: "F",
    primitives: [
      L(0, -32, 0, -15), L(0, 15, 0, 32),
      P([{ x: 0, y: -15 }, { x: 15, y: 0 }, { x: 0, y: 15 }, { x: -15, y: 0 }], true, false),
      L(0, -7, 0, 5), arrow(0, 8, "down", 5, 4),
    ],
    pins: [
      { name: "+", pos: TOP, spiceOrder: 1, electrical: "out" },
      { name: "-", pos: BOT, spiceOrder: 2, electrical: "out" },
    ],
    attrs: [
      { key: "vctrl", label: "Sense source", kind: "text", default: "V1" },
      { key: "gain", label: "Current gain", kind: "value", default: "1" },
    ],
    bbox: { x1: -17, y1: -32, x2: 17, y2: 32 }, ...sideLabels(21),
  },
  vccs: {
    id: "vccs", name: "VCCS (G)", prefix: "G",
    primitives: [
      L(0, -32, 0, -15), L(0, 15, 0, 32), C(0, 0, 15),
      L(-32, -16, -13, -16), L(-13, -16, -13, -7), L(-32, 16, -13, 16), L(-13, 16, -13, 7), // control leads - pins on the 16-grid, short jog to the circle
      L(0, -7, 0, 5), arrow(0, 8, "down", 5, 4),  // ↓ centered in the circle - matches isource
    ],
    pins: [
      { name: "out+", pos: TOP, spiceOrder: 1, electrical: "out" }, { name: "out-", pos: BOT, spiceOrder: 2, electrical: "out" },
      { name: "in+", pos: { x: -32, y: -16 }, spiceOrder: 3, electrical: "in" }, { name: "in-", pos: { x: -32, y: 16 }, spiceOrder: 4, electrical: "in" },
    ],
    attrs: [{ key: "gain", label: "gm (A/V)", kind: "value", default: "1m" }],
    bbox: { x1: -32, y1: -32, x2: 17, y2: 32 }, ...sideLabels(21),
  },
  nmos: {
    id: "nmos", name: "NMOS", prefix: "M",
    primitives: [
      L(0, -32, 0, -16), L(-6, -16, 0, -16),   // drain lead → channel top
      L(0, 32, 0, 16), L(-6, 16, 0, 16),        // source lead → channel bottom
      L(-6, -16, -6, 16),                        // channel
      L(-32, 0, -16, 0), L(-16, -16, -16, 16),   // gate lead + gate plate
      arrow(-5, 16, "left", 4, 4),               // n-channel: arrow centered on the source segment, pointing toward the channel
    ],
    pins: [
      { name: "D", pos: TOP, spiceOrder: 1, electrical: pp.passive },
      { name: "G", pos: { x: -32, y: 0 }, spiceOrder: 2, electrical: "in" },
      { name: "S", pos: BOT, spiceOrder: 3, electrical: pp.passive },
    ],
    attrs: [
      { key: "model", label: "Model", kind: "model", default: "NMOS" },
      { key: "W", label: "W", unit: "m", kind: "value", default: "1µ" },
      { key: "L", label: "L", unit: "m", kind: "value", default: "1µ" },
    ],
    bbox: { x1: -32, y1: -32, x2: 8, y2: 32 }, refdesPos: { x: 14, y: -9 }, valuePos: { x: 14, y: 9 },
  },
  pmos: {
    id: "pmos", name: "PMOS", prefix: "M",
    primitives: [
      L(0, -32, 0, -16), L(-6, -16, 0, -16),
      L(0, 32, 0, 16), L(-6, 16, 0, 16),
      L(-6, -16, -6, 16),
      L(-32, 0, -16, 0), L(-16, -16, -16, 16),
      arrow(-1, 16, "right", 4, 4),              // p-channel: arrow centered on the source segment, pointing away from the channel
    ],
    pins: [
      { name: "D", pos: TOP, spiceOrder: 1, electrical: pp.passive },
      { name: "G", pos: { x: -32, y: 0 }, spiceOrder: 2, electrical: "in" },
      { name: "S", pos: BOT, spiceOrder: 3, electrical: pp.passive },
    ],
    attrs: [
      { key: "model", label: "Model", kind: "model", default: "PMOS" },
      { key: "W", label: "W", unit: "m", kind: "value", default: "2µ" },
      { key: "L", label: "L", unit: "m", kind: "value", default: "1µ" },
    ],
    bbox: { x1: -32, y1: -32, x2: 8, y2: 32 }, refdesPos: { x: 14, y: -9 }, valuePos: { x: 14, y: 9 },
  },
  npn: {
    id: "npn", name: "NPN BJT", prefix: "Q",
    primitives: [
      L(0, -32, 0, -12), L(0, 12, 0, 32),         // collector + emitter leads
      L(-32, 0, -12, 0),                            // base lead
      L(-12, -8, -12, 8),                           // base plate
      L(-12, -4, 0, -12),                           // collector diagonal up to the lead
      L(-12, 4, 0, 12),                             // emitter diagonal down to the lead
      arrowDiag(0, 12, -12, 4, 5, 4),               // NPN: arrow on emitter, pointing OUT (away from base)
    ],
    pins: [
      { name: "C", pos: TOP, spiceOrder: 1, electrical: pp.passive },
      { name: "B", pos: { x: -32, y: 0 }, spiceOrder: 2, electrical: "in" },
      { name: "E", pos: BOT, spiceOrder: 3, electrical: pp.passive },
    ],
    attrs: [{ key: "model", label: "Model", kind: "model", default: "NPN" }],
    bbox: { x1: -32, y1: -32, x2: 8, y2: 32 }, refdesPos: { x: 14, y: -9 }, valuePos: { x: 14, y: 9 },
  },
  pnp: {
    id: "pnp", name: "PNP BJT", prefix: "Q",
    primitives: [
      L(0, -32, 0, -12), L(0, 12, 0, 32),
      L(-32, 0, -12, 0),
      L(-12, -8, -12, 8),
      L(-12, -4, 0, -12),
      L(-12, 4, 0, 12),
      arrowDiag(-12, 4, 0, 12, 5, 4),               // PNP: arrow on emitter, pointing IN (toward base)
    ],
    pins: [
      { name: "C", pos: TOP, spiceOrder: 1, electrical: pp.passive },
      { name: "B", pos: { x: -32, y: 0 }, spiceOrder: 2, electrical: "in" },
      { name: "E", pos: BOT, spiceOrder: 3, electrical: pp.passive },
    ],
    attrs: [{ key: "model", label: "Model", kind: "model", default: "PNP" }],
    bbox: { x1: -32, y1: -32, x2: 8, y2: 32 }, refdesPos: { x: 14, y: -9 }, valuePos: { x: 14, y: 9 },
  },
  // ───── JFETs ─────
  // The channel is one unbroken bar from drain to source drawn HEAVY (the `wide` flag doubles
  // the stroke), with the drain and source leads continuing it thin — which is how a JFET is
  // drawn, and what tells it apart from a MOSFET at a glance: there is no gate plate standing
  // off the channel, because there is no oxide. The gate arrow points IN for n-channel and OUT
  // for p-channel, the same convention the BJT emitter arrow follows.
  njf: {
    id: "njf", name: "N-JFET", prefix: "J",
    primitives: [
      L(0, -32, 0, -16), L(0, 16, 0, 32),
      { ...L(0, -16, 0, 16), wide: true },
      L(-32, 0, -6, 0),
      arrow(0, 0, "right", 6, 5),
    ],
    pins: [
      { name: "D", pos: TOP, spiceOrder: 1, electrical: pp.passive },
      { name: "G", pos: { x: -32, y: 0 }, spiceOrder: 2, electrical: "in" },
      { name: "S", pos: BOT, spiceOrder: 3, electrical: pp.passive },
    ],
    attrs: [{ key: "model", label: "Model", kind: "model", default: "NJF" }],
    bbox: { x1: -32, y1: -32, x2: 8, y2: 32 }, refdesPos: { x: 14, y: -9 }, valuePos: { x: 14, y: 9 },
  },
  pjf: {
    id: "pjf", name: "P-JFET", prefix: "J",
    primitives: [
      L(0, -32, 0, -16), L(0, 16, 0, 32),
      { ...L(0, -16, 0, 16), wide: true },
      L(-32, 0, -6, 0),
      arrow(-6, 0, "left", 6, 5),
    ],
    pins: [
      { name: "D", pos: TOP, spiceOrder: 1, electrical: pp.passive },
      { name: "G", pos: { x: -32, y: 0 }, spiceOrder: 2, electrical: "in" },
      { name: "S", pos: BOT, spiceOrder: 3, electrical: pp.passive },
    ],
    attrs: [{ key: "model", label: "Model", kind: "model", default: "PJF" }],
    bbox: { x1: -32, y1: -32, x2: 8, y2: 32 }, refdesPos: { x: 14, y: -9 }, valuePos: { x: 14, y: 9 },
  },
  // ───── switches (SPICE S / W) ─────
  // The cheapest possible unlock for switching power: an ideal switch + a diode + an inductor
  // IS a buck converter. The main path runs vertically like every other 2-pin part; the control
  // port enters on the left, at the same y=±16 grid the VCVS/VCCS control pins use.
  swtch: {
    id: "swtch", name: "Switch (S, V-controlled)", prefix: "S",
    primitives: [
      L(0, -32, 0, -14), L(0, 14, 0, 32),
      C(0, -14, 2.5), C(0, 14, 2.5),                 // the two contacts
      L(0, 14, 11, -11),                              // the blade, drawn open
      L(-32, -16, -20, -16), L(-20, -16, -20, -4), L(-20, -4, -6, -4),   // control + lead
      L(-32, 16, -20, 16), L(-20, 16, -20, 4), L(-20, 4, -6, 4),         // control − lead
      L(-6, -6, -6, 6),                               // control "plate" facing the blade
    ],
    pins: [
      { name: "+", pos: TOP, spiceOrder: 1, electrical: pp.passive },
      { name: "-", pos: BOT, spiceOrder: 2, electrical: pp.passive },
      { name: "c+", pos: { x: -32, y: -16 }, spiceOrder: 3, electrical: "in" },
      { name: "c-", pos: { x: -32, y: 16 }, spiceOrder: 4, electrical: "in" },
    ],
    attrs: [
      { key: "model", label: "Model", kind: "model", default: "SW" },
      { key: "Ron", label: "R on", unit: "Ω", kind: "value", default: "" },
      { key: "Roff", label: "R off", unit: "Ω", kind: "value", default: "" },
      { key: "Vt", label: "Threshold", unit: "V", kind: "value", default: "" },
      { key: "Vh", label: "Hysteresis (±)", unit: "V", kind: "value", default: "" },
    ],
    bbox: { x1: -32, y1: -32, x2: 14, y2: 32 }, refdesPos: { x: 20, y: -9 }, valuePos: { x: 20, y: 9 },
  },
  iswtch: {
    id: "iswtch", name: "Switch (W, I-controlled)", prefix: "W",
    primitives: [
      L(0, -32, 0, -14), L(0, 14, 0, 32),
      C(0, -14, 2.5), C(0, 14, 2.5),
      L(0, 14, 11, -11),
      L(-14, -4, -14, 4), arrow(-14, 8, "down", 5, 4),   // sense-current marker
    ],
    pins: [
      { name: "+", pos: TOP, spiceOrder: 1, electrical: pp.passive },
      { name: "-", pos: BOT, spiceOrder: 2, electrical: pp.passive },
    ],
    attrs: [
      { key: "model", label: "Model", kind: "model", default: "CSW" },
      { key: "vctrl", label: "Sense source", kind: "text", default: "V1" },
      { key: "Ron", label: "R on", unit: "Ω", kind: "value", default: "" },
      { key: "Roff", label: "R off", unit: "Ω", kind: "value", default: "" },
      { key: "It", label: "Threshold", unit: "A", kind: "value", default: "" },
      { key: "Ih", label: "Hysteresis (±)", unit: "A", kind: "value", default: "" },
    ],
    bbox: { x1: -18, y1: -32, x2: 14, y2: 32 }, refdesPos: { x: 20, y: -9 }, valuePos: { x: 20, y: 9 },
  },
  // ───── power MOSFETs (LTspice VDMOS) ─────
  // Drawn with the INTRINSIC BODY DIODE visible, because it is: it carries the freewheeling
  // current in every synchronous converter, and a symbol that hides it teaches the wrong thing.
  vdmos_n: {
    id: "vdmos_n", name: "Power NMOS (VDMOS)", prefix: "M",
    primitives: [
      // Drain and source stubs run all the way across to x=8 so the body diode HANGS OFF THEM.
      // Previously the diode was a free-floating line at x=8 touching nothing, so the symbol
      // drew the one feature it exists to show as a separate object beside the transistor.
      L(0, -32, 0, -16), L(-6, -16, 8, -16),
      L(0, 32, 0, 16), L(-6, 16, 8, 16),
      L(-6, -16, -6, 16),                             // channel
      L(-32, 0, -16, 0), L(-16, -16, -16, 16),        // gate lead + plate
      // Bulk tie: body to the SOURCE, which is what a vertical-DMOS die actually does (and what
      // VdmosModel in sim/types.ts documents). This used to be `L(0,-16, 0,16)` — a solid line
      // from the drain stub to the source stub, which together with the D and S leads drew one
      // unbroken conductor from D to S. The symbol was saying the device is a short, and it
      // closed a rectangle against the channel, which is why it read as a box rather than a FET.
      L(-6, 0, 0, 0), L(0, 0, 0, 16),
      arrow(-5, 0, "left", 4, 4),                     // n-channel bulk arrow, pointing in
      // Intrinsic body diode across D–S: anode on the source stub, cathode on the drain stub,
      // so it blocks in the forward blocking direction and freewheels the other way. The lead is
      // broken either side of the body so the triangle is not struck through.
      L(8, -16, 8, 0), L(8, 8, 8, 16),
      P([{ x: 4, y: 8 }, { x: 12, y: 8 }, { x: 8, y: 0 }], true, false), L(4, 0, 12, 0),
    ],
    pins: [
      { name: "D", pos: TOP, spiceOrder: 1, electrical: pp.passive },
      { name: "G", pos: { x: -32, y: 0 }, spiceOrder: 2, electrical: "in" },
      { name: "S", pos: BOT, spiceOrder: 3, electrical: pp.passive },
    ],
    attrs: [{ key: "model", label: "Model", kind: "model", default: "VDMOSN" }],
    bbox: { x1: -32, y1: -32, x2: 14, y2: 32 }, refdesPos: { x: 20, y: -9 }, valuePos: { x: 20, y: 9 },
  },
  vdmos_p: {
    id: "vdmos_p", name: "Power PMOS (VDMOS)", prefix: "M",
    primitives: [
      // Same corrections as the n-channel above: stubs carry across to the diode, the bulk ties
      // to the SOURCE rather than bridging D to S, and the diode lead breaks around its body.
      // The diode points the other way — in a p-channel device it conducts drain-to-source.
      L(0, -32, 0, -16), L(-6, -16, 8, -16),
      L(0, 32, 0, 16), L(-6, 16, 8, 16),
      L(-6, -16, -6, 16),
      L(-32, 0, -16, 0), L(-16, -16, -16, 16),
      L(-6, 0, 0, 0), L(0, 0, 0, 16),
      arrow(-1, 0, "right", 4, 4),                    // p-channel bulk arrow, pointing out
      L(8, -16, 8, -8), L(8, 0, 8, 16),
      P([{ x: 4, y: -8 }, { x: 12, y: -8 }, { x: 8, y: 0 }], true, false), L(4, 0, 12, 0),
    ],
    pins: [
      { name: "D", pos: TOP, spiceOrder: 1, electrical: pp.passive },
      { name: "G", pos: { x: -32, y: 0 }, spiceOrder: 2, electrical: "in" },
      { name: "S", pos: BOT, spiceOrder: 3, electrical: pp.passive },
    ],
    attrs: [{ key: "model", label: "Model", kind: "model", default: "VDMOSP" }],
    bbox: { x1: -32, y1: -32, x2: 14, y2: 32 }, refdesPos: { x: 20, y: -9 }, valuePos: { x: 20, y: 9 },
  },
  // ───── behavioral sources (B-elements) ─────
  // Value expressions can reference V(node), V(a,b), I(Vsrc), time, plus the built-ins listed
  // in src/lib/sim/bsource.ts (exp, log, sqrt, sin/cos/tanh, abs, min/max, pow, if, limit, pwl,
  // ternary `a ? b : c`, comparisons, &&, ||). A common idiom: `V(in) > 2.5 ? 5 : 0` is a clean
  // comparator.
  bvsource: {
    id: "bvsource", name: "Behavioral V", prefix: "B",
    // diamond body with + / − markers - same family as ccvs/cccs but the symbol is square-on
    // so it visually distinguishes from a regular V source.
    primitives: [
      L(0, -32, 0, -15), L(0, 15, 0, 32),
      P([{ x: 0, y: -15 }, { x: 15, y: 0 }, { x: 0, y: 15 }, { x: -15, y: 0 }], true, false),
      ...plus(0, -7, 2.5), ...minus(0, 7, 2.5),
    ],
    pins: [
      { name: "+", pos: TOP, spiceOrder: 1, electrical: pp.passive },
      { name: "-", pos: BOT, spiceOrder: 2, electrical: pp.passive },
    ],
    attrs: [{ key: "value", label: "V = expr", kind: "expr", default: "V(in)" }],
    bbox: { x1: -17, y1: -32, x2: 17, y2: 32 }, ...sideLabels(21),
  },
  bisource: {
    id: "bisource", name: "Behavioral I", prefix: "B",
    primitives: [
      L(0, -32, 0, -15), L(0, 15, 0, 32),
      P([{ x: 0, y: -15 }, { x: 15, y: 0 }, { x: 0, y: 15 }, { x: -15, y: 0 }], true, false),
      L(0, -7, 0, 5), arrow(0, 8, "down", 5, 4),
    ],
    pins: [
      { name: "+", pos: TOP, spiceOrder: 1, electrical: pp.passive },
      { name: "-", pos: BOT, spiceOrder: 2, electrical: pp.passive },
    ],
    attrs: [{ key: "value", label: "I = expr", kind: "expr", default: "V(in) * 1m" }],
    bbox: { x1: -17, y1: -32, x2: 17, y2: 32 }, ...sideLabels(21),
  },
  // ───── protection, sensing and resonators ─────
  // Each of these netlists to primitives the engine already solves exactly (see netlist.ts),
  // so none of them costs a new device model — what was missing was the SYMBOL and the
  // expansion, not the physics.
  fuse: {
    id: "fuse", name: "Fuse", prefix: "FU",
    // IEC form: the element runs straight through the body, because that is what a fuse is —
    // a deliberately weak piece of the conductor.
    primitives: [
      L(0, -32, 0, -16), L(0, 16, 0, 32),
      L(0, -16, 0, 16),
      P([{ x: -9, y: -16 }, { x: 9, y: -16 }, { x: 9, y: 16 }, { x: -9, y: 16 }], true, false),
    ],
    pins: twoPin(),
    attrs: [
      { key: "value", label: "Rating", unit: "A", kind: "value", default: "1" },
      { key: "r", label: "Resistance", unit: "Ω", kind: "value", default: "10m" },
    ],
    bbox: { x1: -11, y1: -32, x2: 11, y2: 32 }, ...sideLabels(15),
  },
  thermistor: {
    id: "thermistor", name: "Thermistor (NTC)", prefix: "RT",
    // The resistor track with the IEC temperature-dependence mark: a diagonal that starts from a
    // short horizontal foot. The foot is what distinguishes it from the varistor's plain
    // double-headed diagonal, so the two can never be confused on a sheet.
    primitives: [
      L(0, -32, 0, -16), L(0, 16, 0, 32),
      P([
        { x: 0, y: -16 }, { x: 5, y: -12 }, { x: -5, y: -8 }, { x: 5, y: -4 },
        { x: -5, y: 0 }, { x: 5, y: 4 }, { x: -5, y: 8 }, { x: 5, y: 12 }, { x: 0, y: 16 },
      ], false, false),
      L(-15, 16, -9, 16), L(-9, 16, 11, -14),
    ],
    attrs: [
      { key: "value", label: "R at 25 °C", unit: "Ω", kind: "value", default: "10k" },
      { key: "b", label: "B constant", unit: "K", kind: "value", default: "3950" },
    ],
    pins: twoPin(),
    bbox: { x1: -17, y1: -32, x2: 13, y2: 32 }, refdesPos: { x: 17, y: -9 }, valuePos: { x: 17, y: 9 },
  },
  varistor: {
    id: "varistor", name: "Varistor (MOV)", prefix: "RV",
    // Double-headed diagonal: a MOV clamps SYMMETRICALLY, and the symbol should say so.
    primitives: [
      L(0, -32, 0, -16), L(0, 16, 0, 32),
      P([
        { x: 0, y: -16 }, { x: 5, y: -12 }, { x: -5, y: -8 }, { x: 5, y: -4 },
        { x: -5, y: 0 }, { x: 5, y: 4 }, { x: -5, y: 8 }, { x: 5, y: 12 }, { x: 0, y: 16 },
      ], false, false),
      L(-13, 15, 11, -13),
      arrowDiag(11, -13, -13, 15, 5, 4), arrowDiag(-13, 15, 11, -13, 5, 4),
    ],
    attrs: [
      { key: "value", label: "Clamp at 1 mA", unit: "V", kind: "value", default: "30" },
      { key: "alpha", label: "Nonlinearity", kind: "value", default: "30" },
    ],
    pins: twoPin(),
    bbox: { x1: -15, y1: -32, x2: 13, y2: 32 }, refdesPos: { x: 17, y: -9 }, valuePos: { x: 17, y: 9 },
  },
  crystal: {
    id: "crystal", name: "Crystal", prefix: "Y",
    // The quartz blank between two electrodes. Drawn as an open rectangle rather than the `rect`
    // primitive because `rect` always renders at FULL corner radius, which at this size would
    // come out as a lozenge; the global round line-join softens these corners on its own.
    primitives: [
      L(0, -32, 0, -13), L(0, 13, 0, 32),
      L(-12, -13, 12, -13), L(-12, 13, 12, 13),
      P([{ x: -7, y: -8 }, { x: 7, y: -8 }, { x: 7, y: 8 }, { x: -7, y: 8 }], true, false),
    ],
    pins: twoPin(),
    attrs: [
      { key: "value", label: "Frequency", unit: "Hz", kind: "value", default: "16Meg" },
      { key: "cm", label: "Motional C", unit: "F", kind: "value", default: "20f" },
      { key: "rs", label: "ESR", unit: "Ω", kind: "value", default: "30" },
      { key: "cp", label: "Shunt C", unit: "F", kind: "value", default: "5p" },
    ],
    bbox: { x1: -14, y1: -32, x2: 14, y2: 32 }, ...sideLabels(18),
  },
  // ───── thyristors ─────
  diac: {
    id: "diac", name: "DIAC", prefix: "D",
    // Two triangles pointing at each other: conducts either way once it breaks over.
    primitives: [
      L(0, -32, 0, -14), L(0, 14, 0, 32),
      P([{ x: -9, y: -2 }, { x: 9, y: -2 }, { x: 0, y: -14 }], true, false),
      P([{ x: -9, y: 2 }, { x: 9, y: 2 }, { x: 0, y: 14 }], true, false),
    ],
    pins: twoPin("1", "2"),
    attrs: [{ key: "value", label: "Breakover", unit: "V", kind: "value", default: "32" }],
    bbox: { x1: -11, y1: -32, x2: 11, y2: 32 }, ...sideLabels(15),
  },
  scr: {
    id: "scr", name: "SCR / thyristor", prefix: "Q",
    // A rectifier with a gate on the cathode side — which is exactly what it is, plus the latch.
    primitives: [
      L(0, -32, 0, -10), L(0, 10, 0, 32),
      P([{ x: -9, y: -10 }, { x: 9, y: -10 }, { x: 0, y: 10 }], true, false),
      L(-9, 10, 9, 10),
      L(-32, 16, -9, 16), L(-9, 16, -9, 10),
    ],
    pins: [
      { name: "A", pos: TOP, spiceOrder: 1, electrical: pp.passive },
      { name: "K", pos: BOT, spiceOrder: 2, electrical: pp.passive },
      { name: "G", pos: { x: -32, y: 16 }, spiceOrder: 3, electrical: "in" },
    ],
    attrs: [
      { key: "igt", label: "Gate trigger", unit: "A", kind: "value", default: "200µ" },
      { key: "ih", label: "Holding", unit: "A", kind: "value", default: "5m" },
    ],
    bbox: { x1: -32, y1: -32, x2: 11, y2: 32 }, refdesPos: { x: 17, y: -9 }, valuePos: { x: 17, y: 9 },
  },
  triac: {
    id: "triac", name: "TRIAC", prefix: "Q",
    primitives: [
      L(0, -32, 0, -14), L(0, 14, 0, 32),
      P([{ x: -9, y: -2 }, { x: 9, y: -2 }, { x: 0, y: -14 }], true, false),
      P([{ x: -9, y: 2 }, { x: 9, y: 2 }, { x: 0, y: 14 }], true, false),
      L(-32, 16, -9, 16), L(-9, 16, -9, 2),
    ],
    pins: [
      { name: "MT2", pos: TOP, spiceOrder: 1, electrical: pp.passive },
      { name: "MT1", pos: BOT, spiceOrder: 2, electrical: pp.passive },
      { name: "G", pos: { x: -32, y: 16 }, spiceOrder: 3, electrical: "in" },
    ],
    attrs: [
      { key: "igt", label: "Gate trigger", unit: "A", kind: "value", default: "10m" },
      { key: "ih", label: "Holding", unit: "A", kind: "value", default: "20m" },
    ],
    bbox: { x1: -32, y1: -32, x2: 11, y2: 32 }, refdesPos: { x: 17, y: -9 }, valuePos: { x: 17, y: 9 },
  },
  igbt: {
    id: "igbt", name: "IGBT (N-channel)", prefix: "Q",
    // A MOSFET gate structure with a BJT emitter arrow — which is exactly the device: an
    // insulated gate driving a bipolar output stage.
    primitives: [
      L(0, -32, 0, -16), L(-6, -16, 0, -16),
      L(0, 32, 0, 16), L(-6, 16, 0, 16),
      L(-6, -16, -6, 16),
      L(-32, 0, -16, 0), L(-16, -16, -16, 16),
      arrow(0, 16, "right", 6, 5),
    ],
    pins: [
      { name: "C", pos: TOP, spiceOrder: 1, electrical: pp.passive },
      { name: "G", pos: { x: -32, y: 0 }, spiceOrder: 2, electrical: "in" },
      { name: "E", pos: BOT, spiceOrder: 3, electrical: pp.passive },
    ],
    attrs: [{ key: "vth", label: "Gate threshold", unit: "V", kind: "value", default: "5" }],
    bbox: { x1: -32, y1: -32, x2: 8, y2: 32 }, refdesPos: { x: 14, y: -9 }, valuePos: { x: 14, y: 9 },
  },
  // ───── optical ─────
  phototrans: {
    id: "phototrans", name: "Phototransistor", prefix: "Q",
    // An NPN with NO base lead — light is the base drive — and the two arrows saying so.
    primitives: [
      L(0, -32, 0, -12), L(0, 12, 0, 32),
      L(-12, -8, -12, 8),
      L(-12, -4, 0, -12), L(-12, 4, 0, 12),
      arrowDiag(0, 12, -12, 4, 5, 4),
      ...rayDiag(-30, -14, -22, -6), ...rayDiag(-30, -7, -22, 1),
    ],
    pins: [
      { name: "C", pos: TOP, spiceOrder: 1, electrical: pp.passive },
      { name: "E", pos: BOT, spiceOrder: 2, electrical: pp.passive },
    ],
    attrs: [
      { key: "iph", label: "Photocurrent", unit: "A", kind: "value", default: "1µ" },
      { key: "model", label: "Model", kind: "model", default: "NPN" },
    ],
    bbox: { x1: -32, y1: -32, x2: 8, y2: 32 }, refdesPos: { x: 14, y: -9 }, valuePos: { x: 14, y: 9 },
  },
  opto: {
    id: "opto", name: "Optocoupler", prefix: "U",
    // LED on the left, phototransistor on the right, light crossing the gap between them. No
    // package outline: the two arrows already say "these two are coupled ONLY by light", which
    // is the entire point of the part, and a box around it would add nothing but ink.
    primitives: [
      L(-32, -16, -22, -16), L(-22, -16, -22, -8),
      P([{ x: -29, y: -8 }, { x: -15, y: -8 }, { x: -22, y: 4 }], true, false),
      L(-29, 4, -15, 4),
      L(-22, 4, -22, 16), L(-22, 16, -32, 16),
      L(-9, -4, -4, -4), arrow(1, -4, "right", 5, 4),
      L(-9, 4, -4, 4), arrow(1, 4, "right", 5, 4),
      L(32, -16, 22, -16), L(22, -16, 22, -10),
      L(22, 10, 22, 16), L(32, 16, 22, 16),
      L(14, -8, 14, 8),
      L(14, -4, 22, -10), L(14, 4, 22, 10),
      arrowDiag(22, 10, 14, 4, 5, 4),
    ],
    pins: [
      { name: "A", pos: { x: -32, y: -16 }, spiceOrder: 1, electrical: pp.passive },
      { name: "K", pos: { x: -32, y: 16 }, spiceOrder: 2, electrical: pp.passive },
      { name: "C", pos: { x: 32, y: -16 }, spiceOrder: 3, electrical: pp.passive },
      { name: "E", pos: { x: 32, y: 16 }, spiceOrder: 4, electrical: pp.passive },
    ],
    attrs: [{ key: "ctr", label: "Transfer ratio", kind: "value", default: "0.5" }],
    bbox: { x1: -32, y1: -20, x2: 32, y2: 20 }, refdesPos: { x: 0, y: -26 }, valuePos: { x: 0, y: 26 },
  },
  relay: {
    id: "relay", name: "Relay (SPST)", prefix: "RLY",
    primitives: [
      L(-32, -16, -20, -16), L(-20, -16, -20, -12),
      A(-20, -8, 4, -90, 90), A(-20, 0, 4, -90, 90), A(-20, 8, 4, -90, 90),
      L(-20, 12, -20, 16), L(-20, 16, -32, 16),
      L(32, -16, 22, -16), C(22, -16, 2.5),
      L(32, 16, 22, 16), C(22, 16, 2.5),
      L(22, 16, 12, -6),                          // the blade, drawn open
    ],
    pins: [
      { name: "A1", pos: { x: -32, y: -16 }, spiceOrder: 1, electrical: pp.passive },
      { name: "A2", pos: { x: -32, y: 16 }, spiceOrder: 2, electrical: pp.passive },
      { name: "COM", pos: { x: 32, y: -16 }, spiceOrder: 3, electrical: pp.passive },
      { name: "NO", pos: { x: 32, y: 16 }, spiceOrder: 4, electrical: pp.passive },
    ],
    attrs: [
      { key: "vpick", label: "Pull-in", unit: "V", kind: "value", default: "3.5" },
      { key: "rcoil", label: "Coil R", unit: "Ω", kind: "value", default: "200" },
      { key: "lcoil", label: "Coil L", unit: "H", kind: "value", default: "100m" },
      { key: "ron", label: "Contact R", unit: "Ω", kind: "value", default: "50m" },
    ],
    bbox: { x1: -32, y1: -20, x2: 32, y2: 20 }, refdesPos: { x: 0, y: -26 }, valuePos: { x: 0, y: 26 },
  },
  tline: {
    id: "tline", name: "Transmission line", prefix: "T",
    // A stadium the exact height of the pin span, with the conductor drawn straight through it.
    // `rect` always renders at full corner radius, so 32 × 64 gives semicircular caps and a
    // straight side wall spanning y ∈ [−16, 16] — which is where the four pins land, so every
    // lead meets a flat edge rather than dying on a curve.
    primitives: [
      R(-16, -32, 16, 32),
      L(-16, 0, 16, 0),
      L(-32, -16, -16, -16), L(-32, 16, -16, 16),
      L(16, -16, 32, -16), L(16, 16, 32, 16),
    ],
    pins: [
      { name: "in+", pos: { x: -32, y: -16 }, spiceOrder: 1, electrical: pp.passive },
      { name: "in-", pos: { x: -32, y: 16 }, spiceOrder: 2, electrical: pp.passive },
      { name: "out+", pos: { x: 32, y: -16 }, spiceOrder: 3, electrical: pp.passive },
      { name: "out-", pos: { x: 32, y: 16 }, spiceOrder: 4, electrical: pp.passive },
    ],
    attrs: [
      { key: "z0", label: "Impedance", unit: "Ω", kind: "value", default: "50" },
      { key: "td", label: "Delay", unit: "s", kind: "value", default: "1n" },
    ],
    bbox: { x1: -32, y1: -32, x2: 32, y2: 32 }, refdesPos: { x: 0, y: -38 }, valuePos: { x: 0, y: 38 },
  },
  // ───── logic gates ─────
  //
  // Behavioural, not event-driven: each gate netlists to one B-source whose expression is the
  // truth table (see netlist.ts). That is stated plainly in `modelNotes` terms — these are
  // analog gates with a threshold and a rail, which is what makes them useful for the thing
  // people actually reach for them for on an analog sheet (a comparator's logic, an oscillator's
  // feedback, an enable) and NOT a substitute for a digital simulator's timing.
  //
  // Geometry: the AND body is a flat back and a true semicircle. The OR body is three arcs whose
  // endpoints are solved to coincide — back arc centred at (−37,0) r=29 meets the corners
  // (−16,∓20), and each flank arc (centre (−9.4,±16.8), r=37.4) runs from that same corner to
  // the nose at (24,0). They therefore MEET rather than nearly-meet, at every zoom.
  gate_and: {
    id: "gate_and", name: "AND gate", prefix: "U",
    primitives: [...AND_BODY, L(20, 0, 32, 0), ...GATE_IN_LEADS],
    pins: GATE_PINS_2IN, attrs: GATE_ATTRS,
    bbox: { x1: -32, y1: -20, x2: 32, y2: 20 }, refdesPos: { x: 0, y: -26 }, valuePos: { x: 0, y: 26 },
  },
  gate_nand: {
    id: "gate_nand", name: "NAND gate", prefix: "U",
    primitives: [...AND_BODY, C(24, 0, 4), L(28, 0, 32, 0), ...GATE_IN_LEADS],
    pins: GATE_PINS_2IN, attrs: GATE_ATTRS,
    bbox: { x1: -32, y1: -20, x2: 32, y2: 20 }, refdesPos: { x: 0, y: -26 }, valuePos: { x: 0, y: 26 },
  },
  gate_or: {
    id: "gate_or", name: "OR gate", prefix: "U",
    primitives: [...OR_BODY, L(24, 0, 32, 0), ...OR_IN_LEADS],
    pins: GATE_PINS_2IN, attrs: GATE_ATTRS,
    bbox: { x1: -32, y1: -20, x2: 32, y2: 20 }, refdesPos: { x: 0, y: -26 }, valuePos: { x: 0, y: 26 },
  },
  gate_nor: {
    id: "gate_nor", name: "NOR gate", prefix: "U",
    primitives: [...OR_BODY, C(28, 0, 4), ...OR_IN_LEADS],
    pins: GATE_PINS_2IN, attrs: GATE_ATTRS,
    bbox: { x1: -32, y1: -20, x2: 32, y2: 20 }, refdesPos: { x: 0, y: -26 }, valuePos: { x: 0, y: 26 },
  },
  gate_xor: {
    id: "gate_xor", name: "XOR gate", prefix: "U",
    // The OR shield plus the second back arc that is the only thing distinguishing the two.
    primitives: [...OR_BODY, A(-44, 0, 29, -43.6, 43.6), L(24, 0, 32, 0), ...OR_IN_LEADS],
    pins: GATE_PINS_2IN, attrs: GATE_ATTRS,
    bbox: { x1: -32, y1: -20, x2: 32, y2: 20 }, refdesPos: { x: 0, y: -26 }, valuePos: { x: 0, y: 26 },
  },
  gate_not: {
    id: "gate_not", name: "Inverter", prefix: "U",
    primitives: [
      P([{ x: -14, y: -18 }, { x: -14, y: 18 }, { x: 14, y: 0 }], true, false),
      C(18, 0, 4),
      L(-32, 0, -14, 0), L(22, 0, 32, 0),
    ],
    pins: [
      { name: "in", pos: { x: -32, y: 0 }, spiceOrder: 1, electrical: "in" },
      { name: "out", pos: { x: 32, y: 0 }, spiceOrder: 2, electrical: "out" },
    ],
    attrs: GATE_ATTRS,
    bbox: { x1: -32, y1: -18, x2: 32, y2: 18 }, refdesPos: { x: 0, y: -24 }, valuePos: { x: 0, y: 24 },
  },
  // ───── subcircuit instances ─────
  // The user supplies the .subckt name via the "name" attribute; the netlister emits an X
  // element with that name and these pin orderings, and src/lib/sim/subckt.ts inlines the body
  // before the engine sees the netlist. Pin counts must match the corresponding .subckt
  // definition's pin list (a mismatch is reported as a clear error at sim time).
  subckt2: {
    id: "subckt2", name: "Subcircuit (2-pin)", prefix: "X",
    primitives: [
      L(0, -32, 0, -16), L(0, 16, 0, 32),
      R(-12, -16, 12, 16),
    ],
    pins: twoPin("1", "2"),
    attrs: [{ key: "name", label: "Subckt", kind: "text", default: "MYSUB" }],
    bbox: { x1: -14, y1: -32, x2: 14, y2: 32 }, ...sideLabels(18),
  },
  subckt3: {
    id: "subckt3", name: "Subcircuit (3-pin)", prefix: "X",
    primitives: [
      L(0, -32, 0, -16), L(0, 16, 0, 32),                    // top + bottom leads
      L(-32, 0, -16, 0),                                       // left lead
      R(-16, -16, 16, 16),
    ],
    pins: [
      { name: "1", pos: TOP, spiceOrder: 1, electrical: pp.passive },
      { name: "2", pos: { x: -32, y: 0 }, spiceOrder: 2, electrical: pp.passive },
      { name: "3", pos: BOT, spiceOrder: 3, electrical: pp.passive },
    ],
    attrs: [{ key: "name", label: "Subckt", kind: "text", default: "MYSUB" }],
    bbox: { x1: -32, y1: -32, x2: 16, y2: 32 }, refdesPos: { x: 22, y: -9 }, valuePos: { x: 22, y: 9 },
  },
  subckt5: {
    id: "subckt5", name: "Subcircuit (5-pin)", prefix: "X",
    // Op-amp-shaped: 2 inputs left, output right, plus two power pins top/bottom.
    primitives: [
      R(-20, -20, 20, 20),
      L(-32, -16, -20, -16), L(-32, 16, -20, 16),              // 2 left inputs - pins on the 16-grid
      L(20, 0, 32, 0),                                          // 1 right output
      L(0, -32, 0, -20), L(0, 20, 0, 32),                       // top/bottom power
    ],
    pins: [
      { name: "1", pos: { x: -32, y: -16 }, spiceOrder: 1, electrical: "in" },
      { name: "2", pos: { x: -32, y: 16 }, spiceOrder: 2, electrical: "in" },
      { name: "3", pos: { x: 32, y: 0 }, spiceOrder: 3, electrical: "out" },
      { name: "4", pos: TOP, spiceOrder: 4, electrical: "power_in" },
      { name: "5", pos: BOT, spiceOrder: 5, electrical: "power_in" },
    ],
    attrs: [{ key: "name", label: "Subckt", kind: "text", default: "MYSUB" }],
    bbox: { x1: -32, y1: -32, x2: 32, y2: 32 }, refdesPos: { x: 0, y: -28 }, valuePos: { x: 0, y: 28 },
  },
  // ───── DIP-shaped subcircuit bodies (6- and 8-pin) ─────
  // Drawn deliberately as the PACKAGE, not as a function symbol: pin 1 top-left, numbering
  // counter-clockwise, notch at the top. The next thing a student does after simulating an
  // NE555 or an LM311 is push it into a breadboard, and having the schematic pin numbers be the
  // physical DIP pin numbers removes the single most common wiring mistake in a first lab.
  // Pin order is therefore package order (1…8), and every Spice++ library .subckt for an 8-pin
  // part declares its pins in that same package order.
  subckt6: {
    id: "subckt6", name: "Subcircuit (6-pin DIP)", prefix: "X",
    primitives: [
      R(-32, -48, 32, 48),
      A(0, -48, 8, 0, 180),                                              // package notch (top edge)
      C(-24, -38, 2.5),                                                  // pin-1 dot
      L(-48, -32, -32, -32), L(-48, 0, -32, 0), L(-48, 32, -32, 32),     // left  pins 1,2,3
      L(32, 32, 48, 32), L(32, 0, 48, 0), L(32, -32, 48, -32),           // right pins 4,5,6
    ],
    pins: [
      { name: "1", pos: { x: -48, y: -32 }, spiceOrder: 1, electrical: pp.passive },
      { name: "2", pos: { x: -48, y: 0 }, spiceOrder: 2, electrical: pp.passive },
      { name: "3", pos: { x: -48, y: 32 }, spiceOrder: 3, electrical: pp.passive },
      { name: "4", pos: { x: 48, y: 32 }, spiceOrder: 4, electrical: pp.passive },
      { name: "5", pos: { x: 48, y: 0 }, spiceOrder: 5, electrical: pp.passive },
      { name: "6", pos: { x: 48, y: -32 }, spiceOrder: 6, electrical: pp.passive },
    ],
    attrs: [{ key: "name", label: "Subckt", kind: "text", default: "MYSUB" }],
    bbox: { x1: -48, y1: -52, x2: 48, y2: 48 }, refdesPos: { x: 0, y: -60 }, valuePos: { x: 0, y: 60 },
  },
  subckt8: {
    id: "subckt8", name: "Subcircuit (8-pin DIP)", prefix: "X",
    primitives: [
      R(-32, -64, 32, 64),
      A(0, -64, 8, 0, 180),
      C(-24, -54, 2.5),
      L(-48, -48, -32, -48), L(-48, -16, -32, -16), L(-48, 16, -32, 16), L(-48, 48, -32, 48),  // pins 1-4
      L(32, 48, 48, 48), L(32, 16, 48, 16), L(32, -16, 48, -16), L(32, -48, 48, -48),          // pins 5-8
    ],
    pins: [
      { name: "1", pos: { x: -48, y: -48 }, spiceOrder: 1, electrical: pp.passive },
      { name: "2", pos: { x: -48, y: -16 }, spiceOrder: 2, electrical: pp.passive },
      { name: "3", pos: { x: -48, y: 16 }, spiceOrder: 3, electrical: pp.passive },
      { name: "4", pos: { x: -48, y: 48 }, spiceOrder: 4, electrical: pp.passive },
      { name: "5", pos: { x: 48, y: 48 }, spiceOrder: 5, electrical: pp.passive },
      { name: "6", pos: { x: 48, y: 16 }, spiceOrder: 6, electrical: pp.passive },
      { name: "7", pos: { x: 48, y: -16 }, spiceOrder: 7, electrical: pp.passive },
      { name: "8", pos: { x: 48, y: -48 }, spiceOrder: 8, electrical: pp.passive },
    ],
    attrs: [{ key: "name", label: "Subckt", kind: "text", default: "MYSUB" }],
    bbox: { x1: -48, y1: -68, x2: 48, y2: 64 }, refdesPos: { x: 0, y: -76 }, valuePos: { x: 0, y: 76 },
  },
  // ───── digital logic (event-driven; see digital_parts.ts and sim/mixed.ts) ─────
  ...DIGITAL_SYMBOLS,
};

export const SYMBOL_LIST: SymbolDef[] = Object.values(SYMBOLS);

/**
 * Every placeable symbol id — the canonical vocabulary the AI tool schemas advertise.
 *
 * DERIVED, never hand-written. Four tool schemas used to carry the same literal list of sixteen
 * types, so any part added after those lists were written existed on the shelf, netlisted
 * correctly, and was still invisible to the agent: `resolveType` knew the name but the schema
 * refused it. Generating it means a symbol becomes reachable the moment it exists here.
 *
 * It lives beside SYMBOLS rather than in tools.ts because tools.ts and tools_ext.ts form a
 * deliberate import cycle (see the note at the top of tools_ext.ts) — a binding read at module
 * top level, as a schema literal must be, cannot come from either side of it.
 */
export const PLACEABLE_TYPES: string[] = Object.keys(SYMBOLS);

// ─── functional symbols for named library parts ──────────────────────────────────────────
//
// ISSUE #18, the most visible thing on the sheet. An LM358 was drawn as the generic `subckt5`
// blob — a plain rectangle with five pins named "1".."5" — because a named library part is
// placed on a generic N-pin subcircuit body. A part the user recognises has to LOOK like what
// it does: an op-amp is a triangle with + and − marked and its supplies shown, a comparator is
// a triangle, a regulator is a box with IN / OUT / GND, a timer is the DIP with its pins named.
//
// WHY THIS IS A DRAW-TIME OVERLAY AND NOT A NEW SYMBOL ID.
// The variant keeps the base symbol's pin list, pin coordinates, pin order and bbox EXACTLY —
// only the body drawing and the pin captions change. That has three consequences that a new
// symbol id could not deliver:
//   • already-saved documents (and the founder's screenshot) start rendering correctly with no
//     migration, because nothing about the instance changes;
//   • no wire can detach and no netlist can change, because no pin moves and `symbolId` — which
//     netlist.ts switches on — is untouched;
//   • hit-testing, label geometry and every layout suite keep measuring the same rectangle.
//
// HONESTY RULE (see the file header of parts/library.ts). A variant is applied ONLY for a part
// name we can source a pin map for. An unknown 5-pin subcircuit keeps the numbered blob: a
// triangle labelled IN+/IN−/OUT on a subcircuit whose pin order we are guessing would be a
// confidently-wrong drawing, which is worse than an honest generic one.

export type PartFunction = "opamp" | "comparator" | "regulator" | "timer";

export interface FunctionalSymbol {
  /** Stable id, e.g. "opamp5". */
  id: string;
  fn: PartFunction;
  /** Human name of the function, for tooltips/tests. */
  fnName: string;
  /** Base symbol id this is drawn in place of. Pins are IDENTICAL in count, order and position. */
  base: string;
  /** Replacement body drawing. `null` ⇒ keep the base drawing (the DIP packages are already right). */
  primitives: SymbolPrimitive[] | null;
  /** Function of pin i, in the BASE symbol's pin order. "" ⇒ this pin has no name to show. */
  pinLabels: string[];
  /** Where pin i's caption is drawn (symbol-local, un-rotated). null ⇒ draw no caption. */
  captions: (PinCaption | null)[];
}

/** Anchor for a pin caption. Text is never rotated — always horizontal, always readable. */
export interface PinCaption { x: number; y: number; align: "left" | "right" | "center" }

// Amplifier triangle sized to sit inside subckt5's bbox (±32). Left edge x = −18 spans y ∈
// [−28, 28]; apex at (26, 0). At x = 0 the sloped edges are at y = ∓16.5, so the supply leads
// drawn from the ±32 pins to ∓14 meet the body instead of stopping short of it.
const AMP_TRI: SymbolPrimitive[] = [
  P([{ x: -18, y: -28 }, { x: -18, y: 28 }, { x: 26, y: 0 }], true, false),
  L(-32, -16, -18, -16), L(-32, 16, -18, 16),   // IN+ / IN− leads (pins stay on the 16-grid)
  L(26, 0, 32, 0),                               // OUT lead
  L(0, -32, 0, -14), L(0, 32, 0, 14),            // V+ / V− leads into the body
];
/** Op-amp: the triangle plus the + and − that make the two inputs unambiguous. */
const OPAMP_TRI: SymbolPrimitive[] = [...AMP_TRI, ...plus(-11, -13, 2.5), ...minus(-11, 13, 2.5)];
/** Comparator: same triangle, plus the analog-in → digital-out step that tells it apart. */
const CMP_TRI: SymbolPrimitive[] = [
  ...AMP_TRI, ...plus(-11, -13, 2.5), ...minus(-11, 13, 2.5),
  // step glyph: a rising edge, drawn small and clear of the sloped edges
  P([{ x: 2, y: 5 }, { x: 8, y: 5 }, { x: 8, y: -5 }, { x: 14, y: -5 }], false, false),
];
/** Regulator: a box, taller than the generic subckt3 square so three pin captions fit inside.
 *  Stays within subckt3's bbox (x ∈ [−32, 16], y ∈ [−32, 32]) so no geometry shifts. */
const REG_BOX: SymbolPrimitive[] = [
  R(-16, -24, 16, 24),
  L(0, -32, 0, -24), L(-32, 0, -16, 0), L(0, 32, 0, 24),
];

const OPAMP_PINS = ["IN+", "IN−", "OUT", "V+", "V−"];
/** LM339-class section: the fifth pin is the commoned output emitter, i.e. GND, not a V− rail. */
const CMP5_PINS = ["IN+", "IN−", "OUT", "V+", "GND"];
const NE555_PINS = ["GND", "TRIG", "OUT", "RST", "CTRL", "THR", "DIS", "VCC"];
const LM311_PINS = ["GND", "IN+", "IN−", "V−", "BAL", "STRB", "OUT", "V+"];

const cap = (x: number, y: number, align: PinCaption["align"]): PinCaption => ({ x, y, align });
/**
 * Amplifier caption layout. The two inputs are deliberately NOT captioned: the drawn + and −
 * ARE their names, and a triangle whose inputs read "IN+ / IN−" in 9 px text inside a 40-px-wide
 * body is less legible than the marks, not more. The output is the apex — also self-evident.
 * The SUPPLY pins are the ambiguous ones on a real part, so those get the captions, printed in
 * the clear space to the right of each supply lead.
 */
const AMP_CAPTIONS: (PinCaption | null)[] = [null, null, null, cap(7, -25, "left"), cap(7, 25, "left")];
/** Regulator box: pin captions inside the body, on the edge each pin enters through. */
const REG_CAPTIONS: (PinCaption | null)[] = [cap(0, -16, "center"), cap(-13, 0, "left"), cap(0, 16, "center")];
/** DIP-8: pins 1-4 down the left edge, 5-8 up the right edge; captions inside, beside the pin. */
const DIP8_CAPTIONS: (PinCaption | null)[] = [
  cap(-27, -48, "left"), cap(-27, -16, "left"), cap(-27, 16, "left"), cap(-27, 48, "left"),
  cap(27, 48, "right"), cap(27, 16, "right"), cap(27, -16, "right"), cap(27, -48, "right"),
];

const mk = (id: string, fn: PartFunction, fnName: string, base: string,
            primitives: SymbolPrimitive[] | null, pinLabels: string[],
            captions: (PinCaption | null)[]): FunctionalSymbol =>
  ({ id, fn, fnName, base, primitives, pinLabels, captions });

/** The drawing each recognised function gets. Exported so tests and tooling can enumerate them. */
export const FUNCTIONAL_SYMBOLS: Record<string, FunctionalSymbol> = {
  opamp5: mk("opamp5", "opamp", "Op-amp", "subckt5", OPAMP_TRI, OPAMP_PINS, AMP_CAPTIONS),
  cmp5: mk("cmp5", "comparator", "Comparator", "subckt5", CMP_TRI, CMP5_PINS, AMP_CAPTIONS),
  timer8: mk("timer8", "timer", "555 timer", "subckt8", null, NE555_PINS, DIP8_CAPTIONS),
  cmp8: mk("cmp8", "comparator", "Comparator", "subckt8", null, LM311_PINS, DIP8_CAPTIONS),
  // Regulators: same box, different pin maps. The 78xx and 79xx pinouts are NOT the same and
  // the LM317's is different again — see parts/library.ts `pinMap` for each, which is where
  // these four orderings come from. Getting this wrong is how a student shorts a rail.
  reg3_in_gnd_out: mk("reg3_in_gnd_out", "regulator", "Linear regulator", "subckt3", REG_BOX, ["IN", "GND", "OUT"], REG_CAPTIONS),
  reg3_gnd_in_out: mk("reg3_gnd_in_out", "regulator", "Linear regulator", "subckt3", REG_BOX, ["GND", "IN", "OUT"], REG_CAPTIONS),
  reg3_adj_out_in: mk("reg3_adj_out_in", "regulator", "Adjustable regulator", "subckt3", REG_BOX, ["ADJ", "OUT", "IN"], REG_CAPTIONS),
  reg3_gnd_out_in: mk("reg3_gnd_out_in", "regulator", "LDO regulator", "subckt3", REG_BOX, ["GND", "OUT", "IN"], REG_CAPTIONS),
};

/**
 * Part name (the `name` attribute = the .subckt name) → functional symbol id.
 *
 * Every entry is sourced from that part's `pinMap` in src/lib/parts/library.ts. Aliases mirror
 * the ALIAS table in that file's `getPart`, so a document that names the same silicon by its
 * second-source number still draws correctly.
 */
const PART_FUNCTION: Record<string, string> = {
  // op-amps (5-pin section: IN+, IN−, OUT, V+, V−)
  UA741: "opamp5", LM741: "opamp5", MC1741: "opamp5",
  LM358: "opamp5", LM2904: "opamp5",
  LM324: "opamp5", LM2902: "opamp5",
  TL071: "opamp5", TL081: "opamp5",
  TL072: "opamp5", TL082: "opamp5",
  TL074: "opamp5", TL084: "opamp5",
  LF351: "opamp5", LF353: "opamp5",
  // comparators
  LM339: "cmp5", LM393: "cmp5",
  LM311: "cmp8",
  // regulators — pin order per package, from each part's pinMap
  LM7805: "reg3_in_gnd_out", LM7812: "reg3_in_gnd_out", UA7805: "reg3_in_gnd_out", UA7812: "reg3_in_gnd_out",
  LM7905: "reg3_gnd_in_out", UA7905: "reg3_gnd_in_out",
  LM317: "reg3_adj_out_in",
  LM1117_3V3: "reg3_gnd_out_in", LM1117: "reg3_gnd_out_in",
  // timer
  NE555: "timer8", LM555: "timer8", SE555: "timer8",
};

/** Normalise a .subckt name the way parts/library.ts normalises a part number. */
const normPartName = (s: string): string => String(s ?? "").toUpperCase().replace(/[^A-Z0-9_]/g, "");

/**
 * The functional drawing for a `symbolId` + part name, or null when we have no sourced pin map
 * and must keep the honest generic body.
 */
export function functionalSymbolFor(symbolId: string, partName: string | null | undefined): FunctionalSymbol | null {
  if (!partName) return null;
  const key = normPartName(partName);
  if (!key || key === "MYSUB") return null;
  let id = PART_FUNCTION[key];
  // The 555 pinout is identical across every vendor and every 555 variant (CMOS or bipolar),
  // so the whole family is safe to recognise by pattern. No other family is: an unknown "LM…"
  // could be anything, and guessing its pin order would be worse than the generic blob.
  if (!id && /^[A-Z]{0,4}555[A-Z]?$/.test(key)) id = "timer8";
  if (!id) return null;
  const fs = FUNCTIONAL_SYMBOLS[id];
  if (!fs || fs.base !== symbolId) return null;         // pin geometry must match, or draw nothing
  const base = SYMBOLS[symbolId];
  if (!base || base.pins.length !== fs.pinLabels.length || base.pins.length !== fs.captions.length) return null;
  return fs;
}

/** Convenience: the functional drawing for a placed instance (reads its `name` attribute). */
export function functionalSymbolOf(c: { symbolId: string; attrs?: Record<string, string> }): FunctionalSymbol | null {
  return functionalSymbolFor(c.symbolId, c.attrs?.name);
}

// ─── source value → human parameters ─────────────────────────────────────────────────────
//
// ISSUE #17. A gate-drive source printed the word "pulse" under its refdes. "VGH / pulse" tells
// a reader NOTHING — not the levels it swings between, not how fast it switches, not the duty
// cycle, which are the only three numbers anyone reads a gate drive for. Same for "exp" and
// "PWL". Every transient source now prints the parameters that actually distinguish it, in the
// same compact `formatValue` house style the sine case already used.

/** Argument list of a SPICE source function, e.g. "PULSE(0 12 0 1n 1n 2.15u 5u)" → 7 strings. */
function sourceArgs(r: string): string[] {
  const i = r.indexOf("(");
  if (i < 0) return [];
  const j = r.lastIndexOf(")");
  return r.slice(i + 1, j < 0 ? undefined : j).split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
}
/** nth argument as a number, or NaN. */
const argNum = (a: string[], i: number): number => (i < a.length ? parseValue(a[i]) : NaN);
/** "0 to 12V" — both levels, unit printed once, so the swing reads at a glance. */
function levelSpan(lo: number, hi: number, unit: string): string {
  if (!isFinite(lo) || !isFinite(hi)) return "";
  if (lo === hi) return formatValue(lo, unit);
  return `${formatValue(lo)} to ${formatValue(hi, unit)}`;
}
/** Duty cycle as a percentage with just enough precision to be meaningful (43%, 4.3%). */
function dutyText(pw: number, per: number): string {
  if (!isFinite(pw) || !isFinite(per) || per <= 0 || pw < 0) return "";
  const d = (100 * pw) / per;
  if (!isFinite(d) || d <= 0 || d >= 100) return "";
  return `${d < 9.95 ? d.toFixed(1) : Math.round(d)}%`;
}

/** Symbols whose primary value is a SPICE source spec (`5`, `SIN(…)`, `PULSE(…)`, …). */
export const SOURCE_SPEC_SYMBOLS: ReadonlySet<string> = new Set(["vsource", "isource", "battery", "acsource"]);
/** Symbols whose primary value names a `.model` card rather than carrying a number. */
export const MODEL_NAMED_SYMBOLS: ReadonlySet<string> = new Set([
  "diode", "zener", "schottky", "led", "photodiode",
  "nmos", "pmos", "npn", "pnp", "njf", "pjf",
  "vdmos_n", "vdmos_p", "swtch", "iswtch",
]);

/** A short, friendly label for a component's value (shown on the schematic). */
export function componentDisplayValue(symbolId: string, raw: string): string {
  const r = (raw ?? "").trim();
  // A rail port's name IS its label — printed verbatim, never parsed as a number, so a rail
  // legitimately called "5V" reads "5V" and not "5 V".
  if (symbolId === "rail") return r || "VCC";
  if (SOURCE_SPEC_SYMBOLS.has(symbolId)) {
    const u = symbolId === "isource" ? "A" : "V";
    const sm = r.match(/^SIN\(\s*([-\d.][^\s)]*)\s+([-\d.][^\s)]*)\s+([-\d.][^\s)]*)/i);
    if (sm) {
      const off = parseValue(sm[1]), amp = parseValue(sm[2]), f = parseValue(sm[3]);
      // A biased sine ("SIN(2.5 2.5 1k)" — the single-supply idiom) is a DIFFERENT waveform from
      // a centred one, and printing only the amplitude hid that. Zero offset keeps the original
      // wording so every existing sheet is byte-identical.
      const head = isFinite(off) && off !== 0 ? `${formatValue(off)}±${formatValue(amp, u)}` : formatValue(amp, u);
      return `${head} sine · ${formatValue(f, "Hz")}`;
    }
    if (/^PULSE\(/i.test(r)) {
      const a = sourceArgs(r);
      const v1 = argNum(a, 0), v2 = argNum(a, 1), tr = argNum(a, 3), tf = argNum(a, 4);
      const pw = argNum(a, 5), per = argNum(a, 6);
      const parts: string[] = [];
      const span = levelSpan(v1, v2, u);
      if (span) parts.push(span);
      if (isFinite(per) && per > 0) parts.push(formatValue(1 / per, "Hz"));
      const duty = dutyText(pw, per);
      if (duty) parts.push(duty);
      // Aperiodic single shot: the width IS the parameter, and there is no frequency or duty.
      if (!(isFinite(per) && per > 0) && isFinite(pw) && pw > 0) parts.push(`${formatValue(pw, "s")} wide`);
      // A step (no width, no period) is what "PULSE(0 5 0 1n)" means — say so rather than lying
      // about a duty cycle we do not have.
      if (parts.length <= 1) {
        const edge = isFinite(tr) && tr > 0 ? tr : isFinite(tf) && tf > 0 ? tf : NaN;
        parts.push(isFinite(edge) ? `step · ${formatValue(edge, "s")} edge` : "pulse");
      }
      return parts.join(" · ");
    }
    if (/^EXP\(/i.test(r)) {
      const a = sourceArgs(r);
      const span = levelSpan(argNum(a, 0), argNum(a, 1), u);
      const tau = argNum(a, 3);
      return [span || "exp", isFinite(tau) && tau > 0 ? `exp τ ${formatValue(tau, "s")}` : "exp"].filter(Boolean).join(" · ");
    }
    if (/^PWL\(/i.test(r)) {
      // PWL is (t, v) pairs. The span of the v's plus the point count is the compact truth;
      // printing the literal arg list would be a 200-px label.
      const a = sourceArgs(r);
      const vs: number[] = [];
      for (let i = 1; i < a.length; i += 2) { const v = parseValue(a[i]); if (isFinite(v)) vs.push(v); }
      if (vs.length === 0) return "PWL";
      const lo = Math.min(...vs), hi = Math.max(...vs);
      return `PWL ${levelSpan(lo, hi, u)} · ${vs.length} pts`;
    }
    // "AC 1" with no DC term is a legal source spec meaning DC 0 — treat the missing DC as 0
    // rather than failing the parse and printing the raw SPICE text back at the user.
    const stripped = r.replace(/\bAC\s+\S+(\s+\S+)?/i, "").replace(/^DC\s+/i, "").trim();
    const n = stripped === "" ? 0 : parseValue(stripped);
    if (isFinite(n)) {
      // "DC 0 AC 1" is an AC-analysis stimulus; showing "0 V" made every AC test bench look dead.
      const ac = r.match(/\bAC\s+(\S+)/i);
      const acMag = ac ? parseValue(ac[1]) : NaN;
      if (isFinite(acMag) && acMag !== 0) return n === 0 ? `${formatValue(acMag, u)} AC` : `${formatValue(n, u)} · ${formatValue(acMag, u)} AC`;
      return formatValue(n, u);
    }
    return r || (u === "V" ? "0 V" : "0 A");
  }
  if (MODEL_NAMED_SYMBOLS.has(symbolId)) {
    // The model name IS the label. Falling back to the symbol's own declared default keeps
    // every one of these in one line instead of a ladder of per-symbol special cases.
    return r || SYMBOLS[symbolId]?.attrs[0]?.default || symbolId.toUpperCase();
  }
  const first = SYMBOLS[symbolId]?.attrs[0];
  // A choice (a logic family) is a setting, not a value worth printing on the sheet; free text
  // (a bit pattern) is printed as typed, never read as a number ("01101001" is not 1.1 Meg).
  if (first?.kind === "choice") return "";
  if (first?.kind === "text") return r;
  const unit = first?.unit ?? "";
  const n = parseValue(r);
  if (symbolId === "counter4" && isFinite(n)) return `mod ${n}`;
  return isFinite(n) ? formatValue(n, unit) : r;
}

// ─── label geometry ──────────────────────────────────────────────────────────────────────
//
// ONE definition of where a refdes/value block lands, shared by the renderer
// (SchematicCanvas.drawSymbol), the layout planner (ai/schematic_layout) and the test suites.
// Two copies of this arithmetic is how the label boxes drifted out of sync with the canvas in
// the first place.

export type LabelAnchor = "right" | "left" | "above" | "below";
/** Preference order. `right` first ⇒ a sheet with room stays pixel-identical to before. */
export const LABEL_ANCHOR_ORDER: readonly LabelAnchor[] = ["right", "left", "above", "below"];

/** Clear distance the renderer leaves between the body bbox and the text block. */
export const LABEL_GAP_X = 7;
/** Half-height of a TWO-line block (refdes over value): 8px line offset + glyph half-height. */
export const LABEL_HALF_H = 14;
/** Half-height of a ONE-line block. */
export const LABEL_LINE_HALF_H = 7;
/** Vertical offset of each line from the block's centre, for a two-line block. */
export const LABEL_LINE_DY = 8;
/** Mean advance width of the 11px Inter label font, measured over [0-9A-Za-zµkΩ.]. */
const LABEL_CHAR_W = 6.3;

export interface LabelRect { x1: number; y1: number; x2: number; y2: number }
export interface LabelSeg { x1: number; y1: number; x2: number; y2: number }

/**
 * Width of a label string as the canvas will render it, in the canvas's own units.
 *
 * Used off-screen (planner, tests) where there is no CanvasRenderingContext2D to measure with.
 * Deliberately a slight OVER-estimate of real Inter metrics: reserving a hair too much is
 * invisible, reserving too little is the collision this whole system exists to prevent.
 */
export function labelTextWidth(s: string): number {
  const t = (s ?? "").trim();
  return t ? Math.ceil(t.length * LABEL_CHAR_W) : 0;
}

/**
 * A resolved slot: which side of the body, and how far the block has slid ALONG that side.
 *
 * The four sides alone are not always enough. A 2-pin part is a tall body with wires leaving the
 * top and bottom, so `above`/`below` sit on its own leads; an op-amp has a wire leaving its right
 * edge at exactly the height the `right` label is centred on. Sliding the block to the body's
 * corner — the ordinary "R1 written beside the top of the part" idiom — clears both without
 * moving anything else on the sheet.
 */
export interface LabelSlot { anchor: LabelAnchor; slide: number }

/** Where a `w × h` text block sits for a given slot, relative to a body bbox. */
export function labelRectForSlot(body: LabelRect, slot: LabelSlot, w: number, h: number, gap = LABEL_GAP_X): LabelRect {
  const cx = (body.x1 + body.x2) / 2 + (slot.anchor === "above" || slot.anchor === "below" ? slot.slide : 0);
  const cy = (body.y1 + body.y2) / 2 + (slot.anchor === "right" || slot.anchor === "left" ? slot.slide : 0);
  switch (slot.anchor) {
    case "right": return { x1: body.x2 + gap, y1: cy - h / 2, x2: body.x2 + gap + w, y2: cy + h / 2 };
    case "left":  return { x1: body.x1 - gap - w, y1: cy - h / 2, x2: body.x1 - gap, y2: cy + h / 2 };
    case "above": return { x1: cx - w / 2, y1: body.y1 - gap - h, x2: cx + w / 2, y2: body.y1 - gap };
    case "below": return { x1: cx - w / 2, y1: body.y2 + gap, x2: cx + w / 2, y2: body.y2 + gap + h };
  }
}

/** Where a `w × h` text block sits for a given anchor, centred on the body (slide 0). */
export function labelRectFor(body: LabelRect, anchor: LabelAnchor, w: number, h: number, gap = LABEL_GAP_X): LabelRect {
  return labelRectForSlot(body, { anchor, slide: 0 }, w, h, gap);
}

// ─── label anchor solver ─────────────────────────────────────────────────────────────────

/** One label that needs a home. `w`/`h` are the measured text block, in the caller's space. */
export interface LabelCandidate {
  key: string;
  body: LabelRect;
  w: number;
  h: number;
  /** Set ⇒ honour it verbatim and treat it as an immovable obstacle for everyone else. */
  fixed?: LabelAnchor;
}
export interface LabelObstacles {
  /** Every drawn body, including the candidates' own. */
  bodies: LabelRect[];
  /** Every drawn wire segment. */
  segments: LabelSeg[];
  /**
   * ISSUE #19 — THE CLIPPED-LABEL BUG. On a real sheet the rendered text read "H", "se", "N",
   * "2V": the TAILS of "VGH", "pulse", "…N", "12V". Everything to the LEFT of each fragment was
   * missing, which is the signature of text that starts outside the drawing surface and is cut
   * by the canvas edge — not of a truncation in the string.
   *
   * Root cause: the visible rectangle was never an input to label placement. `fitView` frames
   * the camera on component BODY bboxes, wires and net labels; a refdes/value block is drawn at
   * a fixed screen size hanging off a body, so on the leftmost or rightmost part it lands
   * OUTSIDE the framed region — and the 18 % fit margin is not enough for a 160 px label.
   * Anchor selection then happily chose `left` for a part on the left edge, putting the text
   * off-surface entirely.
   *
   * Passing the visible rectangle here makes "outside the viewport" a first-class collision:
   * an off-surface slot is rejected exactly like a slot on top of another part's text, so the
   * label flips to a side that is actually on screen. Absent ⇒ unbounded, i.e. the old
   * behaviour, which is what the off-screen planner (no camera, no surface) wants.
   */
  viewport?: LabelRect;
}

const rectOverlapArea = (a: LabelRect, b: LabelRect): number =>
  Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));

/** Length of a segment lying inside a rect's open interior (0 if it misses). */
function segOverlapLen(s: LabelSeg, r: LabelRect): number {
  const lo = { x: Math.min(s.x1, s.x2), y: Math.min(s.y1, s.y2) };
  const hi = { x: Math.max(s.x1, s.x2), y: Math.max(s.y1, s.y2) };
  if (!(hi.x > r.x1 && lo.x < r.x2 && hi.y > r.y1 && lo.y < r.y2)) return 0;
  const dx = Math.max(0, Math.min(hi.x, r.x2) - Math.max(lo.x, r.x1));
  const dy = Math.max(0, Math.min(hi.y, r.y2) - Math.max(lo.y, r.y1));
  return dx + dy;
}

// Text printed over text or over a symbol is ILLEGIBLE; text with a wire under it is merely
// untidy. Both must reach zero on a good sheet, but when a cramped circuit forces a choice the
// solver gives up the wire first. Areas are normalised by the block height so both penalties
// are length-like and comparable.
const W_LABEL = 8, W_BODY = 8, W_WIRE = 1;
/** Text cut off by the canvas edge is not degraded, it is GONE — the heaviest penalty of all. */
const W_CLIP = 40;

/**
 * Every slot a candidate may occupy, in strict preference order:
 *
 *   1. the four sides centred on the body — right, left, above, below. A label that already had
 *      room takes `right` immediately, so a good sheet is left pixel-identical.
 *   2. the same four slid ALONG their edge, smallest displacement first, out to roughly one
 *      body-half plus a line and a half. This is what rescues a part boxed in on all four sides
 *      (an op-amp with a wire leaving every edge): the label steps up to the part's corner and
 *      then a little past it, which is how a draughtsman would letter it.
 *
 * The sweep is bounded on purpose. A label far from its body stops reading as that part's label,
 * which is a worse failure than the wire it was avoiding.
 *
 * `fixed` pins the SIDE (an explicit ComponentInstance.labelAnchor is an instruction, not a
 * hint); the slide is still solved, so a pinned label can still step clear of a lead.
 */
function slotsFor(it: LabelCandidate): LabelSlot[] {
  const sides = it.fixed ? [it.fixed] : LABEL_ANCHOR_ORDER;
  const slots: LabelSlot[] = sides.map((anchor) => ({ anchor, slide: 0 }));
  // Displacement to the body's corner, per side, and the sweep that walks out to it and past.
  const cornerOf = (anchor: LabelAnchor) => (anchor === "right" || anchor === "left"
    ? (it.body.y2 - it.body.y1) / 2 + it.h / 2
    : (it.body.x2 - it.body.x1) / 2 + it.w / 2);
  const step = Math.max(8, it.h / 2);
  for (const anchor of sides) {
    const corner = cornerOf(anchor);
    const mags = new Set<number>([corner]);
    for (let m = step; m <= corner + 1.5 * it.h; m += step) mags.add(m);
    for (const m of [...mags].sort((a, b) => a - b)) slots.push({ anchor, slide: -m }, { anchor, slide: m });
  }
  // Interleave so the sweep is breadth-first over sides: every side's k-th step is tried before
  // any side's (k+1)-th, keeping the displacement as small as possible.
  const centred = slots.slice(0, sides.length);
  const slid = slots.slice(sides.length).sort((a, b) => Math.abs(a.slide) - Math.abs(b.slide)
    || sides.indexOf(a.anchor) - sides.indexOf(b.anchor) || a.slide - b.slide);
  return [...centred, ...slid];
}

/**
 * Choose a slot for every candidate such that no label overlaps a body, another label or a wire.
 * Takes the FIRST clean slot in preference order, so a sheet with room is left untouched.
 *
 * Where no slot is clean (genuinely cramped sheet), it takes the least-bad one by weighted
 * overlap rather than blindly stacking text — degradation, not failure. A few refinement rounds
 * let an early greedy choice be revised once the later labels are known.
 *
 * Pure and deterministic: same input ⇒ same output, with no dependence on the iteration order of
 * the caller's collections (candidates are sorted internally).
 */
export function solveLabelAnchors(items: LabelCandidate[], obstacles: LabelObstacles, gap = LABEL_GAP_X): Map<string, LabelSlot> {
  const chosen = new Map<string, LabelSlot>();
  if (items.length === 0) return chosen;
  const order = [...items].sort((a, b) => a.body.x1 - b.body.x1 || a.body.y1 - b.body.y1 || a.key.localeCompare(b.key));
  const rectOf = (it: LabelCandidate, s: LabelSlot) => labelRectForSlot(it.body, s, it.w, it.h, gap);

  const view = obstacles.viewport;
  /** How far a rect pokes outside the visible surface, in px summed over all four edges. */
  const outsideBy = (r: LabelRect): number => {
    if (!view) return 0;
    return Math.max(0, view.x1 - r.x1) + Math.max(0, r.x2 - view.x2)
         + Math.max(0, view.y1 - r.y1) + Math.max(0, r.y2 - view.y2);
  };

  const placed = new Map<string, LabelRect>();
  /** Fast reject — the common case is "this slot is clean", so never sum a full cost for it. */
  const clashes = (it: LabelCandidate, r: LabelRect): boolean => {
    if (outsideBy(r) > 0) return true;     // clipped by the canvas edge — see LabelObstacles.viewport
    for (const b of obstacles.bodies) if (rectOverlapArea(r, b) > 0) return true;
    for (const [k, other] of placed) if (k !== it.key && rectOverlapArea(r, other) > 0) return true;
    for (const s of obstacles.segments) if (segOverlapLen(s, r) > 0) return true;
    return false;
  };
  const cost = (it: LabelCandidate, r: LabelRect): number => {
    let c = 0;
    // Weighted above every other penalty: a label the reader cannot see AT ALL is strictly worse
    // than one printed over a wire, and worse than one printed over a body (which is at least
    // still readable in part).
    c += W_CLIP * outsideBy(r);
    for (const b of obstacles.bodies) c += (W_BODY * rectOverlapArea(r, b)) / Math.max(1, it.h);
    for (const [k, other] of placed) if (k !== it.key) c += (W_LABEL * rectOverlapArea(r, other)) / Math.max(1, it.h);
    for (const s of obstacles.segments) c += W_WIRE * segOverlapLen(s, r);
    // Tie-break among equally-bad slots by how far the text sits from its own part, so a forced
    // compromise still lands on the nearest reading rather than the furthest.
    return c + Math.abs(r.x1 + r.x2 - it.body.x1 - it.body.x2) / 1e4 + Math.abs(r.y1 + r.y2 - it.body.y1 - it.body.y2) / 1e4;
  };
  const best = (it: LabelCandidate): LabelSlot => {
    const slots = slotsFor(it);
    let bestS = slots[0], bestC = Infinity;
    for (const s of slots) {
      const r = rectOf(it, s);
      if (!clashes(it, r)) return s;         // first clean slot wins outright
      const c = cost(it, r);
      if (c < bestC) { bestC = c; bestS = s; }
    }
    return bestS;
  };

  for (const it of order) { const s = best(it); chosen.set(it.key, s); placed.set(it.key, rectOf(it, s)); }
  // Refinement: re-decide each label now that every other label has a position. Converges fast
  // (each pass can only lower the total cost) and is capped so it can never spin.
  for (let round = 0; round < 3; round++) {
    let moved = false;
    for (const it of order) {
      const cur = chosen.get(it.key)!;
      const s = best(it);
      if (s.anchor !== cur.anchor || s.slide !== cur.slide) { chosen.set(it.key, s); placed.set(it.key, rectOf(it, s)); moved = true; }
    }
    if (!moved) break;
  }
  return chosen;
}

// ─── last-resort clipping guards (issue #19) ─────────────────────────────────────────────
//
// The anchor solver above removes the clipped-label failure in every case where SOME side of
// the part is on screen. Two residual cases need a floor under them, because "a fragment of a
// word" must never be printed no matter how hostile the camera is:
//
//   1. the part itself is near an edge and every one of its slots pokes out  → slide the text
//      back inside (translation only: the reader still sees the whole string, just nearer the
//      part than the ideal slot);
//   2. the string is genuinely wider than the surface                        → shorten it on a
//      WORD boundary with an ellipsis, and let the caller offer the full text on hover.

/** Translate `r` (never resize it) so it lies inside `view` on each axis where it can. */
export function clampLabelRect(r: LabelRect, view: LabelRect): LabelRect {
  let dx = 0, dy = 0;
  const w = r.x2 - r.x1, h = r.y2 - r.y1;
  if (w <= view.x2 - view.x1) {
    if (r.x1 < view.x1) dx = view.x1 - r.x1;
    else if (r.x2 > view.x2) dx = view.x2 - r.x2;
  } else if (r.x1 < view.x1) dx = view.x1 - r.x1;   // too wide: at least start the text on screen
  if (h <= view.y2 - view.y1) {
    if (r.y1 < view.y1) dy = view.y1 - r.y1;
    else if (r.y2 > view.y2) dy = view.y2 - r.y2;
  } else if (r.y1 < view.y1) dy = view.y1 - r.y1;
  return dx || dy ? { x1: r.x1 + dx, y1: r.y1 + dy, x2: r.x2 + dx, y2: r.y2 + dy } : r;
}

/**
 * Shorten `text` to `maxW` on a WORD boundary, appending "…". Returns the input unchanged when
 * it already fits, and returns the first whole word (never a fragment of one) when even that
 * word is wider than the budget — a partial word like "se" out of "pulse" reads as a different,
 * wrong value, which is the failure this whole guard exists to prevent.
 */
export function ellipsizeToWidth(text: string, maxW: number, measure: (s: string) => number): string {
  const t = (text ?? "").trim();
  if (!t || maxW <= 0) return t;
  if (measure(t) <= maxW) return t;
  const words = t.split(/\s+/);
  for (let n = words.length - 1; n >= 1; n--) {
    const cand = words.slice(0, n).join(" ") + "…";
    if (measure(cand) <= maxW) return cand;
  }
  return words.length > 1 ? words[0] + "…" : words[0];
}

/**
 * Default device models keyed by name. Each model carries the full SPICE3-style
 * parameter set used by the simulator (temperature/area scaling, junction caps,
 * body-effect, Early voltages, breakdown). Override individual parameters per
 * instance via component attributes (e.g. Is, N, Bv, Cjo …).
 */
export const DEFAULT_MODELS = {
  // generic silicon small-signal diode (≈ 1N4148-class)
  D:     { Is: 2.52e-9, N: 1.752, Rs: 0.568, Cjo: 4e-12, Vj: 0.7, M: 0.333, Bv: 0,   Ibv: 0,    Tnom: 27, XTI: 3, Eg: 1.11 },
  // generic 5.6 V Zener with finite breakdown knee
  ZENER: { Is: 1e-14,   N: 1.0,   Rs: 1.0,   Cjo: 1e-11, Vj: 0.7, M: 0.5,   Bv: 5.6, Ibv: 1e-3, Tnom: 27, XTI: 3, Eg: 1.11 },
  // ideal Schottky-ish (for rectifiers)
  SCHOTTKY: { Is: 5e-7, N: 1.05,  Rs: 0.05,  Cjo: 1e-10, Vj: 0.4, M: 0.5,   Bv: 40,  Ibv: 1e-4, Tnom: 27, XTI: 2, Eg: 0.69 },
  // GENERIC red LED, not any specific part (the library carries LED_RED / _GREEN / _BLUE with
  // their own cards). Fitted to the one number a datasheet leads with: Vf ≈ 1.9 V at 20 mA —
  //   V = N·Vt·ln(I/Is) + I·Rs = 0.0517·ln(0.02/1.5e-17) + 0.02·5 = 1.80 + 0.10 V.
  // Eg is GaAsP's ~1.9 eV rather than silicon's 1.11, so the temperature drift is a red LED's.
  // Bv is deliberately LOW (5 V): an LED really does break down at a few volts reverse, and a
  // model that lets one sit at −12 V unharmed teaches the wrong thing.
  LED:   { Is: 1.5e-17, N: 2.0, Rs: 5, Cjo: 5e-11, Vj: 0.7, M: 0.5, Bv: 5, Ibv: 1e-5, Tnom: 27, XTI: 3, Eg: 1.9 },

  NMOS: {
    kind: "nmos" as const,
    Vto: 0.7, Kp: 1.15e-4, Lambda: 0.02,
    Gamma: 0.5, Phi: 0.6,                      // body effect, surface inversion
    W: 1e-6, L: 1e-6,
    Cgso: 4e-10, Cgdo: 4e-10, Cgbo: 2e-10,     // overlap caps per metre
    Cbd: 1e-15, Cbs: 1e-15,                    // bulk junction zero-bias caps (F)
    Pb: 0.8, Mj: 0.5,                          // bulk junction
    Tnom: 27,
    Kf: 0, Af: 1,                              // (flicker noise - reserved)
    Nsubvt: 1.3,                               // subthreshold slope factor
  },
  PMOS: {
    kind: "pmos" as const,
    Vto: -0.7, Kp: 4e-5, Lambda: 0.04,
    Gamma: 0.4, Phi: 0.6,
    W: 2e-6, L: 1e-6,
    Cgso: 4e-10, Cgdo: 4e-10, Cgbo: 2e-10,
    Cbd: 1e-15, Cbs: 1e-15,
    Pb: 0.8, Mj: 0.5,
    Tnom: 27,
    Kf: 0, Af: 1,
    Nsubvt: 1.3,
  },

  NPN: {
    kind: "npn" as const,
    Is: 1e-15, Bf: 200, Br: 1, Ne: 1, Nc: 1,
    Vaf: 100, Var: 50,
    Rb: 0, Rc: 0, Re: 0,
    Cje: 8e-12, Vje: 0.75, Mje: 0.33,
    Cjc: 4e-12, Vjc: 0.75, Mjc: 0.33,
    Tnom: 27, XTI: 3, XTB: 0, Eg: 1.11,
  },
  PNP: {
    kind: "pnp" as const,
    Is: 1e-15, Bf: 100, Br: 1, Ne: 1, Nc: 1,
    Vaf: 50, Var: 50,
    Rb: 0, Rc: 0, Re: 0,
    Cje: 8e-12, Vje: 0.75, Mje: 0.33,
    Cjc: 4e-12, Vjc: 0.75, Mjc: 0.33,
    Tnom: 27, XTI: 3, XTB: 0, Eg: 1.11,
  },

  // ── JFETs ───────────────────────────────────────────────────────────────────────────────
  // GENERIC small-signal parts in the 2N3819 / J201 class, not any specific silicon.
  // The two numbers a JFET datasheet actually leads with are Idss and Vgs(off), and Beta is
  // fixed by them: Idss = Beta·Vto²  ⇒  Beta = Idss/Vto². Here Idss = 10 mA at Vto = −3 V gives
  // Beta = 0.010/9 = 1.11e-3 A/V². Cgs/Cgd are the zero-bias junction capacitances (Ciss ≈ 4 pF).
  NJF: {
    kind: "njf" as const,
    Vto: -3, Beta: 1.11e-3, Lambda: 0.01,
    Rd: 10, Rs: 10,
    Cgs: 4e-12, Cgd: 2e-12, Pb: 1.0,
    Is: 1e-14, N: 1.0, Fc: 0.5,
    Tnom: 27, Kf: 0, Af: 1,
  },
  // p-channel: the polarity of Vto flips (enhancement is a POSITIVE gate here) and mobility is
  // roughly a third, so Beta scales down with it.
  PJF: {
    kind: "pjf" as const,
    Vto: 3, Beta: 4e-4, Lambda: 0.01,
    Rd: 20, Rs: 20,
    Cgs: 4e-12, Cgd: 2e-12, Pb: 1.0,
    Is: 1e-14, N: 1.0, Fc: 0.5,
    Tnom: 27, Kf: 0, Af: 1,
  },

  // ── switches ────────────────────────────────────────────────────────────────────────────
  // SPICE3/ngspice defaults (RON=1, ROFF=1e12, VT=0, VH=0). `Vtr` is left undefined so the
  // engine derives the transition width - see types.ts SwitchModel for the exact rule.
  SW:  { kind: "vswitch" as const, Ron: 1, Roff: 1e12, Vt: 0, Vh: 0 },
  CSW: { kind: "iswitch" as const, Ron: 1, Roff: 1e12, Vt: 0, Vh: 0 },

  // ── power MOSFETs ───────────────────────────────────────────────────────────────────────
  // GENERIC parts, not any specific silicon. Roughly a 100 V / 30 A TO-220 n-channel device:
  // Rds(on) ≈ Rd + Rs + 1/(Kp·Vov) ≈ 30 mΩ + 5 mΩ + 8 mΩ at Vgs = 10 V. Every number here is a
  // plausible class-typical value; if you need a NAMED part, paste its VDMOS .model line - the
  // resolver says out loud when it has substituted this generic for a name it did not find.
  VDMOSN: {
    kind: "vdmos-n" as const,
    Vto: 4, Kp: 20, Lambda: 0,
    Rd: 0.03, Rs: 0.005, Rg: 2, Rds: 0,
    Cgs: 1.4e-9, Cgdmax: 1.2e-9, Cgdmin: 5e-11, Cgda: 0.6,
    Nsubvt: 1, Tnom: 27, Rb: 0.01,
    body: { Is: 5e-9, N: 1.6, Rs: 0, Cjo: 1.5e-9, Vj: 0.8, M: 0.5, Bv: 0, Ibv: 0, Tnom: 27, XTI: 3, Eg: 1.11 },
  },
  VDMOSP: {
    kind: "vdmos-p" as const,
    Vto: -4, Kp: 10, Lambda: 0,
    Rd: 0.06, Rs: 0.01, Rg: 3, Rds: 0,
    Cgs: 1.6e-9, Cgdmax: 1.4e-9, Cgdmin: 8e-11, Cgda: 0.6,
    Nsubvt: 1, Tnom: 27, Rb: 0.02,
    body: { Is: 8e-9, N: 1.6, Rs: 0, Cjo: 1.8e-9, Vj: 0.8, M: 0.5, Bv: 0, Ibv: 0, Tnom: 27, XTI: 3, Eg: 1.11 },
  },
};
