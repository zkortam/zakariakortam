/**
 * Four-state logic values, drive strengths and multi-bit vectors.
 *
 * Scalar encoding (a "code"): one small integer per bit, laid out as the two VPI planes
 *   code = aval | (bval << 1)      0 → 0,  1 → 1,  2 → Z,  3 → X
 * so `code & 2` means "not a defined 0/1" and `code < 2` means "defined". The kernel keeps
 * every net as one code in a Uint8Array; cells compute on Uint8Array code slices.
 *
 * Vectors handed across the public API are `LogicVec`: the same two planes packed into a
 * pair of bigints (bit i of `a`/`b` = aval/bval of bit i, LSB first). Bigint planes are
 * compact, exact at any width, and V8 keeps values up to 64 bits in a single digit, so the
 * common widths cost one small allocation per value.
 */

export type Logic = 0 | 1 | 2 | 3;
export const L0 = 0 as const;
export const L1 = 1 as const;
export const LZ = 2 as const;
export const LX = 3 as const;

/** Drive strength, ordered so a larger number wins resolution. `HighZ` means "not driving". */
export enum Strength { HighZ = 0, Weak = 1, Pull = 2, Strong = 3, Supply = 4 }

const CH = ["0", "1", "z", "x"] as const;
export const logicChar = (c: number): string => CH[c & 3];

// ── 3-valued truth tables, indexed a*4+b. Z on an input behaves as X (Verilog gate rule). ──
const tbl = (f: (a: number, b: number) => number): Uint8Array => {
  const t = new Uint8Array(16);
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) t[a * 4 + b] = f(a, b);
  return t;
};
export const AND = tbl((a, b) => (a === 0 || b === 0 ? 0 : a === 1 && b === 1 ? 1 : 3));
export const OR = tbl((a, b) => (a === 1 || b === 1 ? 1 : a === 0 && b === 0 ? 0 : 3));
export const XOR = tbl((a, b) => (a < 2 && b < 2 ? a ^ b : 3));
/** Merge of two candidates under an unknown select (Verilog `x ? a : b`): only 0/0 and 1/1 survive. */
export const MERGE = tbl((a, b) => (a === b && a < 2 ? a : 3));
export const NOT = Uint8Array.of(1, 0, 3, 3);
/** Normalises Z to X for consumers that treat a floating input as unknown. */
export const BUF = Uint8Array.of(0, 1, 3, 3);

/** Logic value with strength resolution of a single driver contribution. */
export function driven(code: number, s0: Strength, s1: Strength): Strength {
  if (code === LZ) return Strength.HighZ;
  if (code === L0) return s0;
  if (code === L1) return s1;
  return s0 > s1 ? s0 : s1;
}

// ── bigint ↔ code-slice conversion (chunked through 32-bit numbers: one BigInt op per word) ──

/** Unsigned value of `len` codes starting at `off` (LSB first), or null if any bit is X/Z. */
export function codesToBig(c: ArrayLike<number>, off: number, len: number): bigint | null {
  if (len <= 32) {
    let n = 0;
    for (let j = len - 1; j >= 0; j--) { const v = c[off + j]; if (v > 1) return null; n = n * 2 + v; }
    return BigInt(n);
  }
  let r = 0n;
  let i = len;
  while (i > 0) {
    const n = i < 32 ? i : 32;
    let chunk = 0;
    for (let j = i - 1; j >= i - n; j--) { const v = c[off + j]; if (v > 1) return null; chunk = chunk * 2 + v; }
    r = (r << BigInt(n)) | BigInt(chunk);
    i -= n;
  }
  return r;
}

/** Signed (two's complement) value of a code slice, or null if any bit is X/Z. */
export function codesToSigned(c: ArrayLike<number>, off: number, len: number): bigint | null {
  const u = codesToBig(c, off, len);
  if (u === null || len === 0) return u;
  return c[off + len - 1] === 1 ? u - (1n << BigInt(len)) : u;
}

/** Writes `v mod 2^len` into `out[off .. off+len)` as 0/1 codes. Negative v wraps (two's complement). */
export function bigToCodes(v: bigint, len: number, out: Uint8Array, off = 0): Uint8Array {
  let w = BigInt.asUintN(len, v);
  for (let i = 0; i < len; i += 32) {
    const n = len - i < 32 ? len - i : 32;
    let chunk = Number(w & 0xffffffffn);
    w >>= 32n;
    for (let j = 0; j < n; j++) { out[off + i + j] = chunk & 1; chunk >>>= 1; }
  }
  return out;
}

export function anyUndef(c: ArrayLike<number>, off = 0, len = c.length - off): boolean {
  for (let i = 0; i < len; i++) if (c[off + i] > 1) return true;
  return false;
}

/**
 * Immutable 4-state vector. Bit i of `a` / `b` is aval / bval of bit i (LSB first), so a fully
 * defined vector has b === 0n and its numeric value in `a`.
 */
export class LogicVec {
  readonly width: number;
  readonly a: bigint;
  readonly b: bigint;

  constructor(width: number, a: bigint, b: bigint) {
    if (!Number.isInteger(width) || width < 0) throw new RangeError(`LogicVec width must be a non-negative integer; got ${width}`);
    const m = (1n << BigInt(width)) - 1n;
    this.width = width;
    this.a = a & m;
    this.b = b & m;
  }

  static fromCodes(c: ArrayLike<number>, off = 0, len = c.length - off): LogicVec {
    let a = 0n, b = 0n;
    for (let i = len; i > 0; ) {
      const n = i < 32 ? i : 32;
      let ca = 0, cb = 0;
      for (let j = i - 1; j >= i - n; j--) { const v = c[off + j]; ca = ca * 2 + (v & 1); cb = cb * 2 + (v >> 1); }
      a = (a << BigInt(n)) | BigInt(ca);
      b = (b << BigInt(n)) | BigInt(cb);
      i -= n;
    }
    return new LogicVec(len, a, b);
  }

  /** `v` modulo 2^width (negative values wrap as two's complement). */
  static fromBigInt(v: bigint | number, width: number): LogicVec {
    return new LogicVec(width, BigInt.asUintN(width, BigInt(v)), 0n);
  }

  static fill(code: Logic, width: number): LogicVec {
    const m = (1n << BigInt(width)) - 1n;
    return new LogicVec(width, code & 1 ? m : 0n, code & 2 ? m : 0n);
  }

  /**
   * Parses a vector literal.
   *   "10xz", "1010_0101"         binary digits, MSB first ('?' reads as z)
   *   "8'hF0", "4'b1x0z", "'d12"  Verilog based literals (h digits may be x/z: 4 bits each)
   *   "x" / "z" alone             fills the requested width
   * A literal narrower than `width` is zero-extended (x/z-extended when its MSB is x/z,
   * as Verilog does); a wider one is an error rather than a silent truncation.
   */
  static parse(text: string, width?: number): LogicVec {
    const s = text.trim().replace(/_/g, "");
    const m = /^(\d*)'([sS]?)([bBoOdDhH])([0-9a-fA-FxXzZ?]+)$/.exec(s);
    let codes: number[];
    let declared: number | undefined;
    if (m) {
      declared = m[1] ? parseInt(m[1], 10) : undefined;
      const base = m[3].toLowerCase();
      const digits = m[4].toLowerCase();
      if (base === "d") {
        if (/^[xz?]$/.test(digits)) codes = [digits === "x" ? LX : LZ];
        else if (/^\d+$/.test(digits)) codes = codesOfBig(BigInt(digits));
        else throw new SyntaxError(`invalid decimal literal "${text}"`);
      } else {
        const per = base === "b" ? 1 : base === "o" ? 3 : 4;
        const radix = base === "b" ? 2 : base === "o" ? 8 : 16;
        codes = [];
        for (let i = digits.length - 1; i >= 0; i--) {
          const ch = digits[i];
          if (ch === "x" || ch === "z" || ch === "?") { for (let k = 0; k < per; k++) codes.push(ch === "x" ? LX : LZ); continue; }
          const d = parseInt(ch, radix);
          if (Number.isNaN(d)) throw new SyntaxError(`digit "${ch}" is not valid in base ${radix} in "${text}"`);
          for (let k = 0; k < per; k++) codes.push((d >> k) & 1);
        }
      }
    } else if (/^[01xXzZ?]+$/.test(s)) {
      codes = [];
      for (let i = s.length - 1; i >= 0; i--) {
        const ch = s[i].toLowerCase();
        codes.push(ch === "0" ? 0 : ch === "1" ? 1 : ch === "x" ? LX : LZ);
      }
      if (s.length === 1 && codes[0] > 1 && width !== undefined) declared = width;
    } else {
      throw new SyntaxError(`cannot parse logic value "${text}"`);
    }
    // Verilog: digits whose MSB is x/z extend with that x/z up to the literal's own size; a
    // sized literal then zero-extends to the target, an unsized one keeps extending x/z.
    const msbPad = () => (codes.length && codes[codes.length - 1] > 1 ? codes[codes.length - 1] : 0);
    const fit = (n: number) => {
      for (let i = n; i < codes.length; i++) if (codes[i] !== 0) throw new RangeError(`literal "${text}" does not fit in ${n} bits`);
      if (codes.length > n) codes.length = n;
    };
    if (declared !== undefined) { fit(declared); const p = msbPad(); while (codes.length < declared) codes.push(p); }
    const w = width ?? codes.length;
    fit(w);
    const pad = declared !== undefined ? 0 : msbPad();
    while (codes.length < w) codes.push(pad);
    return LogicVec.fromCodes(codes);
  }

  get isFullyDefined(): boolean { return this.b === 0n; }

  bit(i: number): Logic {
    if (i < 0 || i >= this.width) throw new RangeError(`bit ${i} out of range for width ${this.width}`);
    const s = BigInt(i);
    return (Number((this.a >> s) & 1n) | (Number((this.b >> s) & 1n) << 1)) as Logic;
  }

  toCodes(out = new Uint8Array(this.width), off = 0): Uint8Array {
    let a = this.a, b = this.b;
    for (let i = 0; i < this.width; i += 32) {
      const n = this.width - i < 32 ? this.width - i : 32;
      let ca = Number(a & 0xffffffffn), cb = Number(b & 0xffffffffn);
      a >>= 32n; b >>= 32n;
      for (let j = 0; j < n; j++) { out[off + i + j] = (ca & 1) | ((cb & 1) << 1); ca >>>= 1; cb >>>= 1; }
    }
    return out;
  }

  /** Numeric value, or null when any bit is X/Z. */
  toBigInt(signed = false): bigint | null {
    if (this.b !== 0n) return null;
    return signed ? BigInt.asIntN(this.width, this.a) : this.a;
  }

  /** Numeric value as a JS number, or null when any bit is X/Z or the value is not a safe integer. */
  toNumber(signed = false): number | null {
    const v = this.toBigInt(signed);
    if (v === null) return null;
    const n = Number(v);
    return Number.isSafeInteger(n) ? n : null;
  }

  /** Binary, MSB first, using 0 1 x z. */
  toString(): string {
    if (this.width === 0) return "";
    const c = this.toCodes();
    let s = "";
    for (let i = this.width - 1; i >= 0; i--) s += CH[c[i]];
    return s;
  }

  /** Hex, MSB first; a nibble that is entirely Z prints "z", any other undefined nibble prints "x". */
  toHex(): string {
    const c = this.toCodes();
    let s = "";
    for (let i = Math.ceil(this.width / 4) - 1; i >= 0; i--) {
      let v = 0, und = 0, zs = 0, n = 0;
      for (let k = 0; k < 4 && i * 4 + k < this.width; k++, n++) {
        const code = c[i * 4 + k];
        if (code > 1) { und++; if (code === LZ) zs++; } else v |= code << k;
      }
      s += und === 0 ? v.toString(16) : zs === n ? "z" : "x";
    }
    return s;
  }

  equals(o: LogicVec): boolean { return this.width === o.width && this.a === o.a && this.b === o.b; }
}

function codesOfBig(v: bigint): number[] {
  const out: number[] = [];
  while (v > 0n) { out.push(Number(v & 1n)); v >>= 1n; }
  if (!out.length) out.push(0);
  return out;
}

/** Anything the API accepts as a value for a signal of a known width. */
export type ValueLike = LogicVec | number | bigint | string | ArrayLike<number>;

/**
 * Normalises a user value to `width` codes. Integers must fit the width as either an unsigned
 * or a two's complement value; anything wider is rejected rather than silently truncated.
 */
export function toCodes(v: ValueLike, width: number): Uint8Array {
  if (v instanceof LogicVec) {
    if (v.width !== width) throw new RangeError(`value is ${v.width} bits wide; signal is ${width}`);
    return v.toCodes();
  }
  if (typeof v === "number" || typeof v === "bigint") {
    if (typeof v === "number" && !Number.isSafeInteger(v)) throw new RangeError(`value ${v} is not a safe integer`);
    const b = BigInt(v);
    const lim = 1n << BigInt(width);
    if (b >= lim || b < -(lim >> 1n) || (width === 0 && b !== 0n)) throw new RangeError(`value ${v} does not fit in ${width} bits`);
    return bigToCodes(b, width, new Uint8Array(width));
  }
  if (typeof v === "string") return LogicVec.parse(v, width).toCodes();
  if (v.length !== width) throw new RangeError(`value has ${v.length} bits; signal is ${width}`);
  const out = new Uint8Array(width);
  for (let i = 0; i < width; i++) {
    const c = v[i];
    if (c !== 0 && c !== 1 && c !== 2 && c !== 3) throw new RangeError(`bit ${i} has invalid logic code ${c}`);
    out[i] = c;
  }
  return out;
}
