import { SchematicDoc, Sheet, GridPoint, Orientation, transformPoint } from "./types";
import { SYMBOLS } from "./components";

/**
 * Connectivity-guaranteed example builder: place components, then route wires *between actual pins*
 * (referenced by component ref + pin index), so a coordinate never drifts off a pin.
 */
type Place = { sym: string; ref: string; pos: GridPoint; o?: Orientation; attrs?: Record<string, string>; label?: "right" | "left" | "above" | "below" };
type Conn = [string, number, string, number]; // [refA, pinIdxA, refB, pinIdxB]  - a wire from pin to pin
type Lab = [string, number, string] | { at: GridPoint; name: string }; // a label on a pin, or at a point on a wire

function pinPos(p: Place, pinIdx: number): GridPoint {
  const sym = SYMBOLS[p.sym];
  const pin = sym.pins[pinIdx];
  const t = transformPoint(pin.pos, p.o ?? "R0");
  return { x: p.pos.x + t.x, y: p.pos.y + t.y };
}
function route(a: GridPoint, b: GridPoint): GridPoint[] {
  if (a.x === b.x || a.y === b.y) return [a, b];
  return [a, { x: a.x, y: b.y }, b]; // vertical then horizontal
}

function buildDoc(key: string, name: string, places: Place[], conns: Conn[], labels: Lab[], dirs: string[]): SchematicDoc {
  const now = Date.now();
  const byRef = new Map(places.map((p) => [p.ref, p]));
  const sheet: Sheet = { id: "s1", name: "Top", components: {}, wires: {}, junctions: {}, netLabels: {} };
  places.forEach((p, i) => {
    const id = `c${i}`;
    sheet.components[id] = { id, symbolId: p.sym, refdes: p.ref, pos: p.pos, orient: p.o ?? "R0", attrs: p.attrs ?? {}, ...(p.label ? { labelAnchor: p.label } : {}) };
  });
  conns.forEach(([ra, pa, rb, pb], i) => {
    const A = byRef.get(ra)!, B = byRef.get(rb)!;
    const id = `w${i}`;
    sheet.wires[id] = { id, pts: route(pinPos(A, pa), pinPos(B, pb)) };
  });
  labels.forEach((l, i) => {
    const id = `nl${i}`;
    const pos = Array.isArray(l) ? pinPos(byRef.get(l[0])!, l[1]) : l.at;
    sheet.netLabels[id] = { id, pos, name: Array.isArray(l) ? l[2] : l.name, scope: "local" };
  });
  return {
    v: 1, id: `doc_${key}`, name, rootSheet: "s1", sheets: { s1: sheet },
    directives: dirs.map((t, k) => ({ id: `d${k}`, text: t, enabled: true })),
    models: [], params: {}, createdAt: now, updatedAt: now,
  };
}

// ─── voltage divider ───────────────────────────────────────────────────────
const divider = buildDoc("divider", "voltage-divider",
  [
    { sym: "vsource", ref: "V1", pos: { x: 304, y: 320 }, attrs: { value: "5" } },
    { sym: "res", ref: "R1", pos: { x: 480, y: 272 }, attrs: { value: "10k" } },
    { sym: "res", ref: "R2", pos: { x: 480, y: 400 }, attrs: { value: "10k" } },
    { sym: "gnd", ref: "GND1", pos: { x: 304, y: 416 } },
    { sym: "gnd", ref: "GND2", pos: { x: 480, y: 480 } },
  ],
  [
    ["V1", 0, "R1", 0],   // V1+ → R1.top  (VIN)
    ["R1", 1, "R2", 0],   // R1.bot → R2.top (OUT)
    ["V1", 1, "GND1", 0], // V1− → GND
    ["R2", 1, "GND2", 0], // R2.bot → GND
  ],
  [["V1", 0, "VIN"], ["R1", 1, "OUT"]],
  [".op"]
);

// ─── RC low-pass filter ────────────────────────────────────────────────────
// V1 - R1 - OUT - C1 - GND ;  fc = 1/(2π·R·C) ≈ 1 kHz with 1.6 kΩ + 100 nF
const rc = buildDoc("rc", "rc-lowpass",
  [
    { sym: "vsource", ref: "V1", pos: { x: 256, y: 320 }, attrs: { value: "SIN(0 1 1000) AC 1" } },
    { sym: "res", ref: "R1", pos: { x: 432, y: 240 }, o: "R90", attrs: { value: "1.6k" } }, // horizontal: pin0 at +32, pin1 at −32
    { sym: "cap", ref: "C1", pos: { x: 528, y: 320 }, attrs: { value: "100n" } },
    { sym: "gnd", ref: "GND1", pos: { x: 256, y: 416 } },
    { sym: "gnd", ref: "GND2", pos: { x: 528, y: 432 } },
  ],
  [
    ["V1", 0, "R1", 1],   // V1+ → R1.left  (VIN)
    ["R1", 0, "C1", 0],   // R1.right → C1.top (OUT)
    ["V1", 1, "GND1", 0],
    ["C1", 1, "GND2", 0],
  ],
  [["V1", 0, "VIN"], ["C1", 0, "OUT"]],
  [".tran 5m", ".ac dec 60 1 100k"]
);

// ─── half-wave rectifier ───────────────────────────────────────────────────
const rect = buildDoc("rect", "half-wave-rectifier",
  [
    { sym: "vsource", ref: "V1", pos: { x: 256, y: 320 }, attrs: { value: "SIN(0 5 60)" } },
    // R270, NOT R90. R90 puts the ANODE on the right (+32) and the cathode on the left (-32),
    // so the wire arriving from V1 on the left reached the CATHODE first and ran straight through
    // it to the anode - the netlister correctly treats a pin lying on a wire segment as connected,
    // so D1's two terminals landed on one net and the whole example was electrically a short
    // (buildNetlist returned a single node, and the diode card read `Dd1 vin vin d_0`).
    // R270 faces the anode left, toward the source, which is also how anyone would draw it.
    { sym: "diode", ref: "D1", pos: { x: 432, y: 240 }, o: "R270", attrs: { model: "D" } }, // pin0=A at −32, pin1=K at +32
    { sym: "res", ref: "R1", pos: { x: 528, y: 320 }, attrs: { value: "1k" } },
    { sym: "gnd", ref: "GND1", pos: { x: 256, y: 416 } },
    { sym: "gnd", ref: "GND2", pos: { x: 528, y: 432 } },
  ],
  [
    ["V1", 0, "D1", 0],   // V1+ → D1 anode
    ["D1", 1, "R1", 0],   // D1 cathode → R1.top (OUT)
    ["V1", 1, "GND1", 0],
    ["R1", 1, "GND2", 0],
  ],
  [["V1", 0, "VIN"], ["R1", 0, "OUT"]],
  [".tran 50m"]
);

// ─── inverting op-amp amplifier (gain ≈ −10) ───────────────────────────────
const invamp = buildDoc("invamp", "inverting-amplifier",
  [
    { sym: "vsource", ref: "V1", pos: { x: 192, y: 320 }, attrs: { value: "SIN(0 0.2 1000) AC 1" } },
    { sym: "res", ref: "Rin", pos: { x: 336, y: 256 }, o: "R90", attrs: { value: "10k" } },  // pin0 +32, pin1 −32
    { sym: "res", ref: "Rf", pos: { x: 480, y: 176 }, o: "R90", attrs: { value: "100k" } },
    // Mirrored so in− sits on top: the feedback path and the grounded in+ then never share a wire.
    { sym: "opamp", ref: "U1", pos: { x: 448, y: 256 }, o: "MY", attrs: { gain: "200k" } },
    { sym: "gnd", ref: "GND1", pos: { x: 192, y: 416 } },
    { sym: "gnd", ref: "GND2", pos: { x: 384, y: 352 } },
  ],
  [
    ["V1", 0, "Rin", 1],   // V1+ → Rin.left (VIN)
    ["Rin", 0, "U1", 1],   // Rin.right → op-amp in−  (VM)
    ["Rin", 0, "Rf", 1],   // VM → Rf.left, rising from the Rin end (clear of both op-amp inputs)
    ["Rf", 0, "U1", 2],    // Rf.right → op-amp out (OUT)
    ["U1", 0, "GND2", 0],  // op-amp in+ → GND
    ["V1", 1, "GND1", 0],
  ],
  [["V1", 0, "VIN"], ["U1", 1, "VM"], ["U1", 2, "OUT"]],
  [".tran 5m", ".ac dec 60 1 1Meg"]
);

// ─── Schmitt oscillator counted on a 7-segment display (mixed signal) ─────────
// The RC (10 kΩ, 100 nF) charges between the Schmitt thresholds through the inverter's own
// output, so the analog node CAP and the logic net OUT form one loop through the bridges; the
// counter, decoder and display are pure logic. Scrub the waveform cursor to watch the digit.
const counterDisplay = buildDoc("counter_display", "oscillator-counter-display",
  [
    { sym: "logic_schmitt", ref: "U1", pos: { x: 240, y: 256 } },
    { sym: "res", ref: "R1", pos: { x: 240, y: 160 }, o: "R90", attrs: { value: "10k" } },   // pin0 → (272,160), pin1 → (208,160)
    { sym: "cap", ref: "C1", pos: { x: 176, y: 320 }, attrs: { value: "100n" } },
    { sym: "gnd", ref: "GND1", pos: { x: 176, y: 384 } },
    // Rows line up so every connection after the oscillator is one straight wire:
    // OUT → CLK at y 256, Q0..Q3 → A..D at y 256..304, a..g → the display at y 256..352.
    { sym: "counter4", ref: "U2", pos: { x: 448, y: 288 }, label: "above" },
    { sym: "bcd7seg", ref: "U3", pos: { x: 656, y: 304 }, label: "above" },
    { sym: "seg7", ref: "DS1", pos: { x: 832, y: 320 } },
  ],
  [
    ["R1", 0, "U1", 1],   // R1 → inverter output (OUT)
    ["R1", 1, "U1", 0],   // R1 → inverter input (CAP)
    ["C1", 0, "U1", 0],   // C1 → CAP
    ["C1", 1, "GND1", 0],
    ["U1", 1, "U2", 0],   // OUT → counter clock
    ["U2", 3, "U3", 0], ["U2", 4, "U3", 1], ["U2", 5, "U3", 2], ["U2", 6, "U3", 3],
    ["U3", 4, "DS1", 0], ["U3", 5, "DS1", 1], ["U3", 6, "DS1", 2], ["U3", 7, "DS1", 3],
    ["U3", 8, "DS1", 4], ["U3", 9, "DS1", 5], ["U3", 10, "DS1", 6],
  ],
  [
    { at: { x: 336, y: 256 }, name: "OUT" }, { at: { x: 176, y: 256 }, name: "CAP" },
    { at: { x: 528, y: 256 }, name: "Q0" }, { at: { x: 528, y: 272 }, name: "Q1" },
    { at: { x: 528, y: 288 }, name: "Q2" }, { at: { x: 528, y: 304 }, name: "Q3" },
  ],
  [".tran 20m"]
);

export const EXAMPLES: Record<string, SchematicDoc> = {
  "voltage-divider": divider,
  "rc-lowpass": rc,
  "half-wave-rectifier": rect,
  "inverting-amplifier": invamp,
  "oscillator-counter-display": counterDisplay,
};
export const DEFAULT_EXAMPLE = "rc-lowpass";

/** A fresh deep copy (originals are templates). */
export function exampleDoc(key: string): SchematicDoc {
  const d = EXAMPLES[key] ?? EXAMPLES[DEFAULT_EXAMPLE];
  return typeof structuredClone === "function" ? structuredClone(d) : JSON.parse(JSON.stringify(d));
}
