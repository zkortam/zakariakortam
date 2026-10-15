/**
 * Behaviour of Yosys internal cells, written against simlib.v / simcells.v (the Verilog models
 * that define what each cell means), so X propagation follows Verilog:
 *   - operands are extended to the result width, sign-extended only when the cell's operands are
 *     signed (both A_SIGNED and B_SIGNED for two-operand cells, as simlib's generate blocks do);
 *   - bitwise cells use the 3-valued tables (0 & x = 0); Z on an input reads as X;
 *   - arithmetic and relational cells give all-X when any operand bit is X/Z; == gives 0 when a
 *     defined bit pair differs and X otherwise; shifts move X bits and give all-X for an unknown
 *     shift amount;
 *   - a mux with an unknown select merges its inputs bitwise (equal bits pass, others go X);
 *   - flip-flops are the simlib `always @(posedge ...)` processes: they act only on edges of the
 *     clock or async controls, and an unknown condition in `if (...)` takes the else branch.
 * One deliberate departure: $pmux treats a Z select bit as X (simlib's `case` would ignore it).
 */

import { DigitalSimError } from "./errors";
import type { CellDef, CellEval, DelaySpec, OutputDef } from "./kernel";
import { AND, BUF, LX, LZ, MERGE, NOT, OR, XOR, anyUndef, bigToCodes, codesToBig, codesToSigned } from "./logic";

export type Param = { bits: Uint8Array } | { str: string } | number;

export interface RawCell {
  name: string;
  type: string;
  src?: string;
  params: Record<string, Param>;
  conns: Record<string, number[]>;
  dirs: Record<string, "input" | "output" | "inout">;
}

export interface CellContext {
  /** Initial value for nets (from `init` attributes), X or 0 elsewhere per options. */
  initOf(nets: number[]): Uint8Array;
  /** Value used where a Yosys parameter holds X (memory INIT, reset values): X, or 0 in zero-init mode. */
  undefTo: number;
  delay?: DelaySpec;
}

// ─────────────── parameter access ───────────────

export function paramBits(p: Param | undefined, width?: number, fill = 0): Uint8Array {
  let bits: Uint8Array;
  if (p === undefined) bits = new Uint8Array(0);
  else if (typeof p === "number") { bits = new Uint8Array(Math.max(32, width ?? 0)); bigToCodes(BigInt(p), bits.length, bits); }
  else if ("bits" in p) bits = p.bits;
  else { // string parameter: Verilog packs it as 8-bit characters, last character in the LSBs
    const s = p.str;
    bits = new Uint8Array(s.length * 8);
    for (let i = 0; i < s.length; i++) { const ch = s.charCodeAt(s.length - 1 - i); for (let b = 0; b < 8; b++) bits[i * 8 + b] = (ch >> b) & 1; }
  }
  if (width === undefined) return bits;
  const out = new Uint8Array(width).fill(fill);
  out.set(bits.subarray(0, Math.min(width, bits.length)));
  return out;
}

export function paramInt(c: RawCell, name: string, def?: number): number {
  const p = c.params[name];
  if (p === undefined) {
    if (def !== undefined) return def;
    throw new DigitalSimError("bad-netlist", `cell "${c.name}" (${c.type}) is missing parameter ${name}`, { cell: c.name, cellType: c.type, param: name });
  }
  if (typeof p === "number") return p;
  if ("str" in p) {
    const n = Number(p.str.trim());
    if (Number.isInteger(n)) return n;
    throw new DigitalSimError("bad-netlist", `parameter ${name} of "${c.name}" is not a number`, { cell: c.name, param: name });
  }
  const v = codesToBig(p.bits, 0, p.bits.length);
  if (v === null) throw new DigitalSimError("bad-netlist", `parameter ${name} of "${c.name}" has undefined bits`, { cell: c.name, param: name });
  // Yosys writes 32-bit integer parameters; a set top bit of a 32-bit value is a negative int.
  const n = p.bits.length === 32 && p.bits[31] === 1 ? Number(v) - 2 ** 32 : Number(v);
  return n;
}

const pbool = (c: RawCell, name: string, def = 0) => paramInt(c, name, def) !== 0;

// ─────────────── code-vector helpers ───────────────

/** Extend (sign or zero) or truncate to w; sign extension copies the MSB code, X included. */
function ext(a: Uint8Array, w: number, signed: boolean): Uint8Array {
  if (a.length === w) return a;
  const out = new Uint8Array(w);
  const n = Math.min(w, a.length);
  out.set(a.subarray(0, n));
  const pad = signed && a.length ? a[a.length - 1] : 0;
  if (pad) out.fill(pad, n);
  return out;
}

const allX = (w: number) => new Uint8Array(w).fill(LX);
/** 1-bit result zero-extended to w. */
function bit0(v: number, w: number): Uint8Array { const out = new Uint8Array(w); if (w) out[0] = v; return out; }
function reduceAnd(a: Uint8Array): number { let r = 1; for (let i = 0; i < a.length; i++) { r = AND[r * 4 + a[i]]; if (r === 0) return 0; } return r; }
function reduceOr(a: Uint8Array): number { let r = 0; for (let i = 0; i < a.length; i++) { r = OR[r * 4 + a[i]]; if (r === 1) return 1; } return r; }
function reduceXor(a: Uint8Array): number { let r = 0; for (let i = 0; i < a.length; i++) r = XOR[r * 4 + a[i]]; return r; }
function val(a: Uint8Array, signed: boolean): bigint | null { return signed ? codesToSigned(a, 0, a.length) : codesToBig(a, 0, a.length); }
function fromBig(v: bigint, w: number): Uint8Array { return bigToCodes(v, w, new Uint8Array(w)); }

/** 3-valued A == B after both are extended to a common width. */
function eq3(a: Uint8Array, b: Uint8Array): number {
  let und = false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x < 2 && y < 2) { if (x !== y) return 0; } else und = true;
  }
  return und ? LX : 1;
}

/** 3-valued truth of a whole vector used as a condition (Verilog `if (v)` / `!v`). */
const truth = reduceOr;

/** 1 when sig == pol (both defined), X when sig is undefined, else 0. */
function polEq(sig: number, pol: boolean): number { return sig > 1 ? LX : (sig === 1) === pol ? 1 : 0; }
/** Verilog posedge on a 0/1/X signal: 0→1, 0→x, x→1. */
const posedge = (prev: number, cur: number) => (prev === 0 && cur !== 0) || (prev === LX && cur === 1);

function shiftAmount(b: Uint8Array, signed: boolean): bigint | null { return val(b, signed); }

// ─────────────── word-level combinational cells ───────────────

type Comb = (ins: Uint8Array[]) => Uint8Array;

function combCell(c: RawCell, ctx: CellContext, inNames: string[], outName: string, f: Comb): CellDef {
  const inputs: Record<string, number[]> = {};
  for (const n of inNames) inputs[n] = need(c, n);
  return {
    type: c.type, name: c.name, src: c.src, inputs,
    outputs: { [outName]: out(c, outName, ctx) },
    create: (): CellEval => (k, cell) => k.drive(cell.outs[0], f(cell.ins.map(n => k.read(n)))),
  };
}

function need(c: RawCell, port: string): number[] {
  const n = c.conns[port];
  if (!n) throw new DigitalSimError("bad-netlist", `cell "${c.name}" (${c.type}) has no connection for port ${port}`, { cell: c.name, cellType: c.type, port, src: c.src });
  return n;
}

function out(c: RawCell, port: string, ctx: CellContext): OutputDef { return { nets: need(c, port), delay: ctx.delay }; }

const BINARY = new Set(["$and", "$or", "$xor", "$xnor", "$add", "$sub", "$mul", "$div", "$mod", "$divfloor", "$modfloor", "$pow", "$lt", "$le", "$gt", "$ge", "$eq", "$ne", "$eqx", "$nex", "$logic_and", "$logic_or", "$shl", "$sshl", "$shr", "$sshr", "$shift", "$shiftx"]);
const UNARY = new Set(["$not", "$pos", "$buf", "$neg", "$reduce_and", "$reduce_or", "$reduce_bool", "$reduce_xor", "$reduce_xnor", "$logic_not"]);

/** Y width from the parameter, checked against the connection. */
function yWidth(c: RawCell): number {
  const yw = paramInt(c, c.type === "$buf" ? "WIDTH" : "Y_WIDTH", need(c, "Y").length);
  if (c.conns.Y.length !== yw) throw new DigitalSimError("bad-netlist", `cell "${c.name}": Y has ${c.conns.Y.length} bits but its width parameter is ${yw}`, { cell: c.name, src: c.src });
  return yw;
}

function binaryCell(c: RawCell, ctx: CellContext): CellDef | null {
  const t = c.type;
  if (!BINARY.has(t)) return null;
  const yw = yWidth(c);
  const as = pbool(c, "A_SIGNED"), bs = pbool(c, "B_SIGNED");
  const both = as && bs;
  const bitwise = (tb: Uint8Array, inv: boolean): Comb => ([a, b]) => {
    const x = ext(a, yw, both), y = ext(b, yw, both), o = new Uint8Array(yw);
    for (let i = 0; i < yw; i++) { const r = tb[x[i] * 4 + y[i]]; o[i] = inv ? NOT[r] : r; }
    return o;
  };
  const arith = (f: (a: bigint, b: bigint) => bigint | null): Comb => ([a, b]) => {
    const x = val(a, both), y = val(b, both);
    if (x === null || y === null) return allX(yw);
    const r = f(x, y);
    return r === null ? allX(yw) : fromBig(r, yw);
  };
  const cmp = (f: (a: bigint, b: bigint) => boolean): Comb => ([a, b]) => {
    const x = val(a, both), y = val(b, both);
    return x === null || y === null ? bit0(LX, yw) : bit0(f(x, y) ? 1 : 0, yw);
  };
  const eqLike = (exact: boolean, neg: boolean): Comb => ([a, b]) => {
    const w = Math.max(a.length, b.length);
    const x = ext(a, w, both), y = ext(b, w, both);
    let r: number;
    if (exact) { r = 1; for (let i = 0; i < w; i++) if (x[i] !== y[i]) { r = 0; break; } }
    else r = eq3(x, y);
    return bit0(neg ? NOT[r] : r, yw);
  };
  const ab = ["A", "B"];
  switch (t) {
    case "$and": return combCell(c, ctx, ab, "Y", bitwise(AND, false));
    case "$or": return combCell(c, ctx, ab, "Y", bitwise(OR, false));
    case "$xor": return combCell(c, ctx, ab, "Y", bitwise(XOR, false));
    case "$xnor": return combCell(c, ctx, ab, "Y", bitwise(XOR, true));
    case "$add": return combCell(c, ctx, ab, "Y", arith((a, b) => a + b));
    case "$sub": return combCell(c, ctx, ab, "Y", arith((a, b) => a - b));
    case "$mul": return combCell(c, ctx, ab, "Y", arith((a, b) => a * b));
    case "$div": return combCell(c, ctx, ab, "Y", arith((a, b) => (b === 0n ? null : a / b)));
    case "$mod": return combCell(c, ctx, ab, "Y", arith((a, b) => (b === 0n ? null : a % b)));
    case "$divfloor": return combCell(c, ctx, ab, "Y", arith((a, b) => {
      if (b === 0n) return null;
      const q = a / b;
      return a % b !== 0n && (a < 0n) !== (b < 0n) ? q - 1n : q;
    }));
    case "$modfloor": return combCell(c, ctx, ab, "Y", arith((a, b) => {
      if (b === 0n) return null;
      const r = a % b;
      return r !== 0n && (r < 0n) !== (b < 0n) ? r + b : r;
    }));
    case "$pow": return combCell(c, ctx, ab, "Y", ([a, b]) => {
      const x = val(a, as), y = val(b, bs);
      if (x === null || y === null) return allX(yw);
      if (y < 0n) {
        if (x === 0n) return allX(yw);
        if (x === 1n) return fromBig(1n, yw);
        if (x === -1n) return fromBig(y % 2n === 0n ? 1n : -1n, yw);
        return fromBig(0n, yw);
      }
      const m = 1n << BigInt(yw);
      let base = ((x % m) + m) % m, e = y, r = 1n % m;
      while (e > 0n) { if (e & 1n) r = (r * base) % m; base = (base * base) % m; e >>= 1n; }
      return fromBig(r, yw);
    });
    case "$lt": return combCell(c, ctx, ab, "Y", cmp((a, b) => a < b));
    case "$le": return combCell(c, ctx, ab, "Y", cmp((a, b) => a <= b));
    case "$gt": return combCell(c, ctx, ab, "Y", cmp((a, b) => a > b));
    case "$ge": return combCell(c, ctx, ab, "Y", cmp((a, b) => a >= b));
    case "$eq": return combCell(c, ctx, ab, "Y", eqLike(false, false));
    case "$ne": return combCell(c, ctx, ab, "Y", eqLike(false, true));
    case "$eqx": return combCell(c, ctx, ab, "Y", eqLike(true, false));
    case "$nex": return combCell(c, ctx, ab, "Y", eqLike(true, true));
    case "$logic_and": return combCell(c, ctx, ab, "Y", ([a, b]) => bit0(AND[truth(a) * 4 + truth(b)], yw));
    case "$logic_or": return combCell(c, ctx, ab, "Y", ([a, b]) => bit0(OR[truth(a) * 4 + truth(b)], yw));
    case "$shl": case "$sshl": case "$shr": case "$sshr": case "$shift": return combCell(c, ctx, ab, "Y", ([a, b]) => {
      // Shift amount is unsigned except for $shift with B_SIGNED (negative shifts left).
      const s = shiftAmount(b, t === "$shift" && bs);
      if (s === null) return allX(yw);
      const left = t === "$shl" || t === "$sshl" || (t === "$shift" && s < 0n);
      const mag = s < 0n ? -s : s;
      const W = Math.max(a.length, yw);
      const x = ext(a, W, as);
      const fill = t === "$sshr" && as ? x[W - 1] : 0;
      const o = new Uint8Array(yw);
      const n = mag > BigInt(W) ? W + 1 : Number(mag);
      for (let i = 0; i < yw; i++) {
        const src = left ? i - n : i + n;
        o[i] = src < 0 ? 0 : src >= W ? (left ? 0 : fill) : x[src];
      }
      return o;
    });
    case "$shiftx": return combCell(c, ctx, ab, "Y", ([a, b]) => {
      const s = shiftAmount(b, bs);
      if (s === null) return allX(yw);
      const o = new Uint8Array(yw);
      for (let i = 0; i < yw; i++) {
        const src = s + BigInt(i);
        o[i] = src < 0n || src >= BigInt(a.length) ? LX : a[Number(src)];
      }
      return o;
    });
  }
  return null;
}

function unaryCell(c: RawCell, ctx: CellContext): CellDef | null {
  const t = c.type;
  if (!UNARY.has(t)) return null;
  const yw = yWidth(c);
  const as = pbool(c, "A_SIGNED");
  const a1 = ["A"];
  switch (t) {
    case "$not": return combCell(c, ctx, a1, "Y", ([a]) => ext(a, yw, as).map(v => NOT[v]));
    case "$pos": return combCell(c, ctx, a1, "Y", ([a]) => ext(a, yw, as).slice());
    case "$buf": return combCell(c, ctx, a1, "Y", ([a]) => a.slice());
    case "$neg": return combCell(c, ctx, a1, "Y", ([a]) => { const v = val(a, as); return v === null ? allX(yw) : fromBig(-v, yw); });
    case "$reduce_and": return combCell(c, ctx, a1, "Y", ([a]) => bit0(reduceAnd(a), yw));
    case "$reduce_or": case "$reduce_bool": return combCell(c, ctx, a1, "Y", ([a]) => bit0(reduceOr(a), yw));
    case "$reduce_xor": return combCell(c, ctx, a1, "Y", ([a]) => bit0(reduceXor(a), yw));
    case "$reduce_xnor": return combCell(c, ctx, a1, "Y", ([a]) => bit0(NOT[reduceXor(a)], yw));
    case "$logic_not": return combCell(c, ctx, a1, "Y", ([a]) => bit0(NOT[truth(a)], yw));
  }
  return null;
}

/** $bmux: S selects a WIDTH slice of A; unknown select bits merge both halves (simlib recursion). */
function bmux(a: Uint8Array, s: Uint8Array, w: number, sw: number, off: number): Uint8Array {
  if (sw === 0) return a.slice(off, off + w);
  const half = w << (sw - 1);
  const sel = BUF[s[sw - 1]];
  if (sel === 0) return bmux(a, s, w, sw - 1, off);
  if (sel === 1) return bmux(a, s, w, sw - 1, off + half);
  const lo = bmux(a, s, w, sw - 1, off), hi = bmux(a, s, w, sw - 1, off + half);
  for (let i = 0; i < w; i++) lo[i] = MERGE[lo[i] * 4 + hi[i]];
  return lo;
}

function muxCell(c: RawCell, ctx: CellContext): CellDef | null {
  switch (c.type) {
    case "$mux": case "$_MUX_": case "$_NMUX_": {
      const inv = c.type === "$_NMUX_";
      return combCell(c, ctx, ["A", "B", "S"], "Y", ([a, b, s]) => {
        const sel = BUF[s[0]];
        const o = new Uint8Array(a.length);
        for (let i = 0; i < a.length; i++) o[i] = sel === 0 ? a[i] : sel === 1 ? b[i] : MERGE[a[i] * 4 + b[i]];
        return inv ? o.map(v => NOT[v]) : o;
      });
    }
    case "$bwmux": return combCell(c, ctx, ["A", "B", "S"], "Y", ([a, b, s]) => {
      const o = new Uint8Array(a.length);
      for (let i = 0; i < a.length; i++) { const sel = BUF[s[i]]; o[i] = sel === 0 ? a[i] : sel === 1 ? b[i] : MERGE[a[i] * 4 + b[i]]; }
      return o;
    });
    case "$pmux": {
      const w = paramInt(c, "WIDTH", need(c, "A").length);
      return combCell(c, ctx, ["A", "B", "S"], "Y", ([a, b, s]) => {
        let hot = -1;
        for (let i = 0; i < s.length; i++) {
          if (s[i] === 0) continue;
          if (s[i] !== 1 || hot >= 0) return allX(w);
          hot = i;
        }
        return hot < 0 ? a.slice() : b.slice(hot * w, hot * w + w);
      });
    }
    case "$bmux": {
      const w = paramInt(c, "WIDTH"), sw = paramInt(c, "S_WIDTH");
      return combCell(c, ctx, ["A", "S"], "Y", ([a, s]) => bmux(a, s, w, sw, 0));
    }
    case "$demux": {
      const w = paramInt(c, "WIDTH"), sw = paramInt(c, "S_WIDTH");
      return combCell(c, ctx, ["A", "S"], "Y", ([a, s]) => {
        const o = new Uint8Array(w << sw);
        for (let i = 0; i < 1 << sw; i++) {
          let m = 1;
          for (let k = 0; k < sw; k++) { const sv = BUF[s[k]]; m = AND[m * 4 + (sv > 1 ? LX : sv === ((i >> k) & 1) ? 1 : 0)]; }
          for (let j = 0; j < w; j++) o[i * w + j] = m === 1 ? a[j] : m === 0 ? 0 : MERGE[a[j] * 4];
        }
        return o;
      });
    }
    case "$tribuf": case "$_TBUF_": {
      const en = c.type === "$tribuf" ? "EN" : "E";
      return combCell(c, ctx, ["A", en], "Y", ([a, e]) => {
        const v = BUF[e[0]];
        return v === 1 ? a.slice() : v === 0 ? new Uint8Array(a.length).fill(LZ) : allX(a.length);
      });
    }
    case "$lut": {
      const w = paramInt(c, "WIDTH");
      const lut = paramBits(c.params.LUT, 1 << w);
      return combCell(c, ctx, ["A"], "Y", ([a]) => bmux(lut, a, 1, w, 0));
    }
    case "$sop": {
      const w = paramInt(c, "WIDTH"), depth = paramInt(c, "DEPTH");
      const table = paramBits(c.params.TABLE, 2 * w * depth);
      return combCell(c, ctx, ["A"], "Y", ([a]) => {
        let y = 0;
        for (let i = 0; i < depth; i++) {
          let m = 1;
          for (let j = 0; j < w; j++) {
            if (table[2 * w * i + 2 * j]) m = AND[m * 4 + NOT[a[j]]];
            if (table[2 * w * i + 2 * j + 1]) m = AND[m * 4 + BUF[a[j]]];
          }
          y = OR[y * 4 + m];
        }
        return Uint8Array.of(y);
      });
    }
  }
  return null;
}

function arithCell(c: RawCell, ctx: CellContext): CellDef | null {
  switch (c.type) {
    case "$fa": return {
      type: c.type, name: c.name, src: c.src,
      inputs: { A: need(c, "A"), B: need(c, "B"), C: need(c, "C") },
      outputs: { X: out(c, "X", ctx), Y: out(c, "Y", ctx) },
      create: () => (k, cell) => {
        const [a, b, cc] = cell.ins.map(n => k.read(n));
        const x = new Uint8Array(a.length), y = new Uint8Array(a.length);
        for (let i = 0; i < a.length; i++) {
          const t1 = XOR[a[i] * 4 + b[i]], t2 = AND[a[i] * 4 + b[i]], t3 = AND[cc[i] * 4 + t1];
          y[i] = XOR[t1 * 4 + cc[i]]; x[i] = OR[t2 * 4 + t3];
        }
        k.drive(cell.outs[0], x); k.drive(cell.outs[1], y);
      },
    };
    case "$lcu": return combCell(c, ctx, ["P", "G", "CI"], "CO", ([p, g, ci]) => {
      const co = new Uint8Array(p.length);
      let carry = BUF[ci[0]];
      for (let i = 0; i < p.length; i++) { carry = OR[g[i] * 4 + AND[p[i] * 4 + carry]]; co[i] = carry; }
      return co;
    });
    case "$alu": {
      const yw = paramInt(c, "Y_WIDTH");
      const both = pbool(c, "A_SIGNED") && pbool(c, "B_SIGNED");
      return {
        type: c.type, name: c.name, src: c.src,
        inputs: { A: need(c, "A"), B: need(c, "B"), CI: need(c, "CI"), BI: need(c, "BI") },
        outputs: { X: out(c, "X", ctx), Y: out(c, "Y", ctx), CO: out(c, "CO", ctx) },
        create: () => (k, cell) => {
          const [a0, b0, ci, bi] = cell.ins.map(n => k.read(n));
          const a = ext(a0, yw, both), b = ext(b0, yw, both);
          const binv = BUF[bi[0]];
          const x = new Uint8Array(yw), y = new Uint8Array(yw), co = new Uint8Array(yw);
          let carry = BUF[ci[0]];
          for (let i = 0; i < yw; i++) {
            const bb = binv === 0 ? BUF[b[i]] : binv === 1 ? NOT[b[i]] : XOR[b[i] * 4 + LX];
            const p = XOR[a[i] * 4 + bb], g = AND[a[i] * 4 + bb];
            x[i] = p;
            y[i] = XOR[p * 4 + carry];
            carry = OR[g * 4 + AND[p * 4 + carry]];
            co[i] = carry;
          }
          k.drive(cell.outs[0], x); k.drive(cell.outs[1], y); k.drive(cell.outs[2], co);
        },
      };
    }
    case "$concat": return combCell(c, ctx, ["A", "B"], "Y", ([a, b]) => { const o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; });
    case "$slice": {
      const off = paramInt(c, "OFFSET"), yw = paramInt(c, "Y_WIDTH");
      return combCell(c, ctx, ["A"], "Y", ([a]) => a.slice(off, off + yw));
    }
    case "$bweqx": return combCell(c, ctx, ["A", "B"], "Y", ([a, b]) => a.map((v, i) => (v === b[i] ? 1 : 0)));
  }
  return null;
}

// ─────────────── fine-grained gate cells ($_AND_ ...) ───────────────

const GATE_FNS: Record<string, [string[], (v: number[]) => number]> = {
  $_BUF_: [["A"], ([a]) => BUF[a]],
  $_NOT_: [["A"], ([a]) => NOT[a]],
  $_AND_: [["A", "B"], ([a, b]) => AND[a * 4 + b]],
  $_NAND_: [["A", "B"], ([a, b]) => NOT[AND[a * 4 + b]]],
  $_OR_: [["A", "B"], ([a, b]) => OR[a * 4 + b]],
  $_NOR_: [["A", "B"], ([a, b]) => NOT[OR[a * 4 + b]]],
  $_XOR_: [["A", "B"], ([a, b]) => XOR[a * 4 + b]],
  $_XNOR_: [["A", "B"], ([a, b]) => NOT[XOR[a * 4 + b]]],
  $_ANDNOT_: [["A", "B"], ([a, b]) => AND[a * 4 + NOT[b]]],
  $_ORNOT_: [["A", "B"], ([a, b]) => OR[a * 4 + NOT[b]]],
  $_AOI3_: [["A", "B", "C"], ([a, b, c]) => NOT[OR[AND[a * 4 + b] * 4 + c]]],
  $_OAI3_: [["A", "B", "C"], ([a, b, c]) => NOT[AND[OR[a * 4 + b] * 4 + c]]],
  $_AOI4_: [["A", "B", "C", "D"], ([a, b, c, d]) => NOT[OR[AND[a * 4 + b] * 4 + AND[c * 4 + d]]]],
  $_OAI4_: [["A", "B", "C", "D"], ([a, b, c, d]) => NOT[AND[OR[a * 4 + b] * 4 + OR[c * 4 + d]]]],
};

function gateCell(c: RawCell, ctx: CellContext): CellDef | null {
  const g = GATE_FNS[c.type];
  if (!g) return null;
  const [names, f] = g;
  return combCell(c, ctx, names, "Y", ins => Uint8Array.of(f(ins.map(v => v[0]))));
}

// ─────────────── flip-flops and latches ───────────────

interface FFConf {
  width: number;
  clk?: { pol: boolean };
  arst?: { pol: boolean; value: Uint8Array };
  aload?: { pol: boolean };
  srst?: { pol: boolean; value: Uint8Array; ceOverSrst: boolean };
  en?: { pol: boolean };
  /** Per-bit async set / clear ($dffsr, $dlatchsr, $sr). */
  set?: { pol: boolean };
  clr?: { pol: boolean };
  latch?: boolean;
}

/** Normalised view of every FF / latch flavour: word-level ($dff, $adffe, ...) and fine-grained
 *  ($_DFF_PN0_, $_SDFFE_PP1N_, ...). Returns null for other cell types. */
function ffConf(c: RawCell, ctx: CellContext): FFConf | null {
  const t = c.type;
  const width = () => paramInt(c, "WIDTH", c.conns.Q?.length ?? 1);
  const rv = (name: string, w: number) => paramBits(c.params[name], w).map(v => (v > 1 ? ctx.undefTo : v));
  const pol = (name: string) => pbool(c, name, 1);
  switch (t) {
    case "$dff": return { width: width(), clk: { pol: pol("CLK_POLARITY") } };
    case "$dffe": return { width: width(), clk: { pol: pol("CLK_POLARITY") }, en: { pol: pol("EN_POLARITY") } };
    case "$adff": case "$adffe": {
      const w = width();
      return { width: w, clk: { pol: pol("CLK_POLARITY") }, arst: { pol: pol("ARST_POLARITY"), value: rv("ARST_VALUE", w) }, en: t === "$adffe" ? { pol: pol("EN_POLARITY") } : undefined };
    }
    case "$aldff": case "$aldffe":
      return { width: width(), clk: { pol: pol("CLK_POLARITY") }, aload: { pol: pol("ALOAD_POLARITY") }, en: t === "$aldffe" ? { pol: pol("EN_POLARITY") } : undefined };
    case "$sdff": case "$sdffe": case "$sdffce": {
      const w = width();
      return { width: w, clk: { pol: pol("CLK_POLARITY") }, srst: { pol: pol("SRST_POLARITY"), value: rv("SRST_VALUE", w), ceOverSrst: t === "$sdffce" }, en: t !== "$sdff" ? { pol: pol("EN_POLARITY") } : undefined };
    }
    case "$dffsr": case "$dffsre":
      return { width: width(), clk: { pol: pol("CLK_POLARITY") }, set: { pol: pol("SET_POLARITY") }, clr: { pol: pol("CLR_POLARITY") }, en: t === "$dffsre" ? { pol: pol("EN_POLARITY") } : undefined };
    case "$dlatch": return { width: width(), latch: true, en: { pol: pol("EN_POLARITY") } };
    case "$adlatch": { const w = width(); return { width: w, latch: true, en: { pol: pol("EN_POLARITY") }, arst: { pol: pol("ARST_POLARITY"), value: rv("ARST_VALUE", w) } }; }
    case "$dlatchsr": return { width: width(), latch: true, en: { pol: pol("EN_POLARITY") }, set: { pol: pol("SET_POLARITY") }, clr: { pol: pol("CLR_POLARITY") } };
    case "$sr": return { width: width(), latch: true, set: { pol: pol("SET_POLARITY") }, clr: { pol: pol("CLR_POLARITY") } };
  }
  // Fine-grained: $_DFF_P_, $_DFF_PN0_, $_DFFE_PN0P_, $_SDFF_PN0_, $_SDFFE_PN0P_, $_SDFFCE_..., $_DFFSR_PNN_,
  // $_DFFSRE_PNNP_, $_ALDFF_PP_, $_ALDFFE_PPP_, $_DLATCH_P_, $_DLATCH_PN0_, $_DLATCHSR_PNN_, $_SR_PN_.
  const m = /^\$_(DFF|DFFE|SDFF|SDFFE|SDFFCE|DFFSR|DFFSRE|ALDFF|ALDFFE|DLATCH|DLATCHSR|SR)_([PN01]+)_$/.exec(t);
  if (!m) return null;
  const kind = m[1], f = m[2];
  const P = (ch: string) => ch === "P";
  const bad = () => { throw new DigitalSimError("unknown-cell", `unsupported cell type ${t}`, { cellType: t, cell: c.name, src: c.src }); };
  switch (kind) {
    case "DFF": if (f.length === 1) return { width: 1, clk: { pol: P(f[0]) } };
      if (f.length === 3) return { width: 1, clk: { pol: P(f[0]) }, arst: { pol: P(f[1]), value: Uint8Array.of(+f[2]) } };
      return bad();
    case "DFFE": if (f.length === 2) return { width: 1, clk: { pol: P(f[0]) }, en: { pol: P(f[1]) } };
      if (f.length === 4) return { width: 1, clk: { pol: P(f[0]) }, arst: { pol: P(f[1]), value: Uint8Array.of(+f[2]) }, en: { pol: P(f[3]) } };
      return bad();
    case "SDFF": return f.length === 3 ? { width: 1, clk: { pol: P(f[0]) }, srst: { pol: P(f[1]), value: Uint8Array.of(+f[2]), ceOverSrst: false } } : bad();
    case "SDFFE": case "SDFFCE": return f.length === 4 ? { width: 1, clk: { pol: P(f[0]) }, srst: { pol: P(f[1]), value: Uint8Array.of(+f[2]), ceOverSrst: kind === "SDFFCE" }, en: { pol: P(f[3]) } } : bad();
    case "DFFSR": return f.length === 3 ? { width: 1, clk: { pol: P(f[0]) }, set: { pol: P(f[1]) }, clr: { pol: P(f[2]) } } : bad();
    case "DFFSRE": return f.length === 4 ? { width: 1, clk: { pol: P(f[0]) }, set: { pol: P(f[1]) }, clr: { pol: P(f[2]) }, en: { pol: P(f[3]) } } : bad();
    case "ALDFF": return f.length === 2 ? { width: 1, clk: { pol: P(f[0]) }, aload: { pol: P(f[1]) } } : bad();
    case "ALDFFE": return f.length === 3 ? { width: 1, clk: { pol: P(f[0]) }, aload: { pol: P(f[1]) }, en: { pol: P(f[2]) } } : bad();
    case "DLATCH": if (f.length === 1) return { width: 1, latch: true, en: { pol: P(f[0]) } };
      if (f.length === 3) return { width: 1, latch: true, en: { pol: P(f[0]) }, arst: { pol: P(f[1]), value: Uint8Array.of(+f[2]) } };
      return bad();
    case "DLATCHSR": return f.length === 3 ? { width: 1, latch: true, en: { pol: P(f[0]) }, set: { pol: P(f[1]) }, clr: { pol: P(f[2]) } } : bad();
    case "SR": return f.length === 2 ? { width: 1, latch: true, set: { pol: P(f[0]) }, clr: { pol: P(f[1]) } } : bad();
  }
  return null;
}

/** Port names of an FF flavour: word-level cells use CLK/EN/ARST/..., fine-grained ones C/E/R/S/L. */
function ffPorts(t: string): Record<string, string> {
  if (!t.startsWith("$_")) return { CLK: "CLK", EN: "EN", ARST: "ARST", SRST: "SRST", ALOAD: "ALOAD", AD: "AD", SET: "SET", CLR: "CLR", D: "D", Q: "Q" };
  if (t.startsWith("$_DLATCH")) return { EN: "E", ARST: "R", SET: "S", CLR: "R", D: "D", Q: "Q" };
  if (t.startsWith("$_SR_")) return { SET: "S", CLR: "R", Q: "Q" };
  return { CLK: "C", EN: "E", ARST: "R", SRST: "R", ALOAD: "L", AD: "AD", SET: "S", CLR: "R", D: "D", Q: "Q" };
}

function ffCell(c: RawCell, ctx: CellContext): CellDef | null {
  const conf = ffConf(c, ctx);
  if (!conf) return null;
  const pn = ffPorts(c.type);
  const w = conf.width;
  const inputs: Record<string, number[]> = {};
  const use = (key: string, on: unknown) => { if (on) inputs[key] = need(c, pn[key]); };
  use("CLK", conf.clk); use("EN", conf.en); use("ARST", conf.arst); use("SRST", conf.srst);
  use("ALOAD", conf.aload); use("AD", conf.aload); use("SET", conf.set); use("CLR", conf.clr);
  if (!(c.type === "$sr" || c.type.startsWith("$_SR_"))) inputs.D = need(c, pn.D);
  const qNets = need(c, pn.Q);
  if (qNets.length !== w) throw new DigitalSimError("bad-netlist", `cell "${c.name}": Q has ${qNets.length} bits but WIDTH is ${w}`, { cell: c.name });
  const init = ctx.initOf(qNets);
  return {
    type: c.type, name: c.name, src: c.src, inputs, sequential: true,
    outputs: { Q: { nets: qNets, delay: ctx.delay } },
    create: (): CellEval => {
      const q = init.slice();
      let pClk: number = LX, pArst: number = LX, pAload: number = LX;
      let pSet = new Uint8Array(w).fill(LX), pClr = new Uint8Array(w).fill(LX);
      return (k, cell) => {
        const get = (key: string) => { const i = cell.inNames.indexOf(key); return i < 0 ? null : k.read(cell.ins[i]); };
        const one = (key: string, pol: boolean | undefined) => { const v = get(key); return v ? polEq(v[0], pol!) : 0; };
        const d = get("D");
        const posClk = one("CLK", conf.clk?.pol), posArst = one("ARST", conf.arst?.pol), posAload = one("ALOAD", conf.aload?.pol);
        const en = conf.en ? one("EN", conf.en.pol) : 1;
        const setv = get("SET"), clrv = get("CLR");
        const posSet = new Uint8Array(w), posClr = new Uint8Array(w);
        for (let i = 0; i < w; i++) {
          posSet[i] = setv ? polEq(setv[i], conf.set!.pol) : 0;
          posClr[i] = clrv ? polEq(clrv[i], conf.clr!.pol) : 0;
        }
        const first = cell.first;
        if (conf.latch) {
          // always @*: async clear/set/reset dominate, else transparent while enabled.
          for (let i = 0; i < w; i++) {
            if (posClr[i] === 1) q[i] = 0;
            else if (posSet[i] === 1) q[i] = 1;
            else if (conf.arst && posArst === 1) q[i] = conf.arst.value[i];
            else if (conf.en && en === 1) q[i] = d![i];
          }
        } else if (conf.set || conf.clr) {
          const clkEdge = !first && posedge(pClk, posClk);
          for (let i = 0; i < w; i++) {
            const trig = first ? posSet[i] === 1 || posClr[i] === 1 : clkEdge || posedge(pSet[i], posSet[i]) || posedge(pClr[i], posClr[i]);
            if (!trig) continue;
            if (posClr[i] === 1) q[i] = 0;
            else if (posSet[i] === 1) q[i] = 1;
            else if (!first && en === 1) q[i] = d![i];
          }
        } else {
          // At time zero only the asynchronous controls act (their X→1 is a Verilog posedge).
          const trig = first ? posArst === 1 || posAload === 1
            : posedge(pClk, posClk) || (!!conf.arst && posedge(pArst, posArst)) || (!!conf.aload && posedge(pAload, posAload));
          if (trig) {
            if (conf.arst && posArst === 1) q.set(conf.arst.value);
            else if (conf.aload && posAload === 1) q.set(get("AD")!);
            else if (!first) {
              const srst = conf.srst ? one("SRST", conf.srst.pol) : 0;
              if (conf.srst && conf.srst.ceOverSrst) { if (en === 1) q.set(srst === 1 ? conf.srst.value : d!); }
              else if (conf.srst && srst === 1) q.set(conf.srst.value);
              else if (en === 1) q.set(d!);
            }
          }
        }
        pClk = posClk; pArst = posArst; pAload = posAload; pSet = posSet; pClr = posClr;
        k.drive(cell.outs[0], q);
      };
    },
  };
}

// ─────────────── entry ───────────────

/** Formal / annotation cells with no simulation behaviour: accepted and reported as warnings. */
export const IGNORED_CELLS = new Set(["$assert", "$assume", "$live", "$fair", "$cover", "$check", "$print", "$scopeinfo", "$specify2", "$specify3", "$specrule", "$equiv"]);

/** Builds the kernel cell for a Yosys cell, or null when the type is not implemented. */
export function yosysCellDef(c: RawCell, ctx: CellContext): CellDef | null {
  return unaryCell(c, ctx) ?? binaryCell(c, ctx) ?? muxCell(c, ctx) ?? arithCell(c, ctx) ?? gateCell(c, ctx) ?? ffCell(c, ctx);
}

export { anyUndef };
