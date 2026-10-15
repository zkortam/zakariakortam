/**
 * The digital part library: symbols for the schematic and, beside each, how it netlists into
 * the event-driven kernel (src/lib/sim/mixed.ts).
 *
 * Every part here is DIGITAL: it has propagation delay, memory where the real part has memory,
 * and four-valued logic (0, 1, X, Z). Where a digital pin meets an analog net the netlister
 * inserts a bridge with the part's logic family: an output becomes a driver with finite rise and
 * fall time and a real output resistance, an input becomes a threshold with hysteresis. Two
 * digital pins on a purely digital net never pass through the analog solver at all.
 *
 * Geometry follows components.ts: pins on the 16-unit grid, gate bodies shared with the analog
 * gate family, block parts as boxes with their pin names inside.
 */
import type { AttrDef, GridPoint, SymbolCaption, SymbolDef, SymbolPin, SymbolPrimitive } from "./types";

const L = (x1: number, y1: number, x2: number, y2: number, wide = false): SymbolPrimitive => (wide ? { kind: "line", x1, y1, x2, y2, wide } : { kind: "line", x1, y1, x2, y2 });
const P = (pts: GridPoint[], closed = true, fill = false): SymbolPrimitive => ({ kind: "poly", pts, closed, fill });
const C = (cx: number, cy: number, r: number): SymbolPrimitive => ({ kind: "circle", cx, cy, r });
const A = (cx: number, cy: number, r: number, start: number, end: number): SymbolPrimitive => ({ kind: "arc", cx, cy, r, start, end });
const BOX = (x1: number, y1: number, x2: number, y2: number): SymbolPrimitive => ({ kind: "rect", x1, y1, x2, y2, radius: 4 });
const cap = (text: string, x: number, y: number, align: SymbolCaption["align"], overbar = false): SymbolCaption =>
  (overbar ? { text, x, y, align, overbar } : { text, x, y, align });

// ─── logic families ──────────────────────────────────────────────────────────────────────

/** Electrical behaviour of a family where its pins meet an analog net. */
export interface LogicFamily {
  /** Output levels. */
  vol: number;
  voh: number;
  /** Input switching thresholds: reads 1 once the input reaches vhi, 0 once it falls to vlo. */
  vhi: number;
  vlo: number;
  /** Schmitt-trigger input thresholds (the hysteresis parts). */
  vtPlus: number;
  vtMinus: number;
  /** Output resistance and full-swing edge times. */
  rout: number;
  tr: number;
  tf: number;
}

/**
 * Typical datasheet values. CMOS inputs switch near half the supply; a few tens of millivolts of
 * hysteresis keeps a slow analog edge from chattering, which a real input's own noise and
 * feedback do in hardware. The Schmitt thresholds are the 74HC14 / 74LVC14 / 74LS14 typicals.
 */
export const LOGIC_FAMILIES: Record<string, LogicFamily> = {
  "5 V CMOS": { vol: 0, voh: 5, vhi: 2.55, vlo: 2.45, vtPlus: 2.9, vtMinus: 1.8, rout: 50, tr: 6e-9, tf: 6e-9 },
  "3.3 V CMOS": { vol: 0, voh: 3.3, vhi: 1.7, vlo: 1.6, vtPlus: 1.9, vtMinus: 1.2, rout: 35, tr: 3e-9, tf: 3e-9 },
  TTL: { vol: 0.2, voh: 3.4, vhi: 1.45, vlo: 1.35, vtPlus: 1.7, vtMinus: 0.9, rout: 100, tr: 10e-9, tf: 6e-9 },
};
export const FAMILY_NAMES = Object.keys(LOGIC_FAMILIES);
export const DEFAULT_FAMILY = "5 V CMOS";

const FAMILY_ATTR: AttrDef = { key: "family", label: "Logic family", kind: "choice", options: FAMILY_NAMES, default: DEFAULT_FAMILY };
const DELAY_ATTR: AttrDef = { key: "delay", label: "Delay", unit: "s", kind: "value", default: "10n" };
const INIT_ATTR: AttrDef = { key: "init", label: "Power-on state", kind: "choice", options: ["0", "1", "X"], default: "0" };
const EDGE_ATTR: AttrDef = { key: "edge", label: "Clock edge", kind: "choice", options: ["Rising", "Falling"], default: "Rising" };

// ─── netlisting metadata ─────────────────────────────────────────────────────────────────

export interface DigitalPinMeta {
  /** Kernel port name (mixed.ts compileDigital). */
  port: string;
  dir: "in" | "out";
  /** An analog pin (ADC input, DAC output): netlisted into the analog circuit, not the kernel. */
  analog?: boolean;
}

export interface DigitalSymbolMeta {
  /** Part kind for compileDigital, or an instrument / converter handled by the netlister. */
  kind: string;
  pins: Record<string, DigitalPinMeta>;
  /** Attribute keys whose values netlist as kernel parameters, and how. */
  params?: Record<string, "time" | "number" | "text" | "choice">;
}

export const DIGITAL_META: Record<string, DigitalSymbolMeta> = {};

const inPin = (port: string): DigitalPinMeta => ({ port, dir: "in" });
const outPin = (port: string): DigitalPinMeta => ({ port, dir: "out" });

// ─── gates with any number of inputs ─────────────────────────────────────────────────────

type GateFn = "and" | "nand" | "or" | "nor" | "xor" | "xnor";
const GATE_NAMES: Record<GateFn, string> = { and: "AND", nand: "NAND", or: "OR", nor: "NOR", xor: "XOR", xnor: "XNOR" };
const INPUT_ROWS: Record<number, number[]> = { 2: [-16, 16], 3: [-16, 0, 16], 4: [-32, -16, 16, 32] };
const INPUT_NAMES = ["A", "B", "C", "D"];

/** AND body: flat back, straight flanks, semicircular nose ending at (20, 0). */
const AND_BODY: SymbolPrimitive[] = [L(-16, -20, -16, 20), L(-16, -20, 0, -20), L(-16, 20, 0, 20), A(0, 0, 20, -90, 90)];
/** OR body: the three arcs of components.ts, endpoints solved to coincide. */
const OR_BODY: SymbolPrimitive[] = [A(-37, 0, 29, -43.6, 43.6), A(-9.4, 16.8, 37.4, 26.7, 100.2), A(-9.4, -16.8, 37.4, -100.2, -26.7)];
/** Where the OR back curve sits at height y (|y| ≤ 20): x = −37 + √(29² − y²). */
const orBackX = (y: number) => -37 + Math.sqrt(29 * 29 - y * y);

function gateSymbol(fn: GateFn, n: 2 | 3 | 4): SymbolDef {
  const rows = INPUT_ROWS[n];
  const andLike = fn === "and" || fn === "nand";
  const bubble = fn === "nand" || fn === "nor" || fn === "xnor";
  const prims: SymbolPrimitive[] = [];
  if (andLike) prims.push(...AND_BODY);
  else {
    prims.push(...OR_BODY);
    if (fn === "xor" || fn === "xnor") prims.push(A(-44, 0, 29, -43.6, 43.6));
  }
  const nose = andLike ? 20 : 24;
  if (bubble) prims.push(C(nose + 4, 0, 4));
  if (!bubble || nose + 8 < 32) prims.push(L(bubble ? nose + 8 : nose, 0, 32, 0));
  // Inputs beyond the body ride an extended back bar (IEEE 91 practice), so the body keeps the
  // family's size at every input count.
  if (n === 4) { prims.push(L(-16, -20, -16, -36), L(-16, 20, -16, 36)); }
  for (const y of rows) {
    const inBody = Math.abs(y) <= 20;
    const end = andLike || !inBody ? -16 : Math.round(orBackX(y) * 10) / 10;
    prims.push(L(-32, y, end, y));
  }
  const pins: SymbolPin[] = rows.map((y, i) => ({ name: INPUT_NAMES[i], pos: { x: -32, y }, spiceOrder: i + 1, electrical: "in" as const }));
  pins.push({ name: "Y", pos: { x: 32, y: 0 }, spiceOrder: n + 1, electrical: "out" });
  const half = n === 4 ? 36 : 20;
  const id = `logic_${fn}${n}`;
  DIGITAL_META[id] = {
    kind: fn,
    pins: Object.fromEntries([...INPUT_NAMES.slice(0, n).map((p) => [p, inPin(p)]), ["Y", outPin("Y")]]),
    params: { delay: "time" },
  };
  return {
    id, name: n === 2 ? `${GATE_NAMES[fn]} gate` : `${n}-input ${GATE_NAMES[fn]} gate`, prefix: "U",
    primitives: prims, pins, attrs: [DELAY_ATTR, FAMILY_ATTR],
    bbox: { x1: -32, y1: -half, x2: 32, y2: half },
    refdesPos: { x: 0, y: -half - 6 }, valuePos: { x: 0, y: half + 6 },
  };
}

// ─── one-input parts ─────────────────────────────────────────────────────────────────────

const TRIANGLE: SymbolPrimitive = P([{ x: -14, y: -18 }, { x: -14, y: 18 }, { x: 14, y: 0 }], true, false);

function oneInput(id: string, name: string, kind: string, extra: SymbolPrimitive[], bubble: boolean, attrs: AttrDef[] = [DELAY_ATTR, FAMILY_ATTR]): SymbolDef {
  DIGITAL_META[id] = { kind, pins: { A: inPin("A"), Y: outPin("Y") }, params: { delay: "time" } };
  return {
    id, name, prefix: "U",
    primitives: [TRIANGLE, ...extra, ...(bubble ? [C(18, 0, 4), L(22, 0, 32, 0)] : [L(14, 0, 32, 0)]), L(-32, 0, -14, 0)],
    pins: [
      { name: "A", pos: { x: -32, y: 0 }, spiceOrder: 1, electrical: "in" },
      { name: "Y", pos: { x: 32, y: 0 }, spiceOrder: 2, electrical: "out" },
    ],
    attrs,
    bbox: { x1: -32, y1: -18, x2: 32, y2: 18 }, refdesPos: { x: 0, y: -24 }, valuePos: { x: 0, y: 24 },
  };
}

/** The hysteresis loop glyph a Schmitt-trigger input carries. */
const HYST: SymbolPrimitive[] = [P([{ x: -10, y: 4 }, { x: -2, y: 4 }, { x: -2, y: -4 }, { x: 2, y: -4 }], false), P([{ x: -6, y: 4 }, { x: -6, y: -4 }, { x: 2, y: -4 }], false)];

// ─── block parts ─────────────────────────────────────────────────────────────────────────

interface BlockPin { name: string; row: number; caption?: string; clock?: boolean; overbar?: boolean; optional?: boolean; dir: "in" | "out"; port: string; analog?: boolean }
interface BlockSpec {
  id: string; name: string; prefix?: string; kind: string;
  left: BlockPin[]; right: BlockPin[]; top?: BlockPin[]; bottom?: BlockPin[];
  /** Box half-extent beyond the outermost row (default 16). */
  margin?: number;
  x1?: number; x2?: number;
  attrs: AttrDef[];
  params?: DigitalSymbolMeta["params"];
  extra?: SymbolPrimitive[];
  extraCaptions?: SymbolCaption[];
}

function block(s: BlockSpec): SymbolDef {
  const x1 = s.x1 ?? -32, x2 = s.x2 ?? 32, m = s.margin ?? 16;
  const rows = [...s.left, ...s.right].map((p) => p.row);
  const y1 = Math.min(...rows) - m, y2 = Math.max(...rows) + m;
  const prims: SymbolPrimitive[] = [BOX(x1, y1, x2, y2)];
  const captions: SymbolCaption[] = [];
  const pins: SymbolPin[] = [];
  const optional: string[] = [];
  let order = 1;
  const add = (p: BlockPin, pos: GridPoint) => {
    pins.push({ name: p.name, pos, spiceOrder: order++, electrical: p.dir === "in" ? "in" : "out" });
    if (p.optional) optional.push(p.name);
  };
  for (const p of s.left) {
    prims.push(L(x1 - 16, p.row, x1, p.row));
    if (p.clock) prims.push(P([{ x: x1, y: p.row - 5 }, { x: x1 + 7, y: p.row }, { x: x1, y: p.row + 5 }], false));
    else captions.push(cap(p.caption ?? p.name, x1 + 5, p.row, "left", p.overbar));
    add(p, { x: x1 - 16, y: p.row });
  }
  for (const p of s.right) {
    prims.push(L(x2, p.row, x2 + 16, p.row));
    captions.push(cap(p.caption ?? p.name, x2 - 5, p.row, "right", p.overbar));
    add(p, { x: x2 + 16, y: p.row });
  }
  for (const p of s.top ?? []) {
    prims.push(L(p.row, y1 - 16, p.row, y1));
    captions.push(cap(p.caption ?? p.name, p.row, y1 + 7, "center", p.overbar));
    add(p, { x: p.row, y: y1 - 16 });
  }
  for (const p of s.bottom ?? []) {
    prims.push(L(p.row, y2, p.row, y2 + 16));
    captions.push(cap(p.caption ?? p.name, p.row, y2 - 7, "center", p.overbar));
    add(p, { x: p.row, y: y2 + 16 });
  }
  if (s.extra) prims.push(...s.extra);
  if (s.extraCaptions) captions.push(...s.extraCaptions);
  const all = [...s.left, ...s.right, ...(s.top ?? []), ...(s.bottom ?? [])];
  DIGITAL_META[s.id] = {
    kind: s.kind,
    pins: Object.fromEntries(all.map((p) => [p.name, p.analog ? { port: p.port, dir: p.dir, analog: true } : { port: p.port, dir: p.dir }])),
    params: s.params,
  };
  const top = s.top?.length ? y1 - 16 : y1, bot = s.bottom?.length ? y2 + 16 : y2;
  return {
    id: s.id, name: s.name, prefix: s.prefix ?? "U", primitives: prims, pins, attrs: s.attrs,
    bbox: { x1: s.left.length ? x1 - 16 : x1, y1: top, x2: s.right.length ? x2 + 16 : x2, y2: bot },
    refdesPos: { x: 0, y: top - 6 }, valuePos: { x: 0, y: bot + 6 },
    captions, ...(optional.length ? { optionalPins: optional } : {}),
  };
}

const I = (name: string, row: number, o: Partial<BlockPin> = {}): BlockPin => ({ name, row, dir: "in", port: name, ...o });
const O = (name: string, row: number, o: Partial<BlockPin> = {}): BlockPin => ({ name, row, dir: "out", port: name, ...o });
const CLK = (row: number, optional = false): BlockPin => ({ name: "CLK", row, dir: "in", port: "CLK", clock: true, optional });
const Q = (row: number): BlockPin => O("Q", row);
const QN = (row: number): BlockPin => ({ name: "QN", row, dir: "out", port: "QN", caption: "Q", overbar: true, optional: true });
const PRE: BlockPin = { name: "PRE", row: 0, dir: "in", port: "SET", optional: true };
const CLR: BlockPin = { name: "CLR", row: 0, dir: "in", port: "RST", optional: true };
const FF_ATTRS: AttrDef[] = [DELAY_ATTR, INIT_ATTR, EDGE_ATTR, FAMILY_ATTR];
const FF_PARAMS: DigitalSymbolMeta["params"] = { delay: "time", init: "choice", edge: "choice" };

// ─── seven-segment glyph ─────────────────────────────────────────────────────────────────

/** Segment endpoints a..g of the display glyph (symbol-local), and the decimal point. Exported
 *  so the canvas can light exactly the strokes the symbol draws. */
export const SEG7_GLYPH: { segs: [number, number, number, number][]; dp: { x: number; y: number; r: number } } = {
  segs: [
    [-4, -40, 16, -40],  // a
    [20, -36, 20, -12],  // b
    [20, -4, 20, 20],    // c
    [-4, 24, 16, 24],    // d
    [-8, -4, -8, 20],    // e
    [-8, -36, -8, -12],  // f
    [-4, -8, 16, -8],    // g
  ],
  dp: { x: 28, y: 24, r: 2 },
};

// ─── the library ─────────────────────────────────────────────────────────────────────────

const SYMS: SymbolDef[] = [];
for (const fn of ["and", "nand", "or", "nor", "xor", "xnor"] as GateFn[]) for (const n of [2, 3, 4] as const) SYMS.push(gateSymbol(fn, n));
SYMS.push(oneInput("logic_not", "Inverter", "not", [], true));
SYMS.push(oneInput("logic_buf", "Buffer", "buf", [], false));
SYMS.push(oneInput("logic_schmitt", "Schmitt inverter", "not", HYST, true));

// Tri-state buffer: enable enters the triangle's upper edge from above.
DIGITAL_META.logic_tribuf = { kind: "tribuf", pins: { A: inPin("A"), EN: inPin("EN"), Y: outPin("Y") }, params: { delay: "time", enable: "choice" } };
SYMS.push({
  id: "logic_tribuf", name: "Tri-state buffer", prefix: "U",
  primitives: [TRIANGLE, L(-32, 0, -14, 0), L(14, 0, 32, 0), L(0, -32, 0, -9)],
  pins: [
    { name: "A", pos: { x: -32, y: 0 }, spiceOrder: 1, electrical: "in" },
    { name: "EN", pos: { x: 0, y: -32 }, spiceOrder: 2, electrical: "in" },
    { name: "Y", pos: { x: 32, y: 0 }, spiceOrder: 3, electrical: "out" },
  ],
  attrs: [DELAY_ATTR, { key: "enable", label: "Enable", kind: "choice", options: ["Active high", "Active low"], default: "Active high" }, FAMILY_ATTR],
  bbox: { x1: -32, y1: -32, x2: 32, y2: 18 }, refdesPos: { x: 0, y: -38 }, valuePos: { x: 0, y: 24 },
});

SYMS.push(block({ id: "dff", name: "D flip-flop", kind: "dff", left: [I("D", -16), CLK(16)], right: [Q(-16), QN(16)], top: [PRE], bottom: [CLR], attrs: FF_ATTRS, params: FF_PARAMS }));
SYMS.push(block({ id: "jkff", name: "JK flip-flop", kind: "jkff", left: [I("J", -16), CLK(0), I("K", 16)], right: [Q(-16), QN(16)], top: [PRE], bottom: [CLR], attrs: FF_ATTRS, params: FF_PARAMS }));
SYMS.push(block({ id: "tff", name: "T flip-flop", kind: "tff", left: [I("T", -16, { optional: true }), CLK(16)], right: [Q(-16), QN(16)], top: [PRE], bottom: [CLR], attrs: FF_ATTRS, params: FF_PARAMS }));
SYMS.push(block({ id: "srff", name: "SR flip-flop", kind: "srff", left: [I("S", -16), CLK(0), I("R", 16)], right: [Q(-16), QN(16)], top: [PRE], bottom: [CLR], attrs: FF_ATTRS, params: FF_PARAMS }));
SYMS.push(block({ id: "dlatch", name: "D latch", kind: "dlatch", left: [I("D", -16), I("EN", 16)], right: [Q(-16), QN(16)], bottom: [CLR], attrs: [DELAY_ATTR, INIT_ATTR, FAMILY_ATTR], params: { delay: "time", init: "choice" } }));
SYMS.push(block({ id: "srlatch", name: "SR latch", kind: "srlatch", left: [I("S", -16), I("R", 16)], right: [Q(-16), QN(16)], attrs: [DELAY_ATTR, INIT_ATTR, FAMILY_ATTR], params: { delay: "time", init: "choice" } }));

SYMS.push(block({
  id: "counter4", name: "4-bit counter", kind: "counter",
  left: [CLK(-32), I("EN", 0, { optional: true }), I("CLR", 32, { port: "RST", optional: true })],
  right: [O("Q0", -32, { optional: true }), O("Q1", -16, { optional: true }), O("Q2", 0, { optional: true }), O("Q3", 16, { optional: true }), O("TC", 32, { optional: true })],
  attrs: [{ key: "modulus", label: "Count to", kind: "value", default: "16" }, DELAY_ATTR, EDGE_ATTR, FAMILY_ATTR],
  params: { modulus: "number", delay: "time", edge: "choice" },
}));
SYMS.push(block({
  id: "shiftreg4", name: "4-bit shift register", kind: "shiftreg",
  left: [I("SI", -32), CLK(0), I("CLR", 32, { port: "RST", optional: true })],
  right: [O("Q0", -32, { optional: true }), O("Q1", -16, { optional: true }), O("Q2", 16, { optional: true }), O("Q3", 32, { optional: true })],
  attrs: [DELAY_ATTR, EDGE_ATTR, FAMILY_ATTR],
  params: { delay: "time", edge: "choice" },
}));

// Multiplexers: the trapezoid, select from below.
DIGITAL_META.mux2 = { kind: "mux", pins: { I0: inPin("I0"), I1: inPin("I1"), S: inPin("S0"), Y: outPin("Y") }, params: { delay: "time" } };
SYMS.push({
  id: "mux2", name: "2:1 multiplexer", prefix: "U",
  primitives: [P([{ x: -16, y: -32 }, { x: 16, y: -16 }, { x: 16, y: 16 }, { x: -16, y: 32 }]), L(-32, -16, -16, -16), L(-32, 16, -16, 16), L(16, 0, 32, 0), L(0, 48, 0, 24)],
  pins: [
    { name: "I0", pos: { x: -32, y: -16 }, spiceOrder: 1, electrical: "in" },
    { name: "I1", pos: { x: -32, y: 16 }, spiceOrder: 2, electrical: "in" },
    { name: "S", pos: { x: 0, y: 48 }, spiceOrder: 3, electrical: "in" },
    { name: "Y", pos: { x: 32, y: 0 }, spiceOrder: 4, electrical: "out" },
  ],
  captions: [cap("0", -11, -16, "left"), cap("1", -11, 16, "left")],
  attrs: [DELAY_ATTR, FAMILY_ATTR],
  bbox: { x1: -32, y1: -32, x2: 32, y2: 48 }, refdesPos: { x: 0, y: -38 }, valuePos: { x: 0, y: 54 },
});
DIGITAL_META.mux4 = { kind: "mux", pins: { I0: inPin("I0"), I1: inPin("I1"), I2: inPin("I2"), I3: inPin("I3"), S0: inPin("S0"), S1: inPin("S1"), Y: outPin("Y") }, params: { delay: "time" } };
SYMS.push({
  id: "mux4", name: "4:1 multiplexer", prefix: "U",
  primitives: [
    P([{ x: -16, y: -56 }, { x: 16, y: -40 }, { x: 16, y: 40 }, { x: -16, y: 56 }]),
    L(-32, -48, -16, -48), L(-32, -16, -16, -16), L(-32, 16, -16, 16), L(-32, 48, -16, 48), L(16, 0, 32, 0),
    L(0, 64, 0, 48), L(16, 64, 16, 40),
  ],
  pins: [
    { name: "I0", pos: { x: -32, y: -48 }, spiceOrder: 1, electrical: "in" },
    { name: "I1", pos: { x: -32, y: -16 }, spiceOrder: 2, electrical: "in" },
    { name: "I2", pos: { x: -32, y: 16 }, spiceOrder: 3, electrical: "in" },
    { name: "I3", pos: { x: -32, y: 48 }, spiceOrder: 4, electrical: "in" },
    { name: "S0", pos: { x: 0, y: 64 }, spiceOrder: 5, electrical: "in" },
    { name: "S1", pos: { x: 16, y: 64 }, spiceOrder: 6, electrical: "in" },
    { name: "Y", pos: { x: 32, y: 0 }, spiceOrder: 7, electrical: "out" },
  ],
  captions: [cap("0", -11, -48, "left"), cap("1", -11, -16, "left"), cap("2", -11, 16, "left"), cap("3", -11, 48, "left")],
  attrs: [DELAY_ATTR, FAMILY_ATTR],
  bbox: { x1: -32, y1: -56, x2: 32, y2: 64 }, refdesPos: { x: 0, y: -62 }, valuePos: { x: 0, y: 70 },
});

SYMS.push(block({
  id: "decoder24", name: "2-to-4 decoder", kind: "decoder",
  left: [I("A0", -32), I("A1", -16), I("EN", 16, { optional: true })],
  right: [O("Y0", -32, { optional: true }), O("Y1", -16, { optional: true }), O("Y2", 0, { optional: true }), O("Y3", 16, { optional: true })],
  attrs: [DELAY_ATTR, { key: "outputs", label: "Outputs", kind: "choice", options: ["Active high", "Active low"], default: "Active high" }, FAMILY_ATTR],
  params: { delay: "time", outputs: "choice" },
}));
SYMS.push(block({
  id: "bcd7seg", name: "Hex to 7-segment decoder", kind: "bcd7",
  left: [I("A", -48), I("B", -32), I("C", -16), I("D", 0)],
  right: ["a", "b", "c", "d", "e", "f", "g"].map((s, i) => O(s, -48 + 16 * i, { optional: true })),
  attrs: [DELAY_ATTR, FAMILY_ATTR],
  params: { delay: "time" },
}));

// Display: segment inputs on the left, the digit itself inside the body.
{
  const segPins = ["a", "b", "c", "d", "e", "f", "g", "dp"].map((s, i) => I(s, -64 + 16 * i, { optional: true }));
  const glyph: SymbolPrimitive[] = SEG7_GLYPH.segs.map(([x1, y1, x2, y2]) => L(x1, y1, x2, y2));
  glyph.push(C(SEG7_GLYPH.dp.x, SEG7_GLYPH.dp.y, SEG7_GLYPH.dp.r));
  const d = block({
    id: "seg7", name: "7-segment display", kind: "seg7", left: segPins, right: [], x1: -32, x2: 40, margin: 12,
    attrs: [FAMILY_ATTR], extra: glyph,
  });
  // Pin captions would sit on the digit; the segment letters read from the pin names instead.
  d.captions = segPins.map((p) => cap(p.name, -27, p.row, "left"));
  SYMS.push(d);
}

// Logic analyzer: eight channels in, nothing out.
SYMS.push(block({
  id: "logic_analyzer", name: "Logic analyzer", kind: "analyzer",
  left: Array.from({ length: 8 }, (_, i) => I(`CH${i}`, -64 + 16 * i, { caption: String(i), optional: true })),
  right: [], x2: 0, margin: 12,
  attrs: [FAMILY_ATTR],
}));

// Converters: one analog side, one digital side.
SYMS.push(block({
  id: "adc4", name: "4-bit ADC", kind: "adc",
  left: [I("VIN", -32, { analog: true, caption: "IN" }), CLK(16, true)],
  right: [O("D0", -32, { optional: true }), O("D1", -16, { optional: true }), O("D2", 0, { optional: true }), O("D3", 16, { optional: true })],
  attrs: [{ key: "fullscale", label: "Full scale", unit: "V", kind: "value", default: "5" }, DELAY_ATTR, FAMILY_ATTR],
  params: { delay: "time" },
}));
SYMS.push(block({
  id: "dac4", name: "4-bit DAC", kind: "dac",
  left: [I("D0", -32), I("D1", -16), I("D2", 0), I("D3", 16)],
  right: [O("VOUT", -16, { analog: true, caption: "OUT" })],
  attrs: [{ key: "fullscale", label: "Full scale", unit: "V", kind: "value", default: "5" }, { key: "settle", label: "Settling", unit: "s", kind: "value", default: "100n" }, { key: "rout", label: "Output resistance", unit: "Ω", kind: "value", default: "1" }, FAMILY_ATTR],
}));

// Sources.
const SQUARE: SymbolPrimitive = P([{ x: -16, y: 6 }, { x: -10, y: 6 }, { x: -10, y: -6 }, { x: -2, y: -6 }, { x: -2, y: 6 }, { x: 6, y: 6 }, { x: 6, y: -6 }, { x: 10, y: -6 }], false);
DIGITAL_META.dclock = { kind: "clock", pins: { Y: outPin("Y") }, params: {} };
SYMS.push({
  id: "dclock", name: "Clock", prefix: "U",
  primitives: [BOX(-24, -16, 16, 16), SQUARE, L(16, 0, 32, 0)],
  pins: [{ name: "Y", pos: { x: 32, y: 0 }, spiceOrder: 1, electrical: "out" }],
  attrs: [
    { key: "freq", label: "Frequency", unit: "Hz", kind: "value", default: "1k" },
    { key: "duty", label: "Duty", unit: "%", kind: "value", default: "50" },
    { key: "delay", label: "Delay", unit: "s", kind: "value", default: "0" },
    FAMILY_ATTR,
  ],
  bbox: { x1: -24, y1: -16, x2: 32, y2: 16 }, refdesPos: { x: -4, y: -22 }, valuePos: { x: -4, y: 22 },
});
const BITS: SymbolPrimitive = P([{ x: -16, y: 6 }, { x: -12, y: 6 }, { x: -12, y: -6 }, { x: -4, y: -6 }, { x: -4, y: 6 }, { x: 2, y: 6 }, { x: 2, y: -6 }, { x: 6, y: -6 }, { x: 6, y: 6 }, { x: 10, y: 6 }], false);
DIGITAL_META.dpattern = { kind: "pattern", pins: { Y: outPin("Y") }, params: {} };
SYMS.push({
  id: "dpattern", name: "Bit pattern", prefix: "U",
  primitives: [BOX(-24, -16, 16, 16), BITS, L(16, 0, 32, 0)],
  pins: [{ name: "Y", pos: { x: 32, y: 0 }, spiceOrder: 1, electrical: "out" }],
  attrs: [
    { key: "bits", label: "Bits", kind: "text", default: "01101001" },
    { key: "step", label: "Bit time", unit: "s", kind: "value", default: "1m" },
    { key: "repeat", label: "Repeat", kind: "choice", options: ["Yes", "No"], default: "Yes" },
    { key: "delay", label: "Delay", unit: "s", kind: "value", default: "0" },
    FAMILY_ATTR,
  ],
  bbox: { x1: -24, y1: -16, x2: 32, y2: 16 }, refdesPos: { x: -4, y: -22 }, valuePos: { x: -4, y: 22 },
});
for (const [id, name, v] of [["logic_high", "Logic 1", 1], ["logic_low", "Logic 0", 0]] as const) {
  DIGITAL_META[id] = { kind: "const", pins: { Y: outPin("Y") }, params: {} };
  SYMS.push({
    // The "1" or "0" in the box is the whole label: a reference designator is kept for the
    // netlist but never printed (valueOnlyLabel with no value prints nothing).
    id, name, prefix: "U", valueOnlyLabel: true,
    primitives: [BOX(-16, -12, 12, 12), L(12, 0, 32, 0)],
    pins: [{ name: "Y", pos: { x: 32, y: 0 }, spiceOrder: 1, electrical: "out" }],
    captions: [cap(String(v), -2, 0, "center")],
    attrs: [],
    bbox: { x1: -16, y1: -12, x2: 32, y2: 12 },
  });
}

export const DIGITAL_SYMBOLS: Record<string, SymbolDef> = Object.fromEntries(SYMS.map((s) => [s.id, s]));

/** The analog gate family (components.ts). A `mode` of Digital makes them event-driven too;
 *  absent or Analog keeps the behavioural-source gate every existing design was built with. */
export const ANALOG_GATE_KIND: Record<string, string> = {
  gate_and: "and", gate_nand: "nand", gate_or: "or", gate_nor: "nor", gate_xor: "xor", gate_not: "not",
};

/** True when this placed part netlists into the digital kernel. */
export function isDigitalPart(c: { symbolId: string; attrs: Record<string, string> }): boolean {
  if (DIGITAL_META[c.symbolId]) return true;
  return !!ANALOG_GATE_KIND[c.symbolId] && /^digital$/i.test((c.attrs.mode ?? "").trim());
}

/** Kernel pin map of an analog-family gate switched to Digital mode. */
export function analogGateMeta(symbolId: string): DigitalSymbolMeta | null {
  const kind = ANALOG_GATE_KIND[symbolId];
  if (!kind) return null;
  return kind === "not"
    ? { kind, pins: { in: inPin("A"), out: outPin("Y") }, params: { delay: "time" } }
    : { kind, pins: { a: inPin("A"), b: inPin("B"), out: outPin("Y") }, params: { delay: "time" } };
}

/**
 * A transient length that shows a logic circuit working: sixteen periods of its slowest clock
 * and two passes of its longest bit pattern. Null when the sheet has neither source.
 */
export function digitalRunLength(comps: { symbolId: string; attrs: Record<string, string> }[]): string | null {
  let t = 0;
  for (const c of comps) {
    if (c.symbolId === "dclock") {
      const f = numeric(c.attrs.freq ?? "1k");
      const d = numeric(c.attrs.delay ?? "0");
      if (f > 0) t = Math.max(t, 16 / f + (d > 0 ? d : 0));
    } else if (c.symbolId === "dpattern") {
      const bits = (c.attrs.bits ?? "01101001").replace(/[^01xzXZ]/g, "").length;
      const step = numeric(c.attrs.step ?? "1m");
      const d = numeric(c.attrs.delay ?? "0");
      if (bits && step > 0) t = Math.max(t, 2 * bits * step + (d > 0 ? d : 0));
    }
  }
  if (!(t > 0)) return null;
  return String(Number(t.toPrecision(3)));
}

/** SPICE-suffixed number ("1k", "10u") without importing the units module into the symbol table. */
function numeric(raw: string): number {
  const m = /^\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*(meg|[tgkmunpf]|µ)?/i.exec(raw);
  if (!m) return NaN;
  const mult: Record<string, number> = { t: 1e12, g: 1e9, meg: 1e6, k: 1e3, m: 1e-3, u: 1e-6, "µ": 1e-6, n: 1e-9, p: 1e-12, f: 1e-15 };
  return parseFloat(m[1]) * (m[2] ? mult[m[2].toLowerCase()] ?? 1 : 1);
}
