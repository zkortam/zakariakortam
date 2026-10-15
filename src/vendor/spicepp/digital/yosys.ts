/**
 * Loader for Yosys `write_json` netlists (word-level cells after `proc; opt`, optionally
 * `memory -nomap`, or fine-grained cells after `techmap`).
 *
 * - Hierarchy is flattened here: an instance of another module in the file is expanded in
 *   place, its nets and cells prefixed "<instance>.". Bits a module routes straight from one
 *   port to another become one net in the parent; a port bit tied to a constant inside the
 *   child gets a constant driver on the parent net.
 * - Every cell keeps its `src` attribute (e.g. "top.v:12.3-12.20"), so change records map back
 *   to source lines.
 * - `init` attributes on wires give flip-flop power-on values; elsewhere registers start X, or 0
 *   with `initRegisters: "zero"` (matching 2-state simulators such as CXXRTL).
 * - Loose `$memrd` / `$memwr` / `$meminit` cells are grouped by MEMID with the module's
 *   `memories` entry into one memory; `$mem` / `$mem_v2` load directly.
 * - An unimplemented cell type is a `unknown-cell` error naming the type, cell and source line.
 */

import { DigitalSimError } from "./errors";
import type { CellDef, DelaySpec, NetlistIR, SignalDef, SignalKind } from "./kernel";
import { LX, codesToBig } from "./logic";
import { memoryCell, type MemReadPort, type MemSpec, type MemWritePort } from "./memory";
import { IGNORED_CELLS, paramBits, paramInt, yosysCellDef, type CellContext, type Param, type RawCell } from "./yosys_cells";

type Bit = number | string;

export interface YosysPort { direction: "input" | "output" | "inout"; bits: Bit[]; offset?: number; upto?: number; signed?: number }
export interface YosysCell {
  hide_name?: number;
  type: string;
  parameters?: Record<string, string | number>;
  attributes?: Record<string, string | number>;
  port_directions?: Record<string, "input" | "output" | "inout">;
  connections: Record<string, Bit[]>;
}
export interface YosysNet { hide_name?: number; bits: Bit[]; attributes?: Record<string, string | number>; offset?: number; upto?: number; signed?: number }
export interface YosysMemory { hide_name?: number; attributes?: Record<string, string | number>; width: number; start_offset: number; size: number }
export interface YosysModule {
  attributes?: Record<string, string | number>;
  ports?: Record<string, YosysPort>;
  cells?: Record<string, YosysCell>;
  netnames?: Record<string, YosysNet>;
  memories?: Record<string, YosysMemory>;
}
export interface YosysJson { creator?: string; modules: Record<string, YosysModule> }

export interface YosysLoadOptions {
  /** Top module; defaults to the module marked `top`, else the single uninstantiated module. */
  top?: string;
  /** Power-on value of registers and memories without an `init`: "x" (default) or "zero". */
  initRegisters?: "x" | "zero";
  /** Delay applied to every cell output (default 0: pure delta-cycle timing). */
  cellDelay?: DelaySpec;
}

export interface YosysDesign extends NetlistIR {
  top: string;
}

const CONST: Record<string, number> = { "0": 0, "1": 1, z: 2, x: 3, Z: 2, X: 3 };

function parseParam(v: string | number): Param {
  if (typeof v === "number") return v;
  if (/^[01xz]+$/.test(v)) {
    const bits = new Uint8Array(v.length);
    for (let i = 0; i < v.length; i++) bits[v.length - 1 - i] = CONST[v[i]];
    return { bits };
  }
  // Yosys appends one space to a string parameter that would otherwise read as a bit string.
  return { str: / $/.test(v) && /^[01xz]+$/.test(v.slice(0, -1)) ? v.slice(0, -1) : v };
}

function attrStr(a: Record<string, string | number> | undefined, key: string): string | undefined {
  const v = a?.[key];
  return v === undefined ? undefined : String(v);
}

function attrTrue(a: Record<string, string | number> | undefined, key: string): boolean {
  const v = a?.[key];
  if (v === undefined) return false;
  if (typeof v === "number") return v !== 0;
  return /1/.test(v);
}

const stripName = (s: string) => (s.startsWith("\\") ? s.slice(1) : s);

/** Port directions of the built-in cell types, used when `port_directions` is absent. */
function builtinDir(type: string, port: string): "input" | "output" {
  const outs = new Set(["Y", "Q", "X", "CO", "RD_DATA", "DATA"]);
  if (type === "$memwr" || type === "$memwr_v2" || type === "$meminit" || type === "$meminit_v2") return "input";
  return outs.has(port) ? "output" : "input";
}

interface LooseMem { name: string; src?: string; rd: RawCell[]; wr: RawCell[]; init: RawCell[]; info?: YosysMemory }

export function loadYosys(input: string | YosysJson, opts: YosysLoadOptions = {}): YosysDesign {
  let json: YosysJson;
  try { json = typeof input === "string" ? JSON.parse(input) : input; }
  catch (e) { throw new DigitalSimError("bad-netlist", `netlist is not valid JSON: ${(e as Error).message}`); }
  if (!json || typeof json !== "object" || !json.modules || typeof json.modules !== "object")
    throw new DigitalSimError("bad-netlist", "not a Yosys JSON netlist (no \"modules\" object)");
  const mods = json.modules;
  const top = pickTop(mods, opts.top);

  // Net allocation with union-find, so bits a child routes between ports merge in the parent.
  let next = 4;
  const parent: number[] = [0, 1, 2, 3];
  const alloc = () => { parent.push(next); return next++; };
  const find = (n: number): number => { while (parent[n] !== n) { parent[n] = parent[parent[n]]; n = parent[n]; } return n; };
  const union = (a: number, b: number) => { a = find(a); b = find(b); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); };

  const raws: RawCell[] = [];
  const signals: SignalDef[] = [];
  const warnings: string[] = [];
  const initBits = new Map<number, number>();
  const looseMems = new Map<string, LooseMem>();
  const ties: { net: number; value: number; name: string; src?: string }[] = [];

  const instantiate = (modName: string, prefix: string, binding: Map<string, number[]> | null, path: string[]) => {
    if (path.includes(modName)) throw new DigitalSimError("bad-netlist", `module "${modName}" instantiates itself (${[...path, modName].join(" → ")})`);
    const mod = mods[modName];
    const bitMap = new Map<number, number>();
    const net = (b: Bit): number => {
      if (typeof b === "string") {
        const c = CONST[b];
        if (c === undefined) throw new DigitalSimError("bad-netlist", `bad bit "${b}" in module "${modName}"`);
        return c;
      }
      let n = bitMap.get(b);
      if (n === undefined) { n = alloc(); bitMap.set(b, n); }
      return n;
    };
    const ports = mod.ports ?? {};
    if (binding) {
      for (const [pname, p] of Object.entries(ports)) {
        const outer = binding.get(pname);
        p.bits.forEach((b, k) => {
          const o = outer?.[k];
          if (typeof b === "string") {
            // A child port bit that is a constant inside the child: the parent net sees a driver.
            if (o !== undefined && o >= 4 && p.direction !== "input") ties.push({ net: o, value: CONST[b], name: `${prefix}${pname}[${k}]` });
            return;
          }
          if (o === undefined) { net(b); return; }
          const have = bitMap.get(b);
          if (have === undefined) { bitMap.set(b, o); return; }
          if (have >= 4 && o >= 4) union(have, o);
          else if (have >= 4 && o < 4) ties.push({ net: have, value: o, name: `${prefix}${pname}[${k}]` });
          else if (have < 4 && o >= 4) ties.push({ net: o, value: have, name: `${prefix}${pname}[${k}]` });
        });
      }
    } else {
      for (const p of Object.values(ports)) p.bits.forEach(b => net(b));
    }

    for (const [cname, c] of Object.entries(mod.cells ?? {})) {
      const fullName = prefix + stripName(cname);
      const src = attrStr(c.attributes, "src");
      const conns: Record<string, number[]> = {};
      for (const [pn, bits] of Object.entries(c.connections ?? {})) conns[pn] = bits.map(net);
      const sub = mods[c.type];
      if (sub && !attrTrue(sub.attributes, "blackbox")) {
        instantiate(c.type, fullName + ".", new Map(Object.entries(conns)), [...path, modName]);
        continue;
      }
      if (IGNORED_CELLS.has(c.type)) { warnings.push(`ignored ${c.type} cell "${fullName}"${src ? ` (${src})` : ""}: no simulation behaviour`); continue; }
      const params: Record<string, Param> = {};
      for (const [k, v] of Object.entries(c.parameters ?? {})) params[k] = parseParam(v);
      const dirs: Record<string, "input" | "output" | "inout"> = {};
      for (const pn of Object.keys(conns)) dirs[pn] = c.port_directions?.[pn] ?? builtinDir(c.type, pn);
      const raw: RawCell = { name: fullName, type: c.type, src, params, conns, dirs };
      if (/^\$mem(rd|wr|init)(_v2)?$/.test(c.type)) {
        const p = params.MEMID;
        if (!p || typeof p === "number" || !("str" in p)) throw new DigitalSimError("bad-netlist", `${c.type} cell "${fullName}" has no MEMID`, { cell: fullName, src });
        const id = prefix + stripName(p.str);
        let m = looseMems.get(id);
        if (!m) looseMems.set(id, (m = { name: id, rd: [], wr: [], init: [] }));
        (c.type.startsWith("$memrd") ? m.rd : c.type.startsWith("$memwr") ? m.wr : m.init).push(raw);
        continue;
      }
      raws.push(raw);
    }

    for (const [mname, mem] of Object.entries(mod.memories ?? {})) {
      const id = prefix + stripName(mname);
      let m = looseMems.get(id);
      if (!m) looseMems.set(id, (m = { name: id, rd: [], wr: [], init: [] }));
      m.info = mem;
      m.src = attrStr(mem.attributes, "src");
    }

    const seen = new Set<string>();
    const addSignal = (name: string, bits: Bit[], kind: SignalKind, hidden: boolean, src?: string) => {
      const full = prefix + stripName(name);
      if (seen.has(full)) return;
      seen.add(full);
      signals.push({ name: full, nets: bits.map(net), kind, hidden, src });
    };
    for (const [pname, p] of Object.entries(ports)) {
      const nn = mod.netnames?.[pname];
      addSignal(pname, p.bits, binding ? "wire" : p.direction, false, attrStr(nn?.attributes, "src"));
    }
    for (const [nname, nn] of Object.entries(mod.netnames ?? {})) {
      addSignal(nname, nn.bits, "wire", !!nn.hide_name, attrStr(nn.attributes, "src"));
      const init = nn.attributes?.init;
      if (init !== undefined) {
        const bits = paramBits(parseParam(init), nn.bits.length, LX);
        nn.bits.forEach((b, i) => { if (typeof b === "number" && bits[i] < 2) initBits.set(net(b), bits[i]); });
      }
    }
  };

  instantiate(top, "", null, []);

  // Compact union-find representatives into dense net ids (constants stay 0..3).
  const dense = new Map<number, number>();
  let netCount = 4;
  const map = (n: number): number => {
    if (n < 4) return n;
    const r = find(n);
    let d = dense.get(r);
    if (d === undefined) { d = netCount++; dense.set(r, d); }
    return d;
  };
  for (const s of signals) s.nets = s.nets.map(map);
  for (const r of raws) for (const k of Object.keys(r.conns)) r.conns[k] = r.conns[k].map(map);
  for (const m of looseMems.values()) for (const r of [...m.rd, ...m.wr, ...m.init]) for (const k of Object.keys(r.conns)) r.conns[k] = r.conns[k].map(map);
  const init = new Map<number, number>();
  for (const [n, v] of initBits) init.set(map(n), v);

  const zero = opts.initRegisters === "zero";
  const ctx: CellContext = {
    initOf: nets => Uint8Array.from(nets, n => init.get(n) ?? (zero ? 0 : LX)),
    undefTo: zero ? 0 : LX,
    delay: opts.cellDelay,
  };

  const cells: CellDef[] = [];
  for (const r of raws) {
    if (r.type === "$mem" || r.type === "$mem_v2") { cells.push(memoryCell(memFromCell(r, ctx))); continue; }
    const def = yosysCellDef(r, ctx);
    if (!def) throw new DigitalSimError("unknown-cell", `unsupported cell type ${r.type} (cell "${r.name}"${r.src ? ` at ${r.src}` : ""})`, { cellType: r.type, cell: r.name, src: r.src });
    cells.push(def);
  }
  for (const m of looseMems.values()) {
    if (!m.rd.length && !m.wr.length && !m.init.length) continue;
    cells.push(memoryCell(memFromLoose(m, ctx)));
  }
  const tieGroups = new Map<string, { nets: number[]; codes: number[] }>();
  for (const t of ties) {
    const key = t.name.replace(/\[\d+\]$/, "");
    let g = tieGroups.get(key);
    if (!g) tieGroups.set(key, (g = { nets: [], codes: [] }));
    g.nets.push(map(t.net)); g.codes.push(t.value);
  }
  for (const [name, g] of tieGroups) {
    const codes = Uint8Array.from(g.codes);
    cells.push({ type: "$tie", name: `${name}$tie`, inputs: {}, outputs: { Y: { nets: g.nets } }, sequential: true, create: () => (k, c) => { if (c.first) k.drive(c.outs[0], codes); } });
  }
  return { top, netCount, signals, cells, warnings };
}

function pickTop(mods: Record<string, YosysModule>, want?: string): string {
  const names = Object.keys(mods);
  if (want !== undefined) {
    if (!mods[want]) throw new DigitalSimError("bad-netlist", `no module named "${want}" (have: ${names.join(", ")})`, { modules: names });
    return want;
  }
  const marked = names.filter(n => attrTrue(mods[n].attributes, "top"));
  if (marked.length === 1) return marked[0];
  const used = new Set<string>();
  for (const m of Object.values(mods)) for (const c of Object.values(m.cells ?? {})) used.add(c.type);
  const roots = names.filter(n => !used.has(n) && !attrTrue(mods[n].attributes, "blackbox"));
  if (roots.length === 1) return roots[0];
  throw new DigitalSimError("bad-netlist", `cannot tell which module is the top (candidates: ${roots.join(", ") || "none"}); pass the top option`, { candidates: roots });
}

// ─────────────── memories ───────────────

const bitAt = (bits: Uint8Array, i: number) => (i < bits.length ? bits[i] : 0) === 1;

function initWords(p: Param | undefined, size: number, width: number, undefTo: number): Uint8Array {
  // simlib: memory[i] = INIT >>> (i*WIDTH) with INIT signed, so missing high bits copy its MSB.
  const n = size * width;
  const src = paramBits(p);
  const out = new Uint8Array(n);
  const pad = src.length ? src[src.length - 1] : LX;
  for (let i = 0; i < n; i++) { const v = i < src.length ? src[i] : pad; out[i] = v > 1 ? undefTo : v; }
  return out;
}

function memFromCell(r: RawCell, ctx: CellContext): MemSpec {
  const v2 = r.type === "$mem_v2";
  const size = paramInt(r, "SIZE"), width = paramInt(r, "WIDTH"), abits = paramInt(r, "ABITS"), offset = paramInt(r, "OFFSET", 0);
  const nrd = paramInt(r, "RD_PORTS"), nwr = paramInt(r, "WR_PORTS");
  const P = (k: string) => paramBits(r.params[k]);
  const c = (k: string) => r.conns[k] ?? [];
  const rdClkEn = P("RD_CLK_ENABLE"), rdClkPol = P("RD_CLK_POLARITY");
  const rdTransp = v2 ? P("RD_TRANSPARENCY_MASK") : P("RD_TRANSPARENT"), rdColl = P("RD_COLLISION_X_MASK"), rdCeOver = P("RD_CE_OVER_SRST");
  const rdArstV = P("RD_ARST_VALUE"), rdSrstV = P("RD_SRST_VALUE"), rdInitV = P("RD_INIT_VALUE");
  const wrClkEn = P("WR_CLK_ENABLE"), wrClkPol = P("WR_CLK_POLARITY");
  const val = (bits: Uint8Array, i: number) => Uint8Array.from({ length: width }, (_, b) => {
    const k = i * width + b;
    const v = k < bits.length ? bits[k] : v2 ? 0 : LX;
    return v > 1 ? ctx.undefTo : v;
  });
  const rd: MemReadPort[] = [];
  for (let i = 0; i < nrd; i++) {
    rd.push({
      clkEnable: bitAt(rdClkEn, i), clkPolarity: bitAt(rdClkPol, i),
      clk: c("RD_CLK")[i] ?? 0, en: c("RD_EN")[i] ?? 1, arst: c("RD_ARST")[i] ?? 0, srst: c("RD_SRST")[i] ?? 0,
      addr: c("RD_ADDR").slice(i * abits, i * abits + abits), data: c("RD_DATA").slice(i * width, i * width + width),
      // v1 $mem: RD_TRANSPARENT is per read port and applies to every write port.
      transparent: Array.from({ length: nwr }, (_, j) => (v2 ? bitAt(rdTransp, i * nwr + j) : bitAt(rdTransp, i))),
      collisionX: Array.from({ length: nwr }, (_, j) => bitAt(rdColl, i * nwr + j)),
      arstValue: val(rdArstV, i), srstValue: val(rdSrstV, i), initValue: v2 ? val(rdInitV, i) : new Uint8Array(width).fill(ctx.undefTo),
      ceOverSrst: bitAt(rdCeOver, i),
    });
  }
  const wr: MemWritePort[] = [];
  for (let j = 0; j < nwr; j++) {
    wr.push({
      clkEnable: bitAt(wrClkEn, j), clkPolarity: bitAt(wrClkPol, j), clk: c("WR_CLK")[j] ?? 0,
      en: c("WR_EN").slice(j * width, j * width + width), addr: c("WR_ADDR").slice(j * abits, j * abits + abits), data: c("WR_DATA").slice(j * width, j * width + width),
    });
  }
  return { name: r.name, src: r.src, type: r.type, size, offset, width, init: initWords(r.params.INIT, size, width, ctx.undefTo), rd, wr, delay: ctx.delay };
}

function memFromLoose(m: LooseMem, ctx: CellContext): MemSpec {
  const any = m.rd[0] ?? m.wr[0] ?? m.init[0];
  const width = m.info?.width ?? paramInt(any, "WIDTH");
  const offset = m.info?.start_offset ?? 0;
  const abits = Math.max(1, ...[...m.rd, ...m.wr].map(r => paramInt(r, "ABITS", 1)));
  const size = m.info?.size ?? 2 ** abits;
  const c = (r: RawCell, k: string) => r.conns[k] ?? [];
  // Write ports in priority order: v1 PRIORITY, v2 PORTID (transparency masks index by PORTID).
  const wrs = [...m.wr].sort((a, b) => (a.type === "$memwr_v2" ? paramInt(a, "PORTID", 0) - paramInt(b, "PORTID", 0) : paramInt(a, "PRIORITY", 0) - paramInt(b, "PRIORITY", 0)));
  const portIds = wrs.map(w => (w.type === "$memwr_v2" ? paramInt(w, "PORTID", 0) : -1));
  const wr: MemWritePort[] = wrs.map(w => ({
    clkEnable: paramInt(w, "CLK_ENABLE", 0) !== 0, clkPolarity: paramInt(w, "CLK_POLARITY", 1) !== 0, clk: c(w, "CLK")[0] ?? 0,
    en: c(w, "EN"), addr: c(w, "ADDR"), data: c(w, "DATA"),
  }));
  const wordVal = (r: RawCell, k: string) => paramBits(r.params[k], width).map(v => (v > 1 ? ctx.undefTo : v));
  const rd: MemReadPort[] = m.rd.map(r => {
    const v2 = r.type === "$memrd_v2";
    const clkEnable = paramInt(r, "CLK_ENABLE", 0) !== 0;
    const tmask = v2 ? paramBits(r.params.TRANSPARENCY_MASK) : null;
    const cmask = v2 ? paramBits(r.params.COLLISION_X_MASK) : null;
    const transparentAll = !v2 && paramInt(r, "TRANSPARENT", 0) !== 0;
    return {
      clkEnable, clkPolarity: paramInt(r, "CLK_POLARITY", 1) !== 0, clk: c(r, "CLK")[0] ?? 0, en: c(r, "EN")[0] ?? 1,
      arst: c(r, "ARST")[0] ?? 0, srst: c(r, "SRST")[0] ?? 0, addr: c(r, "ADDR"), data: c(r, "DATA"),
      transparent: portIds.map(id => (v2 ? bitAt(tmask!, id) : transparentAll)),
      collisionX: portIds.map(id => (v2 ? bitAt(cmask!, id) : false)),
      arstValue: v2 ? wordVal(r, "ARST_VALUE") : new Uint8Array(width), srstValue: v2 ? wordVal(r, "SRST_VALUE") : new Uint8Array(width),
      initValue: v2 ? wordVal(r, "INIT_VALUE") : new Uint8Array(width).fill(ctx.undefTo), ceOverSrst: v2 && paramInt(r, "CE_OVER_SRST", 0) !== 0,
    };
  });
  const init = new Uint8Array(size * width).fill(ctx.undefTo);
  const inits = [...m.init].sort((a, b) => paramInt(a, "PRIORITY", 0) - paramInt(b, "PRIORITY", 0));
  for (const r of inits) {
    const words = paramInt(r, "WORDS", 1);
    const addrNets = c(r, "ADDR");
    const addrBits = Uint8Array.from(addrNets, n => (n < 4 ? n : LX));
    const addr = codesToBig(addrBits, 0, addrBits.length);
    if (addr === null) throw new DigitalSimError("bad-netlist", `${r.type} "${r.name}" has a non-constant address`, { cell: r.name, src: r.src });
    const data = c(r, "DATA").map(n => (n < 4 ? n : LX));
    const en = r.type === "$meminit_v2" ? c(r, "EN").map(n => (n < 4 ? n : LX)) : null;
    for (let w = 0; w < words; w++) {
      const idx = Number(addr) + w - offset;
      if (idx < 0 || idx >= size) continue;
      for (let b = 0; b < width; b++) {
        if (en && en[b] !== 1) continue;
        const v = data[w * width + b];
        init[idx * width + b] = v > 1 ? ctx.undefTo : v;
      }
    }
  }
  return { name: m.name, src: m.src ?? any?.src, type: "$mem", size, offset, width, init, rd, wr, delay: ctx.delay };
}
