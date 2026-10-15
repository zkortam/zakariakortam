import { SchematicDoc, GridPoint, ComponentInstance, pinWorldPos } from "./types";
import { SYMBOLS, DEFAULT_MODELS } from "./components";
import { Netlist, NetlistElement, Analysis, SimError, TransientSource, ACSpec, SimOptions, StepSpec, StepMode, ParamBinding, DEFAULT_OPTIONS } from "../sim/types";
import { parseValue } from "../units";
import { parseSubckts, expandSubckts } from "../sim/subckt";
import { compileExpr } from "../sim/bsource";
import { parseModels, resolveDiode, resolveMos, resolveBjt, resolveSwitch, resolveVdmos, resolveJfet, type ModelRegistry } from "../sim/model_parser";
import type { DigitalDesign } from "../sim/types";
import { isDigitalPart } from "./digital_parts";
import { buildDigitalDesign, analogNodesOf, type DigitalComp } from "./digital_netlist";

const keyOf = (p: GridPoint) => `${Math.round(p.x)},${Math.round(p.y)}`;

class UF {
  parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) { this.parent.set(x, x); return x; }
    let r = x; while (this.parent.get(r) !== r) r = this.parent.get(r)!;
    let c = x; while (this.parent.get(c) !== r) { const n = this.parent.get(c)!; this.parent.set(c, r); c = n; }
    return r;
  }
  union(a: string, b: string) { const ra = this.find(a), rb = this.find(b); if (ra !== rb) this.parent.set(ra, rb); }
}

function onSegment(p: GridPoint, a: GridPoint, b: GridPoint): boolean {
  const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  // DEGENERATE SEGMENT. A zero-length wire (both endpoints on the same grid point - trivially
  // produced by a click-click with no drag) is a POINT, not a line, and only the point itself
  // lies on it. Falling through to the collinearity test instead was catastrophic: cross = 0 and
  // dot = 0 for EVERY p, and the final test became 0 <= 0.5, so every point in the sheet tested
  // "on segment". The union-find then merged every net in the schematic into one, silently
  // shorting the entire circuit.
  if (len2 <= 0.25) return Math.abs(p.x - a.x) <= 0.5 && Math.abs(p.y - a.y) <= 0.5;
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  if (Math.abs(cross) > 0.5) return false;
  const dot = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y);
  if (dot < -0.5) return false;
  return dot <= len2 + 0.5;
}

interface PinRef { compId: string; pinIndex: number; spiceOrder: number; pos: GridPoint; }

/** Compute electrical nets; return a map: pointKey -> root, plus name assignment helpers. */
function computeNets(doc: SchematicDoc) {
  const sheet = doc.sheets[doc.rootSheet];
  const uf = new UF();
  const wires = Object.values(sheet.wires);
  const labels = Object.values(sheet.netLabels);
  const juncs = Object.values(sheet.junctions);

  // 1) each wire polyline is one net: union all its vertices + a wire token
  wires.forEach((w, wi) => {
    const tok = `wire:${w.id ?? wi}`;
    for (const v of w.pts) uf.union(keyOf(v), tok);
  });
  // 2) pin points / label points / junction points that lie on a wire segment join that wire.
  // Snap pin world positions to the same grid wires use - op-amp and (after rotation) other
  // symbols can have pins on half-grid coords (e.g. y=±12); without snap-alignment here, the
  // wire endpoint (snapped to y=±16) and the pin coord (y=±12) don't match, so onSegment never
  // recognizes the pin as connected and the op-amp simulates as floating.
  const allExtraPts: { key: string; pos: GridPoint }[] = [];
  const pins: PinRef[] = [];
  const snap = (v: number) => Math.round(v / 16) * 16;
  const snapPt = (p: GridPoint): GridPoint => ({ x: snap(p.x), y: snap(p.y) });
  for (const c of Object.values(sheet.components)) {
    const sym = SYMBOLS[c.symbolId]; if (!sym) continue;
    sym.pins.forEach((pin, i) => {
      const wp = snapPt(pinWorldPos(c, sym, i));
      pins.push({ compId: c.id, pinIndex: i, spiceOrder: pin.spiceOrder, pos: wp });
      allExtraPts.push({ key: keyOf(wp), pos: wp });
    });
  }
  for (const l of labels) allExtraPts.push({ key: keyOf(l.pos), pos: l.pos });
  for (const j of juncs) allExtraPts.push({ key: keyOf(j.pos), pos: j.pos });
  for (const ep of allExtraPts) {
    uf.find(ep.key); // ensure node exists
    for (const w of wires) {
      for (let i = 0; i < w.pts.length - 1; i++) {
        if (onSegment(ep.pos, w.pts[i], w.pts[i + 1])) { uf.union(ep.key, `wire:${w.id}`); break; }
      }
    }
  }
  // 3) junctions merge any wires/points they touch
  for (const j of juncs) {
    const touched: string[] = [keyOf(j.pos)];
    for (const w of wires) for (let i = 0; i < w.pts.length - 1; i++) if (onSegment(j.pos, w.pts[i], w.pts[i + 1])) { touched.push(`wire:${w.id}`); break; }
    for (let i = 1; i < touched.length; i++) uf.union(touched[0], touched[i]);
  }
  // 4) IMPLICIT TAPS - a wire vertex (endpoint or corner) that sits strictly on ANOTHER wire's
  //    segment is an electrical connection even without an explicit junction dot. Without this,
  //    a user-drawn wire whose endpoint lands on an existing wire's interior LOOKS connected on
  //    screen but the simulator sees the two wires as separate nets. We tap them into the same
  //    net here, mirroring how a junction dot would merge them.
  for (const w of wires) {
    for (const v of w.pts) {
      const vKey = keyOf(v);
      for (const ow of wires) {
        if (ow.id === w.id) continue;
        for (let i = 0; i < ow.pts.length - 1; i++) {
          if (onSegment(v, ow.pts[i], ow.pts[i + 1])) {
            uf.union(vKey, `wire:${ow.id}`);
            break;
          }
        }
      }
    }
  }

  // name assignment: gnd pins -> "0"; net labels -> their name; else N001...
  const nameOf = new Map<string, string>(); // root -> name
  const conflicts: SimError[] = [];
  // ground first - snap so the key matches the (also-snapped) entry we put in allExtraPts.
  for (const c of Object.values(sheet.components)) {
    if (c.symbolId !== "gnd") continue; const sym = SYMBOLS[c.symbolId]!; const wp = snapPt(pinWorldPos(c, sym, 0));
    nameOf.set(uf.find(keyOf(wp)), "0");
  }
  // Supply-rail ports name their net exactly like a global net label would. Resolved AFTER
  // ground so that a rail accidentally shorted to GND keeps "0" (and says so) rather than
  // renaming the reference node out from under the whole matrix.
  for (const c of Object.values(sheet.components)) {
    if (c.symbolId !== "rail") continue;
    const sym = SYMBOLS[c.symbolId]!;
    const r = uf.find(keyOf(snapPt(pinWorldPos(c, sym, 0))));
    const want = (c.attrs?.name ?? "").trim() || "VCC";
    const existing = nameOf.get(r);
    if (!existing) nameOf.set(r, want);
    else if (existing === "0") conflicts.push({ severity: "error", message: `Supply rail "${want}" is wired directly to ground.`, location: c.refdes || c.id, hint: "Remove the ground on that net, or point the rail at a different node." });
    else if (existing !== want) conflicts.push({ severity: "warning", message: `Net has conflicting names "${existing}" and "${want}"; using "${existing}".`, location: c.refdes || c.id });
  }
  for (const l of labels) {
    const r = uf.find(keyOf(l.pos));
    const existing = nameOf.get(r);
    if (existing && existing !== l.name && existing !== "0") conflicts.push({ severity: "warning", message: `Net has conflicting labels "${existing}" and "${l.name}"; using "${existing}".`, location: `label ${l.id}` });
    if (!existing || existing === "0") { if (!existing) nameOf.set(r, l.name); } // don't override ground
    else if (!nameOf.has(r)) nameOf.set(r, l.name);
  }

  // collect all roots that have at least one pin (and how many pins each touches)
  const pinRoot = new Map<string, string>(); // "compId#pinIndex" -> root
  const seenRoots = new Set<string>();
  const rootPinCount = new Map<string, number>();
  for (const p of pins) { const r = uf.find(keyOf(p.pos)); pinRoot.set(`${p.compId}#${p.pinIndex}`, r); seenRoots.add(r); rootPinCount.set(r, (rootPinCount.get(r) ?? 0) + 1); }

  // if no node "0" exists, designate a reference automatically so the matrix isn't singular -
  // prefer a voltage/current source's "-" terminal, else the most-connected node.
  if (![...nameOf.values()].includes("0") && seenRoots.size > 0) {
    let refRoot: string | null = null;
    for (const c of Object.values(sheet.components)) {
      if (c.symbolId !== "vsource" && c.symbolId !== "isource") continue;
      const sym = SYMBOLS[c.symbolId]; if (!sym) continue;
      let negIdx = sym.pins.findIndex((p) => p.name === "-");
      if (negIdx < 0) negIdx = sym.pins.length - 1;
      const r = pinRoot.get(`${c.id}#${negIdx}`);
      if (r && (rootPinCount.get(r) ?? 0) >= 2) { refRoot = r; break; } // only a real node, not a dangling pin
    }
    // Most-connected node, counting ANALOG pins only: a logic-only sheet has no reference to
    // pick (the digital kernel needs none), and electing one of its nets as "0" would tie that
    // net to 0 V through a bridge.
    if (!refRoot) {
      const analogCount = new Map<string, number>();
      for (const p of pins) {
        const comp = sheet.components[p.compId];
        if (!comp || isDigitalPart(comp)) continue;
        const r = uf.find(keyOf(p.pos));
        analogCount.set(r, (analogCount.get(r) ?? 0) + 1);
      }
      let best = -1; for (const [r, n] of analogCount) if (n > best) { best = n; refRoot = r; }
    }
    if (refRoot) { nameOf.set(refRoot, "0"); conflicts.push({ severity: "warning", message: "No ground symbol - using the most-connected node as the 0 V reference. Add a Ground for explicit control." }); }
  }

  // Anonymous names for the rest. These must not COLLIDE with a name the user already used:
  // downstream the netlist identifies nodes by NAME, so handing two electrically separate roots
  // the same string merges them into one node in the matrix. A user who labels a net "N002" (an
  // entirely reasonable thing to do, and exactly what our own SPICE import produces) would find
  // it silently shorted to whichever unlabelled net the counter happened to land on.
  // Comparison is case-insensitive because node names are matched case-insensitively downstream.
  const taken = new Set<string>();
  for (const n of nameOf.values()) taken.add(n.toUpperCase());
  let anon = 0;
  const ordered = [...seenRoots].sort();
  for (const r of ordered) {
    if (nameOf.has(r)) continue;
    let name: string;
    do { anon++; name = `N${String(anon).padStart(3, "0")}`; } while (taken.has(name));
    taken.add(name);
    nameOf.set(r, name);
  }

  return { uf, nameOf, pinRoot, pins, conflicts };
}

// ---------- source value parsing ----------
function parseSourceSpec(spec: string): { dc: number; ac?: ACSpec; tran?: TransientSource } {
  const s = (spec || "").trim();
  if (s === "") return { dc: 0 };
  let dc = 0, ac: ACSpec | undefined, tran: TransientSource | undefined;
  // function call?
  const fm = s.match(/(SIN|PULSE|PWL|EXP|SFFM|AM)\s*\(([^)]*)\)/i);
  if (fm) {
    const fn = fm[1].toUpperCase();
    const args = fm[2].trim().split(/[\s,]+/).filter(Boolean).map((t) => parseValue(t));
    if (fn === "SIN") {
      const [voff = 0, vamp = 0, freq = 1000, td = 0, theta = 0, phase = 0] = args;
      // Damping factor: negative theta grows unbounded - clamp to 0 (no damping).
      tran = { kind: "sin", voff, vamp, freq, td, theta: Math.max(theta, 0), phase };
      dc = voff;
    }
    else if (fn === "PULSE") {
      const [v1 = 0, v2 = 0, td = 0, tr = 0, tf = 0, pw = 0, per = 0, ncycles] = args;
      // Sanity-clamp: rise+pulse+fall must fit inside the period (else cycles overlap themselves).
      let trC = Math.max(tr, 0), tfC = Math.max(tf, 0), pwC = Math.max(pw, 0);
      if (per > 0 && (trC + pwC + tfC) > per) {
        // Scale the on-time pieces proportionally to fit; idle time becomes 0.
        const scale = per / (trC + pwC + tfC);
        trC *= scale; pwC *= scale; tfC *= scale;
      }
      tran = { kind: "pulse", v1, v2, td: Math.max(td, 0), tr: trC, tf: tfC, pw: pwC, per: Math.max(per, 0), ncycles };
      dc = v1;
    }
    else if (fn === "EXP") { const [v1 = 0, v2 = 0, td1 = 0, tau1 = 0, td2 = 0, tau2 = 0] = args; tran = { kind: "exp", v1, v2, td1, tau1, td2, tau2 }; dc = v1; }
    else if (fn === "PWL") {
      const pts: [number, number][] = [];
      for (let i = 0; i + 1 < args.length; i += 2) pts.push([args[i], args[i + 1]]);
      // Sort by time so a sloppy user spec doesn't break the interpolator.
      pts.sort((a, b) => a[0] - b[0]);
      tran = { kind: "pwl", points: pts };
      dc = pts[0]?.[1] ?? 0;
    }
    else if (fn === "SFFM") { const [voff = 0, vamp = 0, fc = 1000, mdi = 0, fs = 100] = args; tran = { kind: "sffm", voff, vamp, fc, mdi, fs }; dc = voff; }
    else if (fn === "AM") { const [vamp = 1, voff = 0, fm2 = 100, fc = 1000, td = 0] = args; tran = { kind: "am", vamp, voff, fm: fm2, fc, td }; dc = 0; }
  }
  // tokens outside the function
  const rest = s.replace(/(SIN|PULSE|PWL|EXP|SFFM|AM)\s*\([^)]*\)/i, " ").trim();
  const toks = rest.split(/\s+/).filter(Boolean);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i].toUpperCase();
    if (t === "DC") { const v = parseValue(toks[i + 1]); if (isFinite(v)) { dc = v; i++; } }
    else if (t === "AC") { const m = parseValue(toks[i + 1]); const ph = parseValue(toks[i + 2]); ac = { mag: isFinite(m) ? m : 1, phase: isFinite(ph) ? ph : 0 }; i += isFinite(ph) ? 2 : isFinite(m) ? 1 : 0; }
    else {
      // BUG fix: previously this stripped trailing letters via `replace(/[a-z%]+$/i, "")`
      // before calling parseValue, which obliterated SI prefixes - "5m" became "5" (→ 5 V
      // instead of 5 mV). parseValue already handles SI suffixes correctly, so we trust it
      // directly. If a user types a bare unit like "5V", parseValue gracefully returns 5
      // (the V is treated as a unit identifier and ignored), which is what we want.
      const v = parseValue(toks[i]);
      if (isFinite(v) && !tran) dc = v;
    }
  }
  return { dc, ac, tran };
}

/** Read a numeric attribute, falling back to a default. */
function num(c: ComponentInstance, key: string, fallback: number): number {
  const raw = (c.attrs[key] ?? "").trim();
  if (!raw) return fallback;
  const v = parseValue(raw);
  return isFinite(v) ? v : fallback;
}

/** Parsed `.step` / `.temp` sweep axis. Re-exported from the sim types so existing importers
 *  of `StepSpec` from this module keep working. */
export type { StepSpec } from "../sim/types";

/** `.param NAME=VALUE [NAME2=VALUE2 …]` from the directives pane.
 *
 *  Values may be a numeric literal or a reference to another param (one level, cycle-guarded).
 *  We deliberately do NOT evaluate arithmetic here: silently mis-evaluating `2*R` would be worse
 *  than refusing it, and the caller surfaces an explicit warning for anything unresolved. */
function parseParamDirectives(doc: SchematicDoc, errors: SimError[]): Map<string, number> {
  const raw = new Map<string, string>();   // UPPERCASE name -> literal text
  for (const d of doc.directives) {
    if (!d.enabled) continue;
    const line = d.text.trim();
    if (!/^\.param\b/i.test(line)) continue;
    const body = line.replace(/^\.param\b/i, "").replace(/=/g, " = ");
    const toks = body.split(/\s+/).filter(Boolean);
    for (let i = 0; i + 2 < toks.length; i++) {
      if (toks[i + 1] !== "=") continue;
      raw.set(toks[i].toUpperCase(), toks[i + 2].replace(/[{}]/g, ""));
      i += 2;
    }
  }
  const out = new Map<string, number>();
  const resolve = (text: string, seen: Set<string>): number => {
    const v = parseValue(text);
    if (isFinite(v)) return v;
    const key = text.trim().toUpperCase();
    if (raw.has(key) && !seen.has(key)) { seen.add(key); return resolve(raw.get(key)!, seen); }
    return NaN;
  };
  for (const [k, text] of raw) {
    const v = resolve(text, new Set([k]));
    if (isFinite(v)) out.set(k, v);
    else errors.push({ severity: "warning", message: `.param ${k}: cannot resolve "${text}" to a number (numeric literals and one level of param→param reference are supported; arithmetic is not).` });
  }
  return out;
}

/** Expand a sweep specification into an explicit list of values.
 *  `lin` walks by `inc`; `dec`/`oct` place `inc` points per decade/octave; `list` is verbatim.
 *  Returns [] (never a partial or fabricated grid) when the spec is unusable. */
function expandSweep(mode: StepMode, start: number, stop: number, inc: number, list: number[]): number[] {
  const MAX = 1024;                     // hard bound; the engine caps the simulated total again
  if (mode === "list") return list.filter(isFinite).slice(0, MAX);
  if (!isFinite(start) || !isFinite(stop) || !isFinite(inc)) return [];
  const vals: number[] = [];
  if (mode === "lin") {
    if (inc <= 0 || stop < start) return [];
    for (let v = start; v <= stop + inc * 1e-9 && vals.length < MAX; v += inc) vals.push(parseFloat(v.toPrecision(12)));
  } else {
    // Logarithmic axes are undefined at or below zero - refuse rather than silently clamp.
    if (start <= 0 || stop < start || inc < 1) return [];
    const ratio = mode === "dec" ? 10 : 2;
    const mul = Math.pow(ratio, 1 / Math.round(inc));
    for (let v = start; v <= stop * (1 + 1e-9) && vals.length < MAX; v *= mul) vals.push(parseFloat(v.toPrecision(12)));
    if (vals.length > 0 && vals[vals.length - 1] < stop * (1 - 1e-9) && vals.length < MAX) vals.push(stop);
  }
  return vals;
}

const mkStep = (what: StepSpec["what"], refdes: string, mode: StepMode, values: number[]): StepSpec => ({
  what, refdes, mode, values,
  start: values[0] ?? NaN,
  stop: values[values.length - 1] ?? NaN,
  // The legacy linear triple. For list/log axes there is no single increment; report the mean
  // spacing so a consumer that reads `.step` still gets a self-consistent (start, stop, step).
  step: values.length > 1 ? (values[values.length - 1] - values[0]) / (values.length - 1) : 0,
});

// ---------- directive parsing ----------
function parseDirectives(doc: SchematicDoc, params: Map<string, number>): {
  analyses: Analysis[];
  errors: SimError[];
  options: Partial<SimOptions>;
  ics: { node: string; value: number }[];
  nodesets: { node: string; value: number }[];
  steps: StepSpec[];
} {
  const analyses: Analysis[] = []; const errors: SimError[] = [];
  const options: Partial<SimOptions> = {};
  const ics: { node: string; value: number }[] = [];
  const nodesets: { node: string; value: number }[] = [];
  const steps: StepSpec[] = [];
  let tempAxis: StepSpec | undefined;
  for (const d of doc.directives) {
    if (!d.enabled) continue;
    const line = d.text.trim();
    const low = line.toLowerCase();
    // `.op` must be matched on a WORD boundary: ".options …" also starts with ".op", so the
    // previous prefix test swallowed every .options line - it pushed a bogus operating-point
    // analysis and the user's gmin/reltol/temp overrides were silently dropped on the floor.
    // A convergence knob that does nothing is exactly the kind of silent wrongness this
    // simulator must not ship (the agent's own repair prompt tells users to add .options gmin=…).
    if (/^\.op(\s|$)/i.test(low)) analyses.push({ kind: "op" });
    else if (low.startsWith(".tran")) {
      const toks = line.split(/\s+/).slice(1).filter(t => !/uic/i.test(t));
      const uic = /\buic\b/i.test(line);
      const nums = toks.map((t) => parseValue(t)).filter(isFinite);
      if (nums.length === 1) analyses.push({ kind: "tran", tstep: nums[0] / 1000, tstop: nums[0], tstart: 0, uic });
      else if (nums.length >= 2) analyses.push({ kind: "tran", tstep: nums[0], tstop: nums[1], tstart: nums[2] ?? 0, dtmax: nums[3], uic });
      else errors.push({ severity: "warning", message: `Malformed .tran: "${line}". Expected ".tran <tstop>" or ".tran <tstep> <tstop> [tstart] [tmax]".` });
    }
    else if (low.startsWith(".dc")) {
      const toks = line.split(/\s+/).slice(1);
      if (toks.length >= 4) analyses.push({ kind: "dc", src: toks[0], start: parseValue(toks[1]), stop: parseValue(toks[2]), step: parseValue(toks[3]) });
      else errors.push({ severity: "warning", message: `Malformed .dc: "${line}". Expected ".dc <source> <start> <stop> <step>".` });
    }
    else if (low.startsWith(".ac")) {
      const toks = line.split(/\s+/).slice(1);
      const sweep = (/lin|dec|oct/i.exec(toks[0] || "")?.[0]?.toLowerCase() as "lin" | "dec" | "oct") || "dec";
      const n = Math.max(1, Math.round(parseValue(toks[1]) || 10));
      const fstart = parseValue(toks[2]), fstop = parseValue(toks[3]);
      // Validate: both finite, both positive (no DC), fstop > fstart (forward sweep).
      if (!isFinite(fstart) || !isFinite(fstop)) errors.push({ severity: "warning", message: `Malformed .ac: "${line}". Expected ".ac <lin|dec|oct> <points> <fstart> <fstop>".` });
      else if (fstart <= 0 || fstop <= 0) errors.push({ severity: "error", message: `.ac: frequencies must be > 0 (got fstart=${fstart}, fstop=${fstop}). AC analysis at DC is not defined; use .op instead.` });
      else if (fstop < fstart) errors.push({ severity: "error", message: `.ac: fstop (${fstop}) must be ≥ fstart (${fstart}).` });
      else analyses.push({ kind: "ac", sweep, n, fstart, fstop });
    }
    else if (low.startsWith(".noise")) {
      // .noise V(out[,ref]) <src> <lin|dec|oct> <points> <fstart> <fstop>      [SPICE3]
      // The frequency grid is specified exactly as for .ac. `src` is the independent source the
      // result is input-referred to; `ref` defaults to ground.
      const m = /^\.noise\s+v\s*\(\s*([A-Za-z0-9_.\-]+)\s*(?:,\s*([A-Za-z0-9_.\-]+)\s*)?\)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s*$/i.exec(line);
      if (!m) {
        errors.push({ severity: "warning", message: `Malformed .noise: "${line}". Expected ".noise V(out[,ref]) <source> <lin|dec|oct> <points> <fstart> <fstop>".` });
      } else {
        const out = m[1], ref = m[2], src = m[3];
        const sweep = (/^(lin|dec|oct)$/i.exec(m[4])?.[0]?.toLowerCase() as "lin" | "dec" | "oct") || "dec";
        const n = Math.max(1, Math.round(parseValue(m[5]) || 10));
        const fstart = parseValue(m[6]), fstop = parseValue(m[7]);
        if (!isFinite(fstart) || !isFinite(fstop) || fstart <= 0 || fstop < fstart) {
          errors.push({ severity: "error", message: `.noise: need 0 < fstart ≤ fstop (got fstart=${m[6]}, fstop=${m[7]}).` });
        } else {
          analyses.push({ kind: "noise", out, ...(ref ? { ref } : {}), src, sweep, n, fstart, fstop });
        }
      }
    }
    else if (low.startsWith(".nodeset")) {
      // .nodeset V(node)=value […] - an INITIAL GUESS for the DC solve, not a constraint. This is
      // how you pick a branch on a bistable circuit (latch, comparator, bandgap startup): the
      // answer Newton converges to is still a real solution of the real network.
      const re = /V\s*\(\s*([A-Za-z0-9_.\-]+)\s*\)\s*=\s*([-+]?[\d.][^\s]*)/gi;
      let m: RegExpExecArray | null;
      let found = 0;
      while ((m = re.exec(line)) !== null) {
        const value = parseValue(m[2]);
        if (isFinite(value)) { nodesets.push({ node: m[1], value }); found++; }
        else errors.push({ severity: "warning", message: `.nodeset: cannot parse value "${m[2]}" for V(${m[1]}).` });
      }
      if (found === 0) errors.push({ severity: "warning", message: `Malformed .nodeset: "${line}". Expected ".nodeset V(node)=value [V(node2)=value2 …]".` });
    }
    else if (low.startsWith(".temp")) {
      // .temp <t1> [t2 t3 …] - run every analysis at each temperature (°C). A single value just
      // sets the global temperature; several values become a sweep axis, so the per-device
      // temperature physics that already exists (R TC1/TC2, diode Is(T), MOSFET Vto(T)/Kp(T),
      // BJT Is(T)/Bf(T)) finally becomes reachable from a directive.
      const vals = line.split(/[\s,]+/).slice(1).map((t) => parseValue(t)).filter(isFinite);
      if (vals.length === 0) errors.push({ severity: "warning", message: `Malformed .temp: "${line}". Expected ".temp <°C> [<°C> …]".` });
      else if (vals.length === 1) options.temp = vals[0];
      else tempAxis = mkStep("temp", "temp", "list", vals);
    }
    else if (low.startsWith(".options") || low.startsWith(".option")) {
      // .options reltol=1e-4 abstol=1e-9 gmin=1e-10 vntol=1e-7 itl1=200 method=trap|be temp=27
      // The classic SPICE convergence-tuning knobs. Anything we don't recognize is silently
      // passed through (so a benign user typo doesn't block the directive).
      const rest = line.slice(line.indexOf(" ") + 1).replace(/=/g, " = ");
      const toks = rest.split(/\s+/).filter(Boolean);
      const numOpt = (k: keyof SimOptions, v: string) => {
        const n = parseValue(v);
        if (isFinite(n)) (options as Record<string, unknown>)[k as string] = n;
      };
      for (let i = 0; i + 2 < toks.length; i++) {
        if (toks[i + 1] !== "=") continue;
        const k = toks[i].toLowerCase(), v = toks[i + 2];
        if (k === "reltol") numOpt("reltol", v);
        else if (k === "abstol") numOpt("abstol", v);
        else if (k === "vntol") numOpt("vntol", v);
        else if (k === "gmin") numOpt("gmin", v);
        else if (k === "itl1") numOpt("itl1", v);
        else if (k === "itl4") numOpt("itl4", v);
        else if (k === "temp") numOpt("temp", v);
        else if (k === "method") {
          const m = v.toLowerCase();
          if (m === "trap" || m === "be" || m === "gear") options.method = (m === "gear" ? "trap" : m) as "trap" | "be";
        }
      }
    }
    else if (low.startsWith(".ic")) {
      // .ic V(node)=value [V(node)=value …] - initial conditions on arbitrary nodes (not just
      // capacitor terminals). After the t=0 solve in transient, we pin the named node to the
      // requested voltage. Has no effect on .op/.dc/.ac (matches SPICE).
      const re = /V\s*\(\s*([A-Za-z0-9_.\-]+)\s*\)\s*=\s*([-+]?[\d.][^\s]*)/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        const node = m[1];
        const value = parseValue(m[2]);
        if (isFinite(value)) ics.push({ node, value });
        else errors.push({ severity: "warning", message: `.ic: cannot parse value "${m[2]}" for V(${node}).` });
      }
    }
    else if (/^K\d/i.test(line) || /^\.K\d/i.test(line)) {
      // K<name> L<a> L<b> <k>  - mutual coupling between two inductors. Stored on the doc's directives;
      // handled by buildNetlist below (it scans .K/K lines and pushes K elements).
    }
    else if (low.startsWith(".step")) {
      // Full LTspice/SPICE3 grammar:
      //   .step [lin|dec|oct] [param] <name> <start> <stop> <inc>
      //   .step [param] <name> list <v1> <v2> …
      //   .step temp <start> <stop> <inc>        |  .step temp list -40 25 85
      // <name> is a component refdes, a `.param` name, or the literal `temp`. Which one it is
      // is decided by lookup (a declared .param wins), so the historical form
      // `.step param R1 1k 4k 1k` - which sweeps the COMPONENT R1 - keeps working unchanged.
      // Two axes may be given (two .step lines); the first is the outer loop.
      const toks = line.split(/\s+/).slice(1);
      let i = 0;
      let mode: StepMode = "lin";
      const m0 = (toks[i] ?? "").toLowerCase();
      if (m0 === "lin" || m0 === "dec" || m0 === "oct") { mode = m0 as StepMode; i++; }
      if ((toks[i] ?? "").toLowerCase() === "param") i++;
      const name = toks[i];
      i++;
      if (!name) {
        errors.push({ severity: "warning", message: `Malformed .step: "${line}". Expected ".step [lin|dec|oct] [param] <name> <start> <stop> <inc>" or ".step <name> list <v1> <v2> …".` });
      } else {
        let values: number[] = [];
        if ((toks[i] ?? "").toLowerCase() === "list") {
          values = expandSweep("list", NaN, NaN, NaN, toks.slice(i + 1).map((t) => parseValue(t)));
          mode = "list";
          if (values.length === 0) errors.push({ severity: "warning", message: `.step ${name} list: no numeric values found in "${line}".` });
        } else {
          const a = parseValue(toks[i]), b = parseValue(toks[i + 1]), inc = parseValue(toks[i + 2]);
          values = expandSweep(mode, a, b, inc, []);
          if (values.length === 0) {
            errors.push({
              severity: "warning",
              message: mode === "lin"
                ? `.step: invalid range "${line}". Need start ≤ stop and inc > 0.`
                : `.step ${mode}: invalid range "${line}". Need 0 < start ≤ stop and at least 1 point per ${mode === "dec" ? "decade" : "octave"}.`,
            });
          }
        }
        if (values.length > 0) {
          const isTemp = name.toLowerCase() === "temp";
          const isParam = !isTemp && params.has(name.toUpperCase());
          const spec = mkStep(isTemp ? "temp" : isParam ? "param" : "device", isTemp ? "temp" : name, mode, values);
          if (steps.length >= 2) {
            errors.push({ severity: "warning", message: `.step: at most 2 nested sweeps are supported - "${line}" was ignored (${steps.map(s => s.refdes).join(" × ")} are already active).` });
          } else if (values.length === 1) {
            errors.push({ severity: "info", message: `.step ${name}: the range produces a single point (${values[0]}); running it as a plain single-value sweep.` });
            steps.push(spec);
          } else steps.push(spec);
        }
      }
    }
    // .param is collected separately (parseParamDirectives); .model / .meas / .lib are handled
    // elsewhere or not yet acted on.
  }
  // A multi-valued `.temp` becomes the innermost axis, so signal suffixes read
  // `V(out)[R1=1k][temp=85]` - the parameter family first, temperature within it.
  if (tempAxis) {
    if (steps.length >= 2) errors.push({ severity: "warning", message: `.temp sweep ignored - ${steps.map(s => s.refdes).join(" × ")} already use both nesting levels.` });
    else if (steps.some(s => s.what === "temp")) errors.push({ severity: "warning", message: ".temp sweep ignored - a .step temp directive is already stepping temperature." });
    else steps.push(tempAxis);
  }
  return { analyses, errors, options, ics, nodesets, steps };
}

/** Scan directive lines for K-element entries (K<name> L<a> L<b> <k>). */
function parseKDirectives(doc: SchematicDoc): { ks: { name: string; l1: string; l2: string; k: number }[]; errors: SimError[] } {
  const ks: { name: string; l1: string; l2: string; k: number }[] = [];
  const errors: SimError[] = [];
  for (const d of doc.directives) {
    if (!d.enabled) continue;
    const line = d.text.trim().replace(/^\./, "");          // accept both K1 and .K1
    if (!/^K\d/i.test(line)) continue;
    const toks = line.split(/\s+/);
    if (toks.length >= 4) {
      const name = toks[0];
      // Normalize inductor references to UPPER case so the engine's case-sensitive `===`
      // matching against L element names always finds them. Without this, lowercase "k1 l1
      // l2 0.99" creates a K element whose `el.l1 = "l1"` never matches an L named "L1" -
      // silent no-op coupling.
      const l1 = toks[1].toUpperCase();
      const l2 = toks[2].toUpperCase();
      const k = parseValue(toks[3]);
      if (!isFinite(k)) { errors.push({ severity: "warning", message: `Malformed K directive: "${line}" - could not parse k.` }); continue; }
      ks.push({ name, l1, l2, k });
    } else errors.push({ severity: "warning", message: `Malformed K directive: "${line}". Expected "K<name> <L1> <L2> <k>".` });
  }
  return { ks, errors };
}

// ---------- the netlister ----------
export function buildNetlist(doc: SchematicDoc): Netlist {
  const sheet = doc.sheets[doc.rootSheet];
  const errors: SimError[] = [];
  const nets = netsFor(doc);
  const { nameOf, uf, pinRoot } = nets;
  errors.push(...nets.conflicts);

  const netAt = (compId: string, pinIndex: number): string => {
    const r = pinRoot.get(`${compId}#${pinIndex}`);
    if (!r) return `N_dangling_${compId}_${pinIndex}`;
    return nameOf.get(uf.find(r)) ?? `N_${r.replace(/[^a-z0-9]/gi, "")}`;
  };

  const usedRefdes = new Set<string>();
  const refdesFor = (c: ComponentInstance, prefix: string): string => {
    const originalUser = c.refdes && c.refdes.trim();
    let r = originalUser ? c.refdes.trim() : `${prefix}${c.id}`;
    const base = r;
    let k = 1;
    while (usedRefdes.has(r.toUpperCase())) r = `${base}_${k++}`;
    // If the user typed an explicit refdes that already exists, we silently renamed it. Surface
    // that as info so the user can see the suffix the simulator actually used - otherwise their
    // probe expressions ("I(R1)") and the canvas label diverge with no explanation.
    if (originalUser && r !== base) {
      errors.push({
        severity: "info",
        message: `Refdes "${base}" was already in use - renamed this instance to "${r}". Probe expressions like I(${r}) should use the new name.`,
        location: r,
      });
    }
    usedRefdes.add(r.toUpperCase());
    return r;
  };

  const elements: NetlistElement[] = [];
  // ---- global .param scope ----
  // Resolved BEFORE any element is built so a component value of "{Rf}" becomes a real number
  // instead of silently falling back to the symbol default (which is what parseValue("{Rf}") =
  // NaN used to do - a wrong resistor with no diagnostic).
  const params = parseParamDirectives(doc, errors);
  const paramBindings: ParamBinding[] = [];
  /** Substitute `{NAME}` / a bare param name against the .param scope. Returns the substituted
   *  text plus the params it consumed, so `.step param NAME …` knows which elements to rewrite. */
  const substParams = (raw: string, where: string): { text: string; used: string[] } => {
    const used: string[] = [];
    if (!raw) return { text: raw, used };
    let text = raw.replace(/\{([^}]+)\}/g, (whole, inner: string) => {
      const key = inner.trim().toUpperCase();
      const v = params.get(key);
      if (v === undefined) {
        errors.push({ severity: "warning", message: `${where}: "{${inner.trim()}}" does not match any .param - the value could not be resolved.`, location: where });
        return whole;
      }
      used.push(key);
      return String(v);
    });
    // Bare-name form: the WHOLE attribute is a param name (LTspice accepts this for values).
    if (used.length === 0 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(text.trim())) {
      const key = text.trim().toUpperCase();
      const v = params.get(key);
      if (v !== undefined) { used.push(key); text = String(v); }
    }
    return { text, used };
  };
  const attr = (c: ComponentInstance, key: string, def: string) => (c.attrs[key] ?? SYMBOLS[c.symbolId]?.attrs.find(a => a.key === key)?.default ?? def);
  /** attr() + .param substitution, recording the binding so the value can be re-stepped. */
  const attrP = (c: ComponentInstance, key: string, def: string, refdes: string, field: "value" | "dc"): string => {
    const { text, used } = substParams(attr(c, key, def), refdes);
    for (const p of used) paramBindings.push({ param: p, refdes, field });
    return text;
  };

  // ---- top-level model registry ----
  // Parse .model directives from BOTH doc.models (where importers stash them) AND from any
  // directives the user typed directly into the directives pane. Top-level models are visible
  // to every primitive D/M/Q on the schematic AND to every subcircuit body that doesn't shadow
  // the name. The lookup is case-insensitive.
  const modelText = [
    doc.models.join("\n"),
    doc.directives.filter(d => d.enabled).map(d => d.text).join("\n"),
  ].join("\n");
  const modelRegistry: ModelRegistry = parseModels(modelText, errors);

  /** Rail names that already own a supply source. Two `VCC` ports must share ONE source: two
   *  independent sources across the same node pair is a singular matrix, not a stiffer rail. */
  const railSourced = new Map<string, { refdes: string; v: number }>();

  /**
   * The temperature this deck will be solved at, read ahead of the element loop.
   *
   * Only the thermistor needs it, and it needs it badly: its resistance is exponential in
   * temperature, and anchoring the linear-plus-quadratic tempco anywhere other than the actual
   * operating point makes it wrong by tens of percent. Read directly here rather than by
   * reordering `parseDirectives` — a cheap scan cannot break the directive pipeline, and a
   * reorder could.
   */
  const simTempC = (() => {
    let t = DEFAULT_OPTIONS.temp;
    for (const d of doc.directives) {
      if (!d.enabled) continue;
      const line = d.text.trim();
      const opt = /^\.options?\b.*?\btemp\s*=\s*([-\d.][^\s]*)/i.exec(line);
      if (opt) { const v = parseValue(opt[1]); if (isFinite(v)) t = v; continue; }
      if (/^\.temp\b/i.test(line)) {
        const v = parseValue(line.split(/\s+/)[1] ?? "");
        if (isFinite(v)) t = v;
      }
    }
    return t;
  })();

  /** Fall back to the symbol default ONLY when the field could not be parsed at all.
   *
   *  The idiom this replaces was `parseValue(...) || DEFAULT`, which also swallows a legitimate
   *  ZERO — and zero is a real, deliberate value for most of these fields. A VCVS whose gain the
   *  user set to 0 silently became gain 1; a VCCS gain 0 became 1 mS; a 0 Ω link became 1 kΩ.
   *  Each of those is a confidently wrong answer to a question the user answered explicitly.
   *  Genuinely degenerate zeros are handled downstream (the engine floors |R|, |C| and |L| away
   *  from zero), so passing the user's 0 through is both honest and safe. */
  const parsedOr = (v: number, d: number) => (Number.isFinite(v) ? v : d);
  /** Same, but for fields where zero is physically meaningless (a MOSFET's W or L divides). */
  const positiveOr = (v: number, d: number) => (Number.isFinite(v) && v > 0 ? v : d);

  // Digital parts are collected here and netlisted after the analog elements exist, because
  // whether a digital pin needs a bridge depends on what ELSE is on its net.
  const digitalComps: DigitalComp[] = [];
  const pinsOnNet = new Map<string, number>();
  for (const c of Object.values(sheet.components)) {
    const sym = SYMBOLS[c.symbolId];
    if (!sym) continue;
    for (let i = 0; i < sym.pins.length; i++) { const n = netAt(c.id, i); pinsOnNet.set(n, (pinsOnNet.get(n) ?? 0) + 1); }
  }
  for (const c of Object.values(sheet.components)) {
    const sym = SYMBOLS[c.symbolId];
    if (!sym) { errors.push({ severity: "warning", message: `Unknown symbol "${c.symbolId}" (${c.refdes || c.id}); skipped.` }); continue; }
    if (c.symbolId === "gnd") continue;
    // nodes in spiceOrder
    const ordered = [...sym.pins].map((p, i) => ({ ...p, _idx: i })).sort((a, b) => a.spiceOrder - b.spiceOrder);
    const nodes = ordered.map(p => netAt(c.id, (p as any)._idx));
    const name = refdesFor(c, sym.prefix);
    if (isDigitalPart(c)) {
      const pinNet: Record<string, string> = {};
      sym.pins.forEach((p, i) => {
        const n = netAt(c.id, i);
        // A pin alone on an anonymous net is unconnected. A pin alone on a NAMED net (a net label
        // the user put there to watch it) is connected: that is how an output gets observed.
        pinNet[p.name] = n !== "0" && /^N\d+$/.test(n) && (pinsOnNet.get(n) ?? 0) <= 1 ? `N_dangling_${name}_${p.name}` : n;
      });
      digitalComps.push({ ref: name, symbolId: c.symbolId, attr: (k, d) => attr(c, k, d ?? ""), pinNet, optionalPins: new Set(sym.optionalPins ?? []) });
      continue;
    }
    // dangling-pin warnings
    nodes.forEach((n, k) => { if (n.startsWith("N_dangling_")) errors.push({ severity: "warning", message: `Pin "${ordered[k].name}" of ${name} is not connected.`, location: name }); });

    switch (c.symbolId) {
      case "res": elements.push({
        type: "R", name, n1: nodes[0], n2: nodes[1],
        value: parsedOr(parseValue(attrP(c, "value", "1k", name, "value")), 1e3),
        tc1: num(c, "tc1", 0), tc2: num(c, "tc2", 0), tnom: num(c, "tnom", 27),
      }); break;
      // A polarised electrolytic is electrically an ordinary capacitor — the polarity lives in
      // the symbol and in the stress checks, not in the charge equation.
      case "cap": case "cap_pol": {
        const ic = parseValue(attr(c, "ic", ""));
        elements.push({
          type: "C", name, n1: nodes[0], n2: nodes[1],
          value: parsedOr(parseValue(attrP(c, "value", "1u", name, "value")), 1e-6),
          ic: isFinite(ic) ? ic : undefined,
          esr: num(c, "esr", 0), rpar: num(c, "rpar", 0) || undefined,
        });
        break;
      }
      case "ind": {
        const ic = parseValue(attr(c, "ic", ""));
        elements.push({
          type: "L", name, n1: nodes[0], n2: nodes[1],
          value: parsedOr(parseValue(attrP(c, "value", "1m", name, "value")), 1e-3),
          ic: isFinite(ic) ? ic : undefined,
          rser: num(c, "rser", 0),
        });
        break;
      }
      // Sources: a `{PARAM}` inside the spec is substituted, but the binding is only recorded
      // when the spec is a PLAIN DC value - rewriting `.dc` on a SIN()/PULSE() source at each
      // step would change a number the transient stamp never reads, i.e. report a sweep that
      // did not happen.
      // `battery` and `acsource` are the same `V` element with a friendlier face and a
      // different default value — the source spec grammar is identical for all three.
      case "vsource": case "battery": case "acsource": { const raw = substParams(attr(c, "value", "5"), name); const p = parseSourceSpec(raw.text); if (!p.tran) for (const q of raw.used) paramBindings.push({ param: q, refdes: name, field: "dc" }); elements.push({ type: "V", name, n1: nodes[0], n2: nodes[1], dc: p.dc, ac: p.ac, tran: p.tran }); break; }
      case "isource": { const raw = substParams(attr(c, "value", "1m"), name); const p = parseSourceSpec(raw.text); if (!p.tran) for (const q of raw.used) paramBindings.push({ param: q, refdes: name, field: "dc" }); elements.push({ type: "I", name, n1: nodes[0], n2: nodes[1], dc: p.dc, ac: p.ac, tran: p.tran }); break; }
      // Every member of the diode family is the same `D` element. They differ only in which
      // model card `attr()` falls back to, and each symbol declares its own default
      // (`ZENER` / `SCHOTTKY` / `LED` / `D`) — so the fallback below is already per-symbol and
      // needs no branching here.
      case "diode": case "zener": case "schottky": case "led": case "photodiode": {
        // Resolution order: top-level .model registry → DEFAULT_MODELS (D / ZENER / SCHOTTKY /
        // LED) → DEFAULT_MODELS.D. Per-instance attrs (Is, N, …) layer on top, so a user can
        // keep using a named model AND tweak one parameter via the Inspector.
        const mname = attr(c, "model", "D");
        const base = resolveDiode(modelRegistry, mname);
        const model = {
          Is:   num(c, "Is",   base.Is),
          N:    num(c, "N",    base.N),
          Rs:   num(c, "Rs",   base.Rs),
          Cjo:  num(c, "Cjo",  base.Cjo),
          Vj:   num(c, "Vj",   base.Vj),
          M:    num(c, "M",    base.M),
          Bv:   num(c, "Bv",   base.Bv),
          Ibv:  num(c, "Ibv",  base.Ibv),
          Tnom: num(c, "Tnom", base.Tnom),
          XTI:  num(c, "XTI",  base.XTI),
          Eg:   num(c, "Eg",   base.Eg),
          // Flicker-noise pair - consumed only by .noise. Default 0 ⇒ no flicker term at all
          // (an unfitted 1/f corner invented by the simulator would be a fabricated number).
          Kf:   num(c, "Kf",   (base as { Kf?: number }).Kf ?? 0),
          Af:   num(c, "Af",   (base as { Af?: number }).Af ?? 1),
        };
        elements.push({ type: "D", name, nA: nodes[0], nK: nodes[1], model, area: num(c, "area", 1) });
        // A photodiode is that same junction plus a light-driven current. Photocurrent flows
        // INSIDE the device from cathode to anode (the same sense as reverse leakage), so the
        // source is stamped K→A: drawn out of the cathode node, pushed into the anode node.
        // `iph` = 0 leaves a plain diode in the dark, which is exactly right.
        if (c.symbolId === "photodiode") {
          const iph = parseValue(attr(c, "iph", "0"));
          if (isFinite(iph) && iph !== 0) elements.push({ type: "I", name: `${name}_PH`, n1: nodes[1], n2: nodes[0], dc: iph });
        }
        break;
      }
      case "rail": {
        // The port has already NAMED its net in the naming pass above. If it also carries a
        // voltage it SUPPLIES that net — once per rail name, however many ports share it.
        const railName = (attr(c, "name", "VCC") || "VCC").trim();
        const raw = attr(c, "v", "").trim();
        if (!raw) break;                        // a pure named rail; something else drives it
        const v = parseValue(raw);
        if (!isFinite(v)) {
          errors.push({ severity: "warning", message: `Supply rail "${railName}": cannot read "${raw}" as a voltage, so this port only names the net.`, location: name });
          break;
        }
        const key = railName.toUpperCase();
        const prior = railSourced.get(key);
        if (prior) {
          if (Math.abs(prior.v - v) > 1e-12) {
            errors.push({ severity: "warning", message: `Supply rail "${railName}" is set to ${prior.v} V by ${prior.refdes} and ${v} V here - using ${prior.v} V.`, location: name, hint: "Rail ports sharing a name share one supply; clear the Supply field on all but one." });
          }
          break;
        }
        railSourced.set(key, { refdes: name, v });
        elements.push({ type: "V", name, n1: nodes[0], n2: "0", dc: v });
        break;
      }
      case "opamp": elements.push({
        type: "OPAMP", name, nInP: nodes[0], nInN: nodes[1], nOut: nodes[2],
        gain: parsedOr(parseValue(attr(c, "gain", "100k")), 1e5),
        vmax: num(c, "vmax", 15), vmin: num(c, "vmin", -15),
        rin: num(c, "rin", 1e12), rout: num(c, "rout", 75),
        slew: num(c, "slew", 1e7), gbw: num(c, "gbw", 1e6),
      }); break;
      case "vcvs": elements.push({ type: "E", name, n1: nodes[0], n2: nodes[1], nc1: nodes[2], nc2: nodes[3], gain: parsedOr(parseValue(attr(c, "gain", "1")), 1) }); break;
      case "vccs": elements.push({ type: "G", name, n1: nodes[0], n2: nodes[1], nc1: nodes[2], nc2: nodes[3], gain: parsedOr(parseValue(attr(c, "gain", "1m")), 1e-3) }); break;
      case "ccvs": elements.push({ type: "H", name, n1: nodes[0], n2: nodes[1], vsrc: attr(c, "vctrl", "V1"), gain: parsedOr(parseValue(attr(c, "gain", "1")), 1) }); break;
      case "cccs": elements.push({ type: "F", name, n1: nodes[0], n2: nodes[1], vsrc: attr(c, "vctrl", "V1"), gain: parsedOr(parseValue(attr(c, "gain", "1")), 1) }); break;
      case "nmos": case "pmos": {
        // Resolution: top-level .model "model"-attr → DEFAULT_MODELS.NMOS/PMOS. Honour the
        // schematic kind (the symbol picks polarity); the user's model name is a parameter
        // bundle, not a polarity override.
        const isP = c.symbolId === "pmos";
        const mname = attr(c, "model", isP ? "PMOS" : "NMOS");
        const base = resolveMos(modelRegistry, mname, isP);
        const W = positiveOr(parseValue(attr(c, "W", String(base.W))), base.W);
        const Lv = positiveOr(parseValue(attr(c, "L", String(base.L))), base.L);
        const model = {
          ...base,
          Vto:    num(c, "Vto",    base.Vto),
          Kp:     num(c, "Kp",     base.Kp),
          Lambda: num(c, "Lambda", base.Lambda),
          Gamma:  num(c, "Gamma",  base.Gamma),
          Phi:    num(c, "Phi",    base.Phi),
          W, L: Lv,
          Cgso:   num(c, "Cgso",   base.Cgso),
          Cgdo:   num(c, "Cgdo",   base.Cgdo),
          Cgbo:   num(c, "Cgbo",   base.Cgbo),
          Cbd:    num(c, "Cbd",    base.Cbd),
          Cbs:    num(c, "Cbs",    base.Cbs),
          Pb:     num(c, "Pb",     base.Pb),
          Mj:     num(c, "Mj",     base.Mj),
          Tnom:   num(c, "Tnom",   base.Tnom),
          Kf:     num(c, "Kf",     base.Kf),
          Af:     num(c, "Af",     base.Af),
          // Cox (F/m²) is only needed by the .noise flicker term. 0 ⇒ noise.ts derives it from
          // Kp with an explicitly-stated mobility assumption and flags that in the result notes.
          Cox:    num(c, "Cox",    base.Cox ?? 0) || undefined,
          Nsubvt: num(c, "Nsubvt", base.Nsubvt),
        };
        // 3-terminal symbol: bulk tied to source (NMOS) or to source/highest-V (left to user via wiring elsewhere)
        elements.push({ type: "M", name, nD: nodes[0], nG: nodes[1], nS: nodes[2], nB: nodes[2], model });
        break;
      }
      case "pot": {
        // Two resistors sharing the wiper node — which is exactly what a potentiometer IS, and
        // why it needs no engine support at all. `wiper` is the fraction of the track between
        // pin 1 and the wiper.
        const track = positiveOr(parseValue(attrP(c, "value", "10k", name, "value")), 1e4);
        const raw = parseValue(attr(c, "wiper", "0.5"));
        let w = isFinite(raw) ? raw : 0.5;
        if (w < 0 || w > 1) {
          errors.push({ severity: "warning", message: `${name}: wiper position ${raw} is outside 0…1 - clamped.`, location: name });
          w = Math.max(0, Math.min(1, w));
        }
        // Floor each leg rather than letting one collapse to a literal 0 Ω. A real pot has end
        // resistance, and a true short would be stamped as a 1e12 S conductance that wrecks the
        // matrix conditioning of everything else on the sheet.
        const END = 1e-3;
        elements.push({ type: "R", name: `${name}A`, n1: nodes[0], n2: nodes[1], value: Math.max(track * w, END) });
        elements.push({ type: "R", name: `${name}B`, n1: nodes[1], n2: nodes[2], value: Math.max(track * (1 - w), END) });
        break;
      }
      case "xformer": {
        // Two windings plus the coupling between them. The winding element names are derived
        // from this instance's refdes, so they are unique by construction and the K below can
        // reference them by name exactly as a hand-typed K directive would.
        const lp = parseValue(attr(c, "lp", "10m"));
        const ls = parseValue(attr(c, "ls", "10m"));
        const kRaw = parseValue(attr(c, "k", "0.99"));
        const okL = (v: number, which: string): number => {
          if (isFinite(v) && v > 0) return v;
          errors.push({ severity: "warning", message: `${name}: ${which} inductance "${v}" is not a positive number - using 10 mH.`, location: name });
          return 10e-3;
        };
        // |k| = 1 makes the inductance matrix exactly singular. A real transformer never reaches
        // it (leakage flux always exists), so clamping just below unity is both the numerically
        // safe and the physically honest thing to do.
        let k = isFinite(kRaw) ? kRaw : 0.99;
        if (Math.abs(k) >= 1) {
          errors.push({ severity: "warning", message: `${name}: coupling k=${kRaw} means zero leakage inductance, which is not solvable - using ${k < 0 ? "-" : ""}0.999999.`, location: name, hint: "Real transformers couple at 0.95-0.9999; use 0.999999 for a near-ideal one." });
          k = k < 0 ? -0.999999 : 0.999999;
        }
        const lpName = `${name}P`, lsName = `${name}S`;
        elements.push({ type: "L", name: lpName, n1: nodes[0], n2: nodes[1], value: okL(lp, "primary") });
        elements.push({ type: "L", name: lsName, n1: nodes[2], n2: nodes[3], value: okL(ls, "secondary") });
        elements.push({ type: "K", name, l1: lpName, l2: lsName, k });
        break;
      }
      // ───── protection / sensing / resonators ─────
      case "fuse": {
        // An intact fuse IS a small resistor. Blowing is a state change over time that this
        // engine has no mechanism for, so the rating is carried for the BOM and the stress
        // check rather than simulated — saying so is better than pretending to open.
        const r = parseValue(attr(c, "r", "10m"));
        elements.push({ type: "R", name, n1: nodes[0], n2: nodes[1], value: isFinite(r) && r > 0 ? r : 1e-2 });
        break;
      }
      case "thermistor": {
        // NTC: R(T) = R25·exp(B·(1/T − 1/T25)) — the β-parameter law every NTC datasheet quotes.
        //
        // The engine's resistor carries the SPICE quadratic tempco R·(1 + TC1·ΔT + TC2·ΔT²),
        // which cannot BE an exponential. A Taylor fit anchored at 25 °C is therefore only good
        // near 25 °C: for B = 3950 it is ~3 % out at ±10 K and ~30 % out by +20 K, which is the
        // kind of confidently-wrong number that is worse than no part at all.
        //
        // So anchor the fit at the temperature the circuit is ACTUALLY being simulated at. The
        // resistance is then EXACT at that temperature by construction, and TC1/TC2 are the true
        // local first and second derivatives there, so a `.step temp` around the operating point
        // still moves it the right way:
        //     R(Tsim) = R25·exp(B(1/Tsim − 1/T25))
        //     TC1 = −B/Tsim²        TC2 = ½·(B²/Tsim⁴ + 2B/Tsim³)
        // Tnom is set to Tsim so the engine's ΔT is measured from that same anchor.
        const r25 = parseValue(attrP(c, "value", "10k", name, "value"));
        const B = parseValue(attr(c, "b", "3950"));
        const b = isFinite(B) ? B : 3950;
        const T25 = 298.15;
        const Tk = simTempC + 273.15;
        elements.push({
          type: "R", name, n1: nodes[0], n2: nodes[1],
          value: (isFinite(r25) && r25 > 0 ? r25 : 1e4) * Math.exp(b * (1 / Tk - 1 / T25)),
          tc1: -b / (Tk * Tk),
          tc2: 0.5 * ((b * b) / (Tk ** 4) + (2 * b) / (Tk ** 3)),
          tnom: simTempC,
        });
        break;
      }
      case "varistor": {
        // I = 1 mA·(|V|/Vn)^α with the sign of V — the standard MOV power law, where Vn is the
        // clamping voltage quoted at 1 mA and α the nonlinearity exponent. Symmetric by
        // construction, which is the property that makes a MOV a MOV.
        const vn = parseValue(attrP(c, "value", "30", name, "value"));
        const alpha = parseValue(attr(c, "alpha", "30"));
        const Vn = isFinite(vn) && vn > 0 ? vn : 30;
        const a = isFinite(alpha) && alpha > 1 ? alpha : 30;
        const vExpr = `V(${nodes[0]},${nodes[1]})`;
        elements.push({
          type: "B", name, n1: nodes[0], n2: nodes[1], ctrl: "I",
          expr: `1m*pow(abs(${vExpr})/${Vn}, ${a})*(${vExpr} >= 0 ? 1 : -1)`,
        });
        break;
      }
      case "crystal": {
        // The Butterworth-Van Dyke model, which is what a crystal IS: a very high-Q motional
        // branch (Lm-Cm-Rs) shunted by the holder capacitance Cp. Lm follows from the series
        // resonance the user asked for: Lm = 1/((2πf)²·Cm).
        const f = parseValue(attrP(c, "value", "16Meg", name, "value"));
        const cm = parseValue(attr(c, "cm", "20f"));
        const rs = parseValue(attr(c, "rs", "30"));
        const cp = parseValue(attr(c, "cp", "5p"));
        if (!isFinite(f) || f <= 0 || !isFinite(cm) || cm <= 0) {
          errors.push({ severity: "error", message: `${name}: a crystal needs a positive frequency and motional capacitance.`, location: name });
          break;
        }
        const lm = 1 / (Math.pow(2 * Math.PI * f, 2) * cm);
        const m1 = `${name}_m1`, m2 = `${name}_m2`;
        elements.push({ type: "L", name: `${name}L`, n1: nodes[0], n2: m1, value: lm });
        elements.push({ type: "C", name: `${name}C`, n1: m1, n2: m2, value: cm });
        elements.push({ type: "R", name: `${name}R`, n1: m2, n2: nodes[1], value: isFinite(rs) && rs > 0 ? rs : 30 });
        if (isFinite(cp) && cp > 0) elements.push({ type: "C", name: `${name}P`, n1: nodes[0], n2: nodes[1], value: cp });
        break;
      }
      // ───── thyristors ─────
      case "diac": {
        // Two zeners cathode-to-cathode: in either direction one conducts forward while the
        // other breaks over, so the device fires symmetrically at ±Vbo. That is not an
        // approximation of a DIAC — it is how a DIAC's characteristic is usually modelled.
        const vbo = parseValue(attrP(c, "value", "32", name, "value"));
        const V = isFinite(vbo) && vbo > 0 ? vbo : 32;
        const mid = `${name}_m`;
        const z = { ...DEFAULT_MODELS.ZENER, Bv: Math.max(V - 0.7, 0.1), Ibv: 1e-4 };
        elements.push({ type: "D", name: `${name}A`, nA: nodes[0], nK: mid, model: z });
        elements.push({ type: "D", name: `${name}B`, nA: nodes[1], nK: mid, model: z });
        break;
      }
      case "scr": case "triac": {
        // The two-transistor latch, which is the real structure of a thyristor rather than a
        // behavioural stand-in: a PNP and an NPN cross-coupled so that once the loop gain
        // αn·αp reaches 1 the pair holds itself on with no further gate drive.
        //
        // The betas are deliberately LOW (αn·αp ≈ 0.79 < 1) so the device does NOT self-latch on
        // leakage and genuinely needs gate current to fire — which is the whole behaviour anyone
        // places a thyristor for. The gate-cathode resistor sets how much.
        const igt = parseValue(attr(c, "igt", c.symbolId === "triac" ? "10m" : "200µ"));
        const rgk = isFinite(igt) && igt > 0 ? Math.max(0.7 / igt, 1) : 3.5e3;
        const npn = { ...DEFAULT_MODELS.NPN, Bf: 10, Br: 0.1, Vaf: 200 };
        const pnp = { ...DEFAULT_MODELS.PNP, Bf: 6, Br: 0.1, Vaf: 200 };
        /** One cross-coupled pair between `a` and `k`, gated from `g`. */
        const scrSection = (tag: string, a: string, k: string, g: string) => {
          const nb = `${name}_${tag}b`;
          elements.push({ type: "Q", name: `${name}${tag}P`, nC: g, nB: nb, nE: a, model: pnp });
          elements.push({ type: "Q", name: `${name}${tag}N`, nC: nb, nB: g, nE: k, model: npn });
        };
        if (c.symbolId === "scr") {
          scrSection("", nodes[0], nodes[1], nodes[2]);
          elements.push({ type: "R", name: `${name}G`, n1: nodes[2], n2: nodes[1], value: rgk });
        } else {
          // A TRIAC is two cross-coupled pairs in inverse parallel, so it conducts in both
          // half-cycles. Each pair sees the opposite pair of main terminals.
          //
          // THE GATE RESISTOR IS EMITTED ONCE, TO MT1 — never once per section. A real TRIAC's
          // gate is referenced to MT1, and giving the reverse section its own gate-to-"cathode"
          // resistor would tie the gate to MT2 instead: that resistor then feeds the forward
          // section's gate straight from the main terminal, and the device latches on the
          // instant it is powered, with no trigger at all. Which is exactly what it did.
          scrSection("F", nodes[0], nodes[1], nodes[2]);
          scrSection("R", nodes[1], nodes[0], nodes[2]);
          elements.push({ type: "R", name: `${name}G`, n1: nodes[2], n2: nodes[1], value: rgk });
        }
        break;
      }
      case "igbt": {
        // The textbook IGBT equivalent: an insulated-gate MOSFET supplying the base current of a
        // PNP output transistor. Collector of the IGBT is the PNP's EMITTER — that inversion is
        // the reason an IGBT drops a diode plus a MOSFET rather than just a MOSFET.
        const vth = parseValue(attr(c, "vth", "5"));
        const nb = `${name}_b`;
        const mos = { ...DEFAULT_MODELS.NMOS, Vto: isFinite(vth) ? vth : 5, Kp: 20, W: 1, L: 1, Lambda: 0.01 };
        const pnp = { ...DEFAULT_MODELS.PNP, Bf: 8, Vaf: 200 };
        elements.push({ type: "M", name: `${name}M`, nD: nb, nG: nodes[1], nS: nodes[2], nB: nodes[2], model: mos });
        elements.push({ type: "Q", name: `${name}Q`, nC: nodes[2], nB: nb, nE: nodes[0], model: pnp });
        // Defines the base when the gate is off; without it the PNP base floats on leakage alone.
        elements.push({ type: "R", name: `${name}R`, n1: nodes[0], n2: nb, value: 1e5 });
        break;
      }
      // ───── optical ─────
      case "phototrans": {
        // An ordinary BJT whose base drive is a light-proportional current rather than a wire.
        const iph = parseValue(attr(c, "iph", "1µ"));
        const base = resolveBjt(modelRegistry, attr(c, "model", "NPN"), false, errors, name);
        const nb = `${name}_b`;
        elements.push({ type: "Q", name: `${name}Q`, nC: nodes[0], nB: nb, nE: nodes[1], model: base });
        if (isFinite(iph) && iph !== 0) elements.push({ type: "I", name: `${name}_PH`, n1: nodes[1], n2: nb, dc: iph });
        // A base with nothing on it but a current source has no DC path; this gives it one and
        // sets where the device sits in the dark.
        elements.push({ type: "R", name: `${name}RB`, n1: nb, n2: nodes[1], value: 1e6 });
        break;
      }
      case "opto": {
        // LED in, phototransistor out, coupled ONLY by the current-transfer ratio — which is
        // exactly the isolation the part exists to provide, and why the two sides share no node.
        //
        // CTR is defined collector-current-per-LED-current, so the injected BASE current is
        // CTR/Bf: the transistor then multiplies it back up to CTR·I_led. Stated because CTR is
        // therefore referred to the model's nominal beta, not measured independently of it.
        const ctr = parseValue(attr(c, "ctr", "0.5"));
        const CTR = isFinite(ctr) && ctr > 0 ? ctr : 0.5;
        const npn = { ...DEFAULT_MODELS.NPN, Bf: 200 };
        const nLed = `${name}_led`, nb = `${name}_b`;
        elements.push({ type: "D", name: `${name}D`, nA: nodes[0], nK: nLed, model: { ...DEFAULT_MODELS.LED } });
        // A 0 V source purely to sense the LED current for the CCCS — the standard SPICE idiom.
        elements.push({ type: "V", name: `${name}_S`, n1: nLed, n2: nodes[1], dc: 0 });
        elements.push({ type: "Q", name: `${name}Q`, nC: nodes[2], nB: nb, nE: nodes[3], model: npn });
        elements.push({ type: "F", name: `${name}F`, n1: nodes[3], n2: nb, vsrc: `${name}_S`, gain: CTR / 200 });
        elements.push({ type: "R", name: `${name}RB`, n1: nb, n2: nodes[3], value: 1e6 });
        break;
      }
      case "relay": {
        // Coil drives contact. The switch senses the coil VOLTAGE rather than its current, which
        // for a fixed-resistance coil is the same information; `vpick` is therefore the pull-in
        // voltage straight off the datasheet. Hysteresis is set to 25 % of it so the contact
        // does not chatter around the threshold, exactly as a real relay's armature does not.
        const lc = parseValue(attr(c, "lcoil", "100m"));
        const rc = parseValue(attr(c, "rcoil", "200"));
        const vp = parseValue(attr(c, "vpick", "3.5"));
        const ron = parseValue(attr(c, "ron", "50m"));
        const Vp = isFinite(vp) && vp > 0 ? vp : 3.5;
        elements.push({
          type: "L", name: `${name}L`, n1: nodes[0], n2: nodes[1],
          value: isFinite(lc) && lc > 0 ? lc : 0.1,
          rser: isFinite(rc) && rc > 0 ? rc : 200,
        });
        elements.push({
          type: "S", name: `${name}S`, n1: nodes[2], n2: nodes[3], nc1: nodes[0], nc2: nodes[1],
          model: { kind: "vswitch" as const, Ron: isFinite(ron) && ron > 0 ? ron : 0.05, Roff: 1e9, Vt: Vp, Vh: Vp * 0.25 },
        });
        break;
      }
      // ───── logic gates ─────
      case "gate_and": case "gate_nand": case "gate_or": case "gate_nor": case "gate_xor": case "gate_not": {
        // One behavioural source carrying the truth table. These are ANALOG gates: a threshold,
        // a rail, and no propagation delay or drive strength. That makes them right for the job
        // people actually reach for them for on an analog sheet — a comparator's logic, an
        // oscillator's feedback, an enable — and NOT a substitute for a digital simulator.
        const vhi = parseValue(attr(c, "vhi", "5"));
        const vth = parseValue(attr(c, "vth", "2.5"));
        const H = isFinite(vhi) ? vhi : 5;
        const T = isFinite(vth) ? vth : 2.5;
        const isNot = c.symbolId === "gate_not";
        const outIdx = isNot ? 1 : 2;
        // Each input reduced to a 0/1 comparison, then combined with >, &&, ||, + and the
        // ternary only. There is deliberately no logical-NOT operator here: inverting by
        // swapping the ternary's arms keeps every expression inside the grammar bsource.ts
        // actually parses, so a gate can never emit an expression the compiler rejects.
        const a = `(V(${nodes[0]}) > ${T})`;
        const b = isNot ? "" : `(V(${nodes[1]}) > ${T})`;
        let expr: string;
        switch (c.symbolId) {
          case "gate_and":  expr = `(${a} && ${b}) ? ${H} : 0`; break;
          case "gate_nand": expr = `(${a} && ${b}) ? 0 : ${H}`; break;
          case "gate_or":   expr = `(${a} || ${b}) ? ${H} : 0`; break;
          case "gate_nor":  expr = `(${a} || ${b}) ? 0 : ${H}`; break;
          case "gate_xor":  expr = `(${a} + ${b} == 1) ? ${H} : 0`; break;
          default:          expr = `${a} ? 0 : ${H}`; break;                    // inverter
        }
        elements.push({ type: "B", name, n1: nodes[outIdx], n2: "0", ctrl: "V", expr });
        break;
      }
      case "tline": {
        const z0 = parseValue(attr(c, "z0", "50"));
        const td = parseValue(attr(c, "td", "1n"));
        if (!isFinite(z0) || z0 <= 0) {
          errors.push({ severity: "error", message: `${name}: characteristic impedance must be a positive number (got "${attr(c, "z0", "50")}").`, location: name });
          break;
        }
        if (!isFinite(td) || td <= 0) {
          errors.push({ severity: "error", message: `${name}: delay must be a positive time (got "${attr(c, "td", "1n")}").`, location: name, hint: "A line with zero delay is a wire - delete it, or give it the one-way propagation time." });
          break;
        }
        elements.push({ type: "T", name, n1: nodes[0], n2: nodes[1], n3: nodes[2], n4: nodes[3], z0, td });
        break;
      }
      case "njf": case "pjf": {
        // The symbol picks the polarity; the model name is a parameter bundle, not a polarity
        // override — exactly the rule the MOSFET and BJT cases follow.
        const isP = c.symbolId === "pjf";
        const mname = attr(c, "model", isP ? "PJF" : "NJF");
        const base = resolveJfet(modelRegistry, mname, isP, errors, name);
        const model = {
          ...base,
          kind: isP ? "pjf" as const : "njf" as const,
          Vto:    num(c, "Vto",    base.Vto),
          Beta:   num(c, "Beta",   base.Beta),
          Lambda: num(c, "Lambda", base.Lambda),
          Rd:     num(c, "Rd",     base.Rd),
          Rs:     num(c, "Rs",     base.Rs),
          Cgs:    num(c, "Cgs",    base.Cgs),
          Cgd:    num(c, "Cgd",    base.Cgd),
          Pb:     num(c, "Pb",     base.Pb),
          Is:     num(c, "Is",     base.Is),
          N:      num(c, "N",      base.N),
          Fc:     num(c, "Fc",     base.Fc),
          Tnom:   num(c, "Tnom",   base.Tnom),
          Kf:     num(c, "Kf",     base.Kf),
          Af:     num(c, "Af",     base.Af),
        };
        // nodes ordered by spiceOrder: D, G, S
        elements.push({ type: "J", name, nD: nodes[0], nG: nodes[1], nS: nodes[2], model, area: num(c, "area", 1) });
        break;
      }
      case "npn": case "pnp": {
        const isP = c.symbolId === "pnp";
        const mname = attr(c, "model", isP ? "PNP" : "NPN");
        const base = resolveBjt(modelRegistry, mname, isP);
        const model = {
          ...base,
          kind: isP ? "pnp" as const : "npn" as const,
          Is:   num(c, "Is",   base.Is),
          Bf:   num(c, "Bf",   base.Bf),
          Br:   num(c, "Br",   base.Br),
          Ne:   num(c, "Ne",   base.Ne),
          Nc:   num(c, "Nc",   base.Nc),
          Vaf:  num(c, "Vaf",  base.Vaf),
          Var:  num(c, "Var",  base.Var),
          Rb:   num(c, "Rb",   base.Rb),
          Rc:   num(c, "Rc",   base.Rc),
          Re:   num(c, "Re",   base.Re),
          Cje:  num(c, "Cje",  base.Cje),
          Vje:  num(c, "Vje",  base.Vje),
          Mje:  num(c, "Mje",  base.Mje),
          Cjc:  num(c, "Cjc",  base.Cjc),
          Vjc:  num(c, "Vjc",  base.Vjc),
          Mjc:  num(c, "Mjc",  base.Mjc),
          Tnom: num(c, "Tnom", base.Tnom),
          XTI:  num(c, "XTI",  base.XTI),
          XTB:  num(c, "XTB",  base.XTB),
          Eg:   num(c, "Eg",   base.Eg),
          // Base-current flicker noise (see DiodeModel note): 0 unless the user fits it.
          Kf:   num(c, "Kf",   (base as { Kf?: number }).Kf ?? 0),
          Af:   num(c, "Af",   (base as { Af?: number }).Af ?? 1),
        };
        // nodes ordered by spiceOrder: C, B, E
        elements.push({ type: "Q", name, nC: nodes[0], nB: nodes[1], nE: nodes[2], model, area: num(c, "area", 1) });
        break;
      }
      case "swtch": case "iswtch": {
        // SPICE S / W. The model card supplies Ron/Roff/Vt(It)/Vh(Ih); per-instance attributes
        // override individual parameters, exactly as they do for D/M/Q.
        const isI = c.symbolId === "iswtch";
        const mname = attr(c, "model", isI ? "CSW" : "SW");
        const base = resolveSwitch(modelRegistry, mname, isI, errors, name);
        const vtrRaw = num(c, isI ? "Itr" : "Vtr", base.Vtr ?? 0);
        const model = {
          kind: isI ? "iswitch" as const : "vswitch" as const,
          Ron:  Math.abs(num(c, "Ron",  base.Ron)) || 1e-9,
          Roff: Math.abs(num(c, "Roff", base.Roff)) || 1e12,
          Vt:   num(c, isI ? "It" : "Vt", base.Vt),
          Vh:   Math.abs(num(c, isI ? "Ih" : "Vh", base.Vh)),
          ...(vtrRaw > 0 ? { Vtr: vtrRaw } : {}),
        };
        if (model.Roff <= model.Ron) {
          errors.push({ severity: "error", message: `${name}: Roff (${model.Roff} Ω) must be greater than Ron (${model.Ron} Ω).`, location: name });
          break;
        }
        if (isI) elements.push({ type: "W", name, n1: nodes[0], n2: nodes[1], vsrc: attr(c, "vctrl", "V1"), model });
        else elements.push({ type: "S", name, n1: nodes[0], n2: nodes[1], nc1: nodes[2], nc2: nodes[3], model });
        break;
      }
      case "vdmos_n": case "vdmos_p": {
        const isP = c.symbolId === "vdmos_p";
        const mname = attr(c, "model", isP ? "VDMOSP" : "VDMOSN");
        const base = resolveVdmos(modelRegistry, mname, isP, errors, name);
        const model = {
          ...base,
          kind: isP ? "vdmos-p" as const : "vdmos-n" as const,
          Vto:    num(c, "Vto",    base.Vto),
          Kp:     Math.abs(num(c, "Kp",     base.Kp)),
          Lambda: Math.abs(num(c, "Lambda", base.Lambda)),
          Rd:     Math.max(num(c, "Rd",  base.Rd), 0),
          Rs:     Math.max(num(c, "Rs",  base.Rs), 0),
          Rg:     Math.max(num(c, "Rg",  base.Rg), 0),
          Rds:    Math.max(num(c, "Rds", base.Rds), 0),
          Cgs:    Math.max(num(c, "Cgs",    base.Cgs), 0),
          Cgdmax: Math.max(num(c, "Cgdmax", base.Cgdmax), 0),
          Cgdmin: Math.max(num(c, "Cgdmin", base.Cgdmin), 0),
          Cgda:   Math.max(num(c, "a",      base.Cgda), 1e-6),
          Rb:     Math.max(num(c, "Rb",     base.Rb), 0),
          Tnom:   num(c, "Tnom", base.Tnom),
          body:   { ...base.body },
        };
        // nodes ordered by spiceOrder: D, G, S
        elements.push({ type: "VDMOS", name, nD: nodes[0], nG: nodes[1], nS: nodes[2], model });
        break;
      }
      case "bvsource": case "bisource": {
        // Behavioral source. The "value" attr is an expression compiled by src/lib/sim/bsource.ts.
        // We compile here too just to surface syntax errors at netlist-build time (the engine
        // also compiles on first stamp, but failing here gives the user a clearer location).
        const expr = (attr(c, "value", "") || "").trim();
        if (!expr) {
          errors.push({ severity: "warning", message: `${name}: expression is empty - set the value attribute to e.g. "V(in) * 2" or "V(in) > 2.5 ? 5 : 0".`, location: name });
          break;
        }
        const r = compileExpr(expr);
        if (r.error) {
          errors.push({ severity: "error", message: `${name}: cannot compile expression "${expr}" - ${r.error}.`, location: name });
          break;
        }
        const ctrl: "V" | "I" = c.symbolId === "bvsource" ? "V" : "I";
        elements.push({ type: "B", name, n1: nodes[0], n2: nodes[1], ctrl, expr });
        break;
      }
      // The 6- and 8-pin DIP bodies belong here too. They were drawn, given functional pin
      // captions, and shipped with full library entries (NE555, LM311) whose models embed on
      // insert — and then omitted from this list, so `add_part` refused to place either of them
      // rather than put a part on the canvas that contributed nothing to the simulation. An X is
      // an X whatever its pin count; the subcircuit expander checks the count against the
      // .subckt definition and reports a mismatch on its own.
      case "subckt2": case "subckt3": case "subckt5": case "subckt6": case "subckt8": {
        // Subcircuit instance - the engine doesn't stamp X directly; we'll expand it via
        // expandSubckts() below into mangled primitive elements. The `name` attribute holds
        // the .subckt name (which must exist in doc.models / the parsed registry).
        const subName = (attr(c, "name", "") || "").trim();
        if (!subName) {
          errors.push({ severity: "warning", message: `${name}: subcircuit name is empty - set the "Subckt" attribute to the name of a .subckt in your model library.`, location: name });
          break;
        }
        elements.push({ type: "X", name, subcktName: subName, nodes });
        break;
      }
      default: errors.push({ severity: "warning", message: `Symbol "${c.symbolId}" (${name}) is not yet simulatable; skipped.` });
    }
  }

  // ---- expand .subckt instances (X elements) into primitive elements ----
  // Source of the subckt registry: doc.models, which the importers (ltspice.ts, kicad.ts, spice.ts)
  // populate with raw .subckt blocks. We parse them lazily here so the user can paste a vendor
  // model file into the directives/models pane and the X instances on the schematic resolve.
  if (elements.some(e => e.type === "X") || doc.models.length > 0) {
    const { registry, errors: subErrors } = parseSubckts(doc.models.join("\n"));
    errors.push(...subErrors);
    // Pass the top-level model registry - subckt bodies can reference these models, and inner
    // .model lines shadow them per SPICE scoping.
    const expanded = expandSubckts(elements, registry, errors, modelRegistry);
    elements.length = 0;
    elements.push(...expanded);
  }

  // ---- post-pass validation ----
  // F/H must reference an existing voltage source by refdes
  const vsrcNames = new Set(elements.filter(e => e.type === "V").map(e => (e as any).name.toUpperCase()));
  for (const el of elements) {
    if (el.type === "F" || el.type === "H" || el.type === "W") {
      if (!vsrcNames.has(el.vsrc.toUpperCase())) {
        errors.push({
          severity: "error",
          message: `${el.type === "F" ? "CCCS" : el.type === "H" ? "CCVS" : "Current-controlled switch"} ${el.name}: controlling voltage source "${el.vsrc}" not found. Place a voltage source in series with the sense branch and set vctrl to its refdes (e.g. V1).`,
          location: el.name,
        });
      }
    }
  }

  // ---- digital logic: kernel design + the bridges where it meets analog nets ----
  let digital: DigitalDesign | undefined;
  if (digitalComps.length) {
    const built = buildDigitalDesign(digitalComps, analogNodesOf(elements), errors);
    elements.push(...built.elements);
    digital = built.design;
  }

  // distinct node names
  const nodeSet = new Set<string>();
  for (const el of elements) {
    if (el.type === "R" || el.type === "C" || el.type === "L") { nodeSet.add(el.n1); nodeSet.add(el.n2); }
    else if (el.type === "V" || el.type === "I") { nodeSet.add(el.n1); nodeSet.add(el.n2); }
    else if (el.type === "D") { nodeSet.add(el.nA); nodeSet.add(el.nK); }
    else if (el.type === "E" || el.type === "G") { nodeSet.add(el.n1); nodeSet.add(el.n2); nodeSet.add(el.nc1); nodeSet.add(el.nc2); }
    else if (el.type === "F" || el.type === "H") { nodeSet.add(el.n1); nodeSet.add(el.n2); }
    else if (el.type === "OPAMP") { nodeSet.add(el.nOut); nodeSet.add(el.nInP); nodeSet.add(el.nInN); }
    else if (el.type === "M") { nodeSet.add(el.nD); nodeSet.add(el.nG); nodeSet.add(el.nS); nodeSet.add(el.nB); }
    else if (el.type === "Q") { nodeSet.add(el.nC); nodeSet.add(el.nB); nodeSet.add(el.nE); }
    else if (el.type === "X") {
      // Any X that survived expandSubckts() refers to an undefined subckt - expandSubckts
      // already logged the error. Add its nodes anyway so they show up in the node list
      // and downstream code doesn't choke on a "dangling" reference.
      for (const n of el.nodes) nodeSet.add(n);
    }
    else if (el.type === "B") { nodeSet.add(el.n1); nodeSet.add(el.n2); }
    else if (el.type === "S") { nodeSet.add(el.n1); nodeSet.add(el.n2); nodeSet.add(el.nc1); nodeSet.add(el.nc2); }
    else if (el.type === "W") { nodeSet.add(el.n1); nodeSet.add(el.n2); }
    else if (el.type === "VDMOS") { nodeSet.add(el.nD); nodeSet.add(el.nG); nodeSet.add(el.nS); }
    else if (el.type === "J") { nodeSet.add(el.nD); nodeSet.add(el.nG); nodeSet.add(el.nS); }
    else if (el.type === "T") { nodeSet.add(el.n1); nodeSet.add(el.n2); nodeSet.add(el.n3); nodeSet.add(el.n4); }
    else if (el.type === "D2A") { nodeSet.add(el.n1); nodeSet.add(el.n2); }
    // K has no nodes of its own - couples two existing L branches
  }
  nodeSet.delete("0");
  const nodes = [...nodeSet];

  // sanity checks
  // Empty circuit - not an outright error (the user may have just opened a fresh doc), but
  // also not silent. `warning` keeps the message visible without the red error-toast styling
  // that "error" triggers in the store's run-state machine.
  if (elements.length === 0 && !digital) errors.push({ severity: "warning", message: "Empty circuit - place some components from the picker to get started." });
  let hasGnd = false; for (const c of Object.values(sheet.components)) if (c.symbolId === "gnd") hasGnd = true;
  // also "0" appearing as a node name (e.g. a label "0")
  for (const el of elements) for (const k of Object.keys(el)) {/* no-op */ }
  const zeroUsed = elements.some(el => Object.values(el).includes("0"));
  if (!hasGnd && !zeroUsed && elements.length > 0) errors.push({ severity: "warning", message: "No ground in the circuit - node voltages will be relative. Add a Ground symbol (or a net labelled 0)." });

  const { analyses, errors: derr, options, ics, nodesets, steps } = parseDirectives(doc, params);
  errors.push(...derr);
  if (analyses.length === 0) analyses.push({ kind: "op" });
  // Validate every sweep axis NOW so the user gets the error before the engine starts churning
  // through values it can't apply. Case-insensitive match because the netlister preserves
  // casing on the refdes column. Passives carry `.value`; sources carry `.dc` - both sweepable.
  for (const s of steps) {
    if (s.what === "temp") continue;                    // always applicable - it's a global option
    if (s.what === "param") {
      if (!paramBindings.some((b) => b.param.toLowerCase() === s.refdes.toLowerCase())) {
        errors.push({
          severity: "error",
          message: `.step param ${s.refdes}: no component value references {${s.refdes}}, so the sweep would change nothing.`,
          hint: `Set a component's value to "{${s.refdes}}" (and keep the ".param ${s.refdes}=…" line).`,
        });
      }
      continue;
    }
    const found = elements.find((e) => "name" in e && e.name.toLowerCase() === s.refdes.toLowerCase());
    if (!found) errors.push({ severity: "error", message: `.step: component "${s.refdes}" not found in the schematic.` });
    else {
      const fv = (found as { value?: unknown; dc?: unknown }).value;
      const fdc = (found as { value?: unknown; dc?: unknown }).dc;
      if (typeof fv !== "number" && typeof fdc !== "number") {
        errors.push({ severity: "error", message: `.step: "${s.refdes}" has no numeric value/dc to sweep.` });
      }
    }
  }
  // Validate .noise targets against the built netlist - a typo'd output node or input source
  // must be an error here, not a mystery empty plot later.
  for (const a of analyses) {
    if (a.kind !== "noise") continue;
    if (a.out !== "0" && !nodeSet.has(a.out)) errors.push({ severity: "error", message: `.noise: output node "${a.out}" is not in the circuit.`, hint: `Known nodes: ${[...nodeSet].slice(0, 8).join(", ")}` });
    if (a.ref && a.ref !== "0" && !nodeSet.has(a.ref)) errors.push({ severity: "error", message: `.noise: reference node "${a.ref}" is not in the circuit.` });
    if (!elements.some((e) => (e.type === "V" || e.type === "I") && e.name.toLowerCase() === a.src.toLowerCase())) {
      errors.push({ severity: "error", message: `.noise: input source "${a.src}" is not an independent V/I source in this circuit.` });
    }
  }

  // Diagnostic: warn if the user set ic= on a cap/inductor but the .tran isn't UIC. The
  // honest SPICE answer is that ic= is only consulted under UIC; without it, the DC operating
  // point determines the initial state and the user's ic= silently does nothing. Surface
  // that explicitly so a confused user can fix it (either add UIC or remove the ic).
  const tranSpecs = analyses.filter((a): a is Analysis & { kind: "tran" } => a.kind === "tran");
  if (tranSpecs.length > 0 && tranSpecs.every((a) => !a.uic)) {
    const elsWithIc = elements.filter((e): e is NetlistElement & { ic?: number } =>
      (e.type === "C" || e.type === "L") && typeof (e as { ic?: number }).ic === "number");
    if (elsWithIc.length > 0) {
      const names = elsWithIc.map((e) => e.name).join(", ");
      errors.push({
        severity: "info",
        message: `ic= set on ${elsWithIc.length} element(s) (${names}) but no transient analysis has UIC - the DC operating point will override the ic values. Add UIC to .tran, e.g. ".tran 1m UIC", or use ".ic V(node)=value" directives instead.`,
      });
    }
  }

  // append K (mutual-coupling) elements after we know the L list
  const lNames = new Set(elements.filter(e => e.type === "L").map(e => (e as any).name.toUpperCase()));
  const { ks, errors: kerr } = parseKDirectives(doc);
  for (const k of ks) {
    if (!lNames.has(k.l1.toUpperCase()) || !lNames.has(k.l2.toUpperCase())) {
      errors.push({ severity: "error", message: `K element "${k.name}": one or both coupled inductors (${k.l1}, ${k.l2}) not found.` });
      continue;
    }
    if (k.l1.toUpperCase() === k.l2.toUpperCase()) {
      errors.push({ severity: "error", message: `K element "${k.name}": cannot couple an inductor to itself (${k.l1}).` });
      continue;
    }
    if (Math.abs(k.k) > 1) {
      errors.push({ severity: "warning", message: `K element "${k.name}": coupling k=${k.k} is outside [-1, 1] - clamped to ±1.` });
    }
    elements.push({ type: "K", name: k.name, l1: k.l1, l2: k.l2, k: Math.max(-1, Math.min(1, k.k)) });
  }
  errors.push(...kerr);

  return {
    elements, nodes, analyses, errors, options, ics,
    // `step` stays the OUTER axis so existing consumers (and tests) that read nl.step.refdes
    // keep working; `steps` carries the full (possibly nested) plan.
    ...(steps.length ? { step: steps[0], steps } : {}),
    ...(nodesets.length ? { nodesets } : {}),
    ...(paramBindings.length ? { paramBindings } : {}),
    ...(digital ? { digital } : {}),
  };
}

/** The net name at a grid point (if it sits on a wire or a component pin); used by the probe tool. */
// Module-level memo - every probe-mode mousemove calls netNameAtPoint(), but the underlying
// net graph only changes when the doc changes. Recomputing union-find on every move kills
// frame rate on big schematics. We key on doc.id + updatedAt + a content fingerprint:
//   • doc.id changes when newDoc()/loadDoc() runs (no collision across distinct docs);
//   • updatedAt advances on every mutate() (catches in-doc edits);
//   • a cheap structural fingerprint of (compCount, wireCount, labelCount, juncCount)
//     guards against the rare case where two distinct docs share both id and updatedAt
//     (e.g. fast-fire imports during tests where Date.now() collides - the I/O round-trip
//     test path hit this and silently returned stale union-find results).
let _netsMemo: { docKey: string; nets: ReturnType<typeof computeNets> } | null = null;
function netsFor(doc: SchematicDoc): ReturnType<typeof computeNets> {
  const sh = doc.sheets[doc.rootSheet];
  const fingerprint = sh
    ? `${Object.keys(sh.components).length}|${Object.keys(sh.wires).length}|${Object.keys(sh.netLabels).length}|${Object.keys(sh.junctions).length}`
    : "0|0|0|0";
  const docKey = `${doc.id ?? ""}|${doc.updatedAt ?? 0}|${doc.rootSheet}|${fingerprint}`;
  if (_netsMemo && _netsMemo.docKey === docKey) return _netsMemo.nets;
  const nets = computeNets(doc);
  _netsMemo = { docKey, nets };
  return nets;
}

export function netNameAtPoint(doc: SchematicDoc, pt: GridPoint): string | null {
  const sheet = doc.sheets[doc.rootSheet];
  const nets = netsFor(doc);
  // Snap incoming query point AND pin coords so we match the snapped grid the rest of the
  // netlist now uses (fix for op-amp pins at y=±12 not finding their nets after build).
  const snap = (v: number) => Math.round(v / 16) * 16;
  const snapPt = (p: GridPoint): GridPoint => ({ x: snap(p.x), y: snap(p.y) });
  const k = keyOf(snapPt(pt));
  for (const c of Object.values(sheet.components)) {
    const sym = SYMBOLS[c.symbolId]; if (!sym) continue;
    for (let i = 0; i < sym.pins.length; i++) {
      if (keyOf(snapPt(pinWorldPos(c, sym, i))) === k) {
        const r = nets.pinRoot.get(`${c.id}#${i}`);
        return r ? (nets.nameOf.get(nets.uf.find(r)) ?? null) : null;
      }
    }
  }
  for (const w of Object.values(sheet.wires)) {
    for (let i = 0; i < w.pts.length - 1; i++) {
      if (onSegment(pt, w.pts[i], w.pts[i + 1])) return nets.nameOf.get(nets.uf.find(`wire:${w.id}`)) ?? null;
    }
  }
  if (nets.uf.parent.has(k)) return nets.nameOf.get(nets.uf.find(k)) ?? null;
  return null;
}

/** Produce a SPICE-style netlist text (for display / export). */
export function netlistToText(doc: SchematicDoc): string {
  const nl = buildNetlist(doc);
  const lines: string[] = [`* ${doc.name} - generated by Volt`];
  // Switch / VDMOS parameters live on the ELEMENT (model card + per-instance overrides already
  // merged), so the export has to emit a private .model card per device. Anything less would be
  // a netlist that reads back as a different circuit - which is worse than not exporting at all.
  const extraModels: string[] = [];
  const g = (x: number) => (Number.isFinite(x) ? String(x) : "0");
  for (const el of nl.elements) {
    if (el.type === "R") lines.push(`R${el.name.replace(/^R/i, "")} ${el.n1} ${el.n2} ${el.value}`);
    else if (el.type === "C") lines.push(`C${el.name.replace(/^C/i, "")} ${el.n1} ${el.n2} ${el.value}${el.ic !== undefined ? ` IC=${el.ic}` : ""}`);
    else if (el.type === "L") lines.push(`L${el.name.replace(/^L/i, "")} ${el.n1} ${el.n2} ${el.value}${el.ic !== undefined ? ` IC=${el.ic}` : ""}`);
    else if (el.type === "V") lines.push(`V${el.name.replace(/^V/i, "")} ${el.n1} ${el.n2} ${srcText(el)}`);
    else if (el.type === "I") lines.push(`I${el.name.replace(/^I/i, "")} ${el.n1} ${el.n2} ${srcText(el)}`);
    else if (el.type === "D") lines.push(`D${el.name.replace(/^D/i, "")} ${el.nA} ${el.nK} ${"D"}`);
    else if (el.type === "OPAMP") lines.push(`* opamp ${el.name}: out=${el.nOut} in+=${el.nInP} in-=${el.nInN} (modeled as E${el.name} ${el.nOut} 0 ${el.nInP} ${el.nInN} ${el.gain})`);
    else if (el.type === "E") lines.push(`E${el.name.replace(/^E/i, "")} ${el.n1} ${el.n2} ${el.nc1} ${el.nc2} ${el.gain}`);
    else if (el.type === "G") lines.push(`G${el.name.replace(/^G/i, "")} ${el.n1} ${el.n2} ${el.nc1} ${el.nc2} ${el.gain}`);
    else if (el.type === "H") lines.push(`H${el.name.replace(/^H/i, "")} ${el.n1} ${el.n2} ${el.vsrc} ${el.gain}`);
    else if (el.type === "F") lines.push(`F${el.name.replace(/^F/i, "")} ${el.n1} ${el.n2} ${el.vsrc} ${el.gain}`);
    else if (el.type === "M") lines.push(`M${el.name.replace(/^M/i, "")} ${el.nD} ${el.nG} ${el.nS} ${el.nB} ${el.model.kind.toUpperCase()} W=${el.model.W} L=${el.model.L}`);
    else if (el.type === "Q") lines.push(`Q${el.name.replace(/^Q/i, "")} ${el.nC} ${el.nB} ${el.nE} ${el.model.kind.toUpperCase()}`);
    else if (el.type === "K") lines.push(`K${el.name.replace(/^K/i, "")} L${el.l1.replace(/^L/i, "")} L${el.l2.replace(/^L/i, "")} ${el.k}`);
    else if (el.type === "S" || el.type === "W") {
      const mn = `${el.type === "S" ? "SWM" : "CSWM"}_${el.name.replace(/[^A-Za-z0-9_]/g, "")}`;
      const m = el.model;
      const isI = el.type === "W";
      lines.push(el.type === "S"
        ? `S${el.name.replace(/^S/i, "")} ${el.n1} ${el.n2} ${el.nc1} ${el.nc2} ${mn}`
        : `W${el.name.replace(/^W/i, "")} ${el.n1} ${el.n2} ${el.vsrc} ${mn}`);
      extraModels.push(
        `.model ${mn} ${isI ? "CSW" : "SW"}(Ron=${g(m.Ron)} Roff=${g(m.Roff)} ` +
        `${isI ? "It" : "Vt"}=${g(m.Vt)} ${isI ? "Ih" : "Vh"}=${g(m.Vh)}` +
        `${m.Vtr && m.Vtr > 0 ? ` ${isI ? "Itr" : "Vtr"}=${g(m.Vtr)}` : ""})`);
    }
    else if (el.type === "J") {
      // Emit the card alongside the element: the JFET's parameters live on the instance after
      // per-instance overrides are folded in, so a bare `NJF` model name would export a device
      // that is not the one that was simulated.
      const mn = `JM_${el.name.replace(/[^A-Za-z0-9_]/g, "")}`;
      const m = el.model;
      lines.push(`J${el.name.replace(/^J/i, "")} ${el.nD} ${el.nG} ${el.nS} ${mn}${el.area && el.area !== 1 ? ` ${el.area}` : ""}`);
      extraModels.push(
        `.model ${mn} ${m.kind === "pjf" ? "PJF" : "NJF"}(Vto=${g(m.Vto)} Beta=${g(m.Beta)} Lambda=${g(m.Lambda)} ` +
        `Rd=${g(m.Rd)} Rs=${g(m.Rs)} Cgs=${g(m.Cgs)} Cgd=${g(m.Cgd)} Pb=${g(m.Pb)} ` +
        `Is=${g(m.Is)} N=${g(m.N)} Fc=${g(m.Fc)} Kf=${g(m.Kf)} Af=${g(m.Af)} Tnom=${g(m.Tnom)})`);
    }
    else if (el.type === "T") {
      lines.push(`T${el.name.replace(/^T/i, "")} ${el.n1} ${el.n2} ${el.n3} ${el.n4} Z0=${g(el.z0)} TD=${g(el.td)}`);
    }
    else if (el.type === "VDMOS") {
      const mn = `VDM_${el.name.replace(/[^A-Za-z0-9_]/g, "")}`;
      const m = el.model, b = m.body;
      lines.push(`M${el.name.replace(/^M/i, "")} ${el.nD} ${el.nG} ${el.nS} ${mn}`);
      extraModels.push(
        `.model ${mn} VDMOS(${m.kind === "vdmos-p" ? "pchan " : ""}Vto=${g(m.Vto)} Kp=${g(m.Kp)} Lambda=${g(m.Lambda)} ` +
        `Rd=${g(m.Rd)} Rs=${g(m.Rs)} Rg=${g(m.Rg)} Rds=${g(m.Rds)} Rb=${g(m.Rb)} ` +
        `Cgs=${g(m.Cgs)} Cgdmax=${g(m.Cgdmax)} Cgdmin=${g(m.Cgdmin)} a=${g(m.Cgda)} ` +
        `Is=${g(b.Is)} N=${g(b.N)} Vj=${g(b.Vj)} M=${g(b.M)} Cjo=${g(b.Cjo)} Bv=${g(b.Bv)} Ibv=${g(b.Ibv)} ` +
        `Tnom=${g(m.Tnom)})`);
    }
  }
  lines.push(...extraModels);
  if (nl.digital) {
    // The digital side is event-driven and simulated by Spice++ itself, so it is written as
    // comments: readable here, ignored by any SPICE that reads this file.
    lines.push("* digital logic (event-driven; simulated by Spice++, not SPICE syntax)");
    for (const p of nl.digital.parts) {
      const pins = [...Object.entries(p.ins), ...Object.entries(p.outs)].filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(" ");
      const prm = Object.entries(p.params ?? {}).map(([k, v]) => `${k}=${typeof v === "number" ? Number(v.toPrecision(6)) : v}`).join(" ");
      lines.push(`* ${p.name} ${p.kind} ${pins}${prm ? ` ${prm}` : ""}`);
    }
    for (const b of nl.digital.a2d) lines.push(`* ${b.name} a2d V(${b.node}) -> ${b.signal} rise ${b.vhi} V fall ${b.vlo} V`);
    for (const el of nl.elements) if (el.type === "D2A") lines.push(`* ${el.name} d2a ${el.bits.join(",")} -> V(${el.n1}) ${el.v0} V + ${Number(el.vstep.toPrecision(6))} V/code rout=${el.rout} tr=${el.tr} tf=${el.tf}`);
  }
  lines.push(".model D D(Is=1e-14 N=1 Rs=0 Cjo=0 Vj=0.7 M=0.5 Bv=0)");
  lines.push(".model NMOS NMOS(Vto=1 Kp=2e-5 Lambda=0.02 Gamma=0.5 Phi=0.6)");
  lines.push(".model PMOS PMOS(Vto=-1 Kp=1e-5 Lambda=0.02 Gamma=0.4 Phi=0.6)");
  lines.push(".model NPN NPN(Is=1e-15 Bf=100 Br=1 Vaf=100 Cje=0 Cjc=0)");
  lines.push(".model PNP PNP(Is=1e-15 Bf=100 Br=1 Vaf=100 Cje=0 Cjc=0)");
  for (const d of doc.directives) if (d.enabled) lines.push(d.text);
  lines.push(".end");
  return lines.join("\n");
}
function srcText(el: any): string {
  let s = "";
  if (el.dc) s += `DC ${el.dc} `;
  if (el.ac) s += `AC ${el.ac.mag}${el.ac.phase ? " " + el.ac.phase : ""} `;
  if (el.tran) {
    const t = el.tran;
    if (t.kind === "sin") s += `SIN(${t.voff} ${t.vamp} ${t.freq} ${t.td} ${t.theta} ${t.phase})`;
    else if (t.kind === "pulse") s += `PULSE(${t.v1} ${t.v2} ${t.td} ${t.tr} ${t.tf} ${t.pw} ${t.per})`;
    else if (t.kind === "exp") s += `EXP(${t.v1} ${t.v2} ${t.td1} ${t.tau1} ${t.td2} ${t.tau2})`;
    else if (t.kind === "pwl") s += `PWL(${t.points.map((p: number[]) => p.join(" ")).join(" ")})`;
    else if (t.kind === "sffm") s += `SFFM(${t.voff} ${t.vamp} ${t.fc} ${t.mdi} ${t.fs})`;
    else if (t.kind === "am") s += `AM(${t.vamp} ${t.voff} ${t.fm} ${t.fc} ${t.td})`;
  }
  return s.trim() || "0";
}
