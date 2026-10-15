/** Volt schematic data model. Grid coordinates are integers (canvas units); the snap grid is TOKENS.gridStep. */

export type GridPoint = { x: number; y: number };
export type Orientation = "R0" | "R90" | "R180" | "R270" | "MX" | "MY";
export const ORIENTATIONS: Orientation[] = ["R0", "R90", "R180", "R270", "MX", "MY"];

/** Apply an orientation to a symbol-local point. Symbol space is +x right, +y down. */
export function transformPoint(p: GridPoint, o: Orientation): GridPoint {
  switch (o) {
    case "R0": return { x: p.x, y: p.y };
    case "R90": return { x: -p.y, y: p.x };
    case "R180": return { x: -p.x, y: -p.y };
    case "R270": return { x: p.y, y: -p.x };
    case "MX": return { x: -p.x, y: p.y };   // mirror about the y-axis
    case "MY": return { x: p.x, y: -p.y };   // mirror about the x-axis
  }
}
export function rotateCW(o: Orientation): Orientation {
  const m: Record<Orientation, Orientation> = { R0: "R90", R90: "R180", R180: "R270", R270: "R0", MX: "R270", MY: "R90" };
  return m[o] ?? "R0";
}
export function mirrorX(o: Orientation): Orientation {
  // Pairings are INVOLUTIVE - applying mirrorX twice returns to the starting orientation. The
  // 6-element Orientation set can't fully represent the dihedral group D₄ (which has 8
  // reflections+rotations), so for rotated parts we pragmatically pair R90 ↔ R270 (mirror a
  // 90°-rotated part = rotate the OTHER way). Previous table had R180→MY but MY→R90, which
  // broke double-mirror identity.
  const m: Record<Orientation, Orientation> = { R0: "MX", MX: "R0", R180: "MY", MY: "R180", R90: "R270", R270: "R90" };
  return m[o] ?? "MX";
}

export type SymbolPrimitive =
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; wide?: boolean }
  | { kind: "rect"; x1: number; y1: number; x2: number; y2: number; radius?: number } // radius absent = capsule
  | { kind: "circle"; cx: number; cy: number; r: number; fill?: boolean }
  | { kind: "arc"; cx: number; cy: number; r: number; start: number; end: number } // degrees, CCW from +x
  | { kind: "poly"; pts: GridPoint[]; closed?: boolean; fill?: boolean };

export type ElectricalType = "in" | "out" | "bidir" | "passive" | "power_in" | "power_out" | "nc";

export interface SymbolPin {
  name: string;
  pos: GridPoint;            // symbol-local
  spiceOrder: number;        // 1-based order in the generated SPICE element line
  electrical?: ElectricalType;
}

export interface AttrDef {
  key: string;               // e.g. "value", "model"
  label: string;             // human label, e.g. "Value"
  unit?: string;             // e.g. "Ω", "F", "H", "V", "A"
  kind?: "value" | "text" | "model" | "expr" | "choice";
  default?: string;
  /** For kind "choice": the allowed values, shown as a segmented control or menu. */
  options?: string[];
}

/** Text drawn inside a symbol body (pin names on a block part). Never rotated. */
export interface SymbolCaption {
  text: string;
  x: number;
  y: number;
  align: "left" | "right" | "center";
  /** Draw a bar over the text (an active-low or inverted output, such as Q bar). */
  overbar?: boolean;
}

export interface SymbolDef {
  id: string;                // "res", "cap", "ind", "vsource", "isource", "gnd", "diode", "opamp", "vcvs", "vccs", "cccs", "ccvs", "swvc", "nmos", "pmos", "npn", "pnp"
  name: string;
  prefix: string;            // SPICE element letter: R C L V I D E G F H M Q S X
  primitives: SymbolPrimitive[];
  pins: SymbolPin[];
  attrs: AttrDef[];          // ordered: the first is the primary editable value
  bbox: { x1: number; y1: number; x2: number; y2: number };
  refdesPos?: GridPoint;     // symbol-local label anchor
  valuePos?: GridPoint;
  noRefdes?: boolean;        // e.g. GND
  /**
   * Draw the primary attribute and NOTHING else — no refdes line.
   *
   * A rail port IS its net name: "VCC" printed once beside the bar says everything the symbol
   * exists to say, and a "V3" stacked above it would be pure noise on the sheet. Distinct from
   * `noRefdes` (which suppresses the whole text block, as GND wants) because the name here is
   * the entire point of the part.
   */
  valueOnlyLabel?: boolean;
  /** Pin names and marks drawn inside the body (block parts: flip-flops, counters, displays). */
  captions?: SymbolCaption[];
  /** Pins that may stay unconnected without a warning (an unused enable, preset or clear). */
  optionalPins?: string[];
}

export interface ComponentInstance {
  id: string;
  symbolId: string;
  refdes: string;            // "R1", "C3", "V2", ""(for GND)
  pos: GridPoint;            // placement origin in sheet coords
  orient: Orientation;
  attrs: Record<string, string>;   // overrides; missing keys fall back to SymbolDef defaults
}

export interface Wire {
  id: string;
  pts: GridPoint[];          // polyline of ≥2 points, axis-aligned segments preferred
}

export interface Junction { id: string; pos: GridPoint; }

export interface NetLabel {
  id: string;
  pos: GridPoint;
  name: string;
  scope: "local" | "global";
  /** Which way the name reads from its connection point, away from the part it sits on.
   *  Absent means the classic up-and-right placement. */
  dir?: NetLabelDir;
}
export type NetLabelDir = "left" | "right" | "up" | "down";

/** Where a net label's text sits, in world units at zoom 1 (the canvas draws text at a fixed
 *  screen size, so this is exact at 100 % and a close keep-out everywhere else). */
export function netLabelTextRect(l: { pos: GridPoint; name: string; dir?: NetLabelDir }): { x1: number; y1: number; x2: number; y2: number } {
  const w = Math.max(12, (l.name || "NET").length * 7), h = 12;
  const { x, y } = l.pos;
  switch (l.dir) {
    case "left": return { x1: x - 6 - w, y1: y - 4 - h, x2: x - 6, y2: y - 4 };
    case "up": return { x1: x - w / 2, y1: y - 6 - h, x2: x + w / 2, y2: y - 6 };
    case "down": return { x1: x - w / 2, y1: y + 6, x2: x + w / 2, y2: y + 6 + h };
    default: return { x1: x + 6, y1: y - 4 - h, x2: x + 6 + w, y2: y - 4 };
  }
}

export interface SimDirective {
  id: string;
  text: string;              // raw SPICE directive: ".op", ".tran 1m", ".dc V1 0 5 0.01", ".ac dec 100 1 1Meg", ".param ..."
  enabled: boolean;
}

export interface Sheet {
  id: string;
  name: string;
  components: Record<string, ComponentInstance>;
  wires: Record<string, Wire>;
  junctions: Record<string, Junction>;
  netLabels: Record<string, NetLabel>;
}

export interface SchematicDoc {
  v: number;                 // schema version
  id: string;
  name: string;
  rootSheet: string;
  sheets: Record<string, Sheet>;
  directives: SimDirective[];
  models: string[];          // raw .model / .subckt text blocks
  params: Record<string, string>;
  createdAt: number;
  updatedAt: number;
  ownerUid?: string;
}

/**
 * Generate a cryptographically-random doc ID (~128 bits of entropy).
 *
 * SECURITY: firestore.rules treats designIds as access tokens - anyone who knows a designId
 * can self-add as a member. The previous implementation (Date.now() + 5 base-36 chars) gave
 * only ~26 bits + a guessable timestamp, which would let an attacker brute-force any design's
 * ID within feasible time. This uses crypto.getRandomValues - 16 bytes = 128 bits - so the
 * rules' "designIds are unguessable" assumption actually holds. Safe in both browser
 * (window.crypto) and Node 19+ / Bun / Deno (globalThis.crypto).
 */
export function makeDocId(): string {
  const bytes = new Uint8Array(16);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) {
    c.getRandomValues(bytes);
  } else {
    // Last-resort fallback for ancient runtimes - should never run in production.
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let hex = "";
  for (let i = 0; i < 16; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return `doc_${hex}`;
}

export function emptyDoc(name = "untitled"): SchematicDoc {
  const sheetId = "sheet1";
  const now = Date.now();
  return {
    v: 1,
    id: makeDocId(),
    name,
    rootSheet: sheetId,
    sheets: { [sheetId]: { id: sheetId, name: "Top", components: {}, wires: {}, junctions: {}, netLabels: {} } },
    directives: [{ id: "d1", text: ".op", enabled: true }],
    models: [],
    params: {},
    createdAt: now,
    updatedAt: now,
  };
}

let _id = 0;
export const uid = (p = "id") => `${p}_${(_id++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

/** World position of a component's i-th pin (sheet coords). */
export function pinWorldPos(c: ComponentInstance, sym: SymbolDef, pinIndex: number): GridPoint {
  const pin = sym.pins[pinIndex];
  const t = transformPoint(pin.pos, c.orient);
  return { x: c.pos.x + t.x, y: c.pos.y + t.y };
}
