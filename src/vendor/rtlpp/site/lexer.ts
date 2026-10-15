/**
 * A Verilog and SystemVerilog lexer for the editor features, "Why this value" and the state
 * machine extractor. Tolerant by design: it never throws, and text it cannot classify becomes an
 * operator token, so half-typed code still yields a usable token stream.
 *
 * Comments and attribute instances `(* ... *)` are dropped; everything else keeps its offsets.
 */

export type TokenKind = "ident" | "keyword" | "number" | "string" | "op" | "directive" | "system";

export interface Token {
  kind: TokenKind;
  text: string;
  /** Offsets into the source, `to` exclusive. */
  from: number;
  to: number;
}

export const KEYWORDS = new Set([
  "module", "macromodule", "endmodule", "interface", "endinterface", "package", "endpackage", "program", "endprogram",
  "input", "output", "inout", "ref", "wire", "reg", "logic", "bit", "byte", "shortint", "int", "longint", "integer", "time",
  "real", "realtime", "shortreal", "string", "signed", "unsigned", "tri", "tri0", "tri1", "wand", "wor", "supply0", "supply1",
  "var", "const", "static", "automatic", "localparam", "parameter", "defparam", "genvar", "typedef", "enum", "struct", "union",
  "packed", "assign", "deassign", "force", "release", "always", "always_ff", "always_comb", "always_latch", "initial", "final",
  "begin", "end", "fork", "join", "join_any", "join_none", "if", "else", "case", "casez", "casex", "endcase", "default",
  "unique", "unique0", "priority", "for", "foreach", "while", "do", "repeat", "forever", "break", "continue", "return",
  "function", "endfunction", "task", "endtask", "void", "generate", "endgenerate", "posedge", "negedge", "edge", "or", "and",
  "not", "nand", "nor", "xor", "xnor", "buf", "bufif0", "bufif1", "notif0", "notif1", "import", "export", "modport",
  "wait", "disable", "assert", "assume", "cover", "property", "endproperty", "sequence", "endsequence", "inside", "iff",
  "class", "endclass", "extends", "new", "null", "this", "super", "virtual", "pure", "extern", "type", "specify",
  "endspecify", "timeunit", "timeprecision", "event", "highz0", "highz1", "strong0", "strong1", "weak0", "weak1",
  "pull0", "pull1", "pullup", "pulldown", "cell", "config", "endconfig", "design", "instance", "liblist", "use",
]);

const isIdStart = (c: number) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95;
const isIdPart = (c: number) => isIdStart(c) || (c >= 48 && c <= 57) || c === 36;
const isDigit = (c: number) => c >= 48 && c <= 57;
const isSpace = (c: number) => c === 32 || c === 9 || c === 10 || c === 13 || c === 12;

/** Longest operators first. */
const OPS = [
  "<<<=", ">>>=", "===", "!==", "==?", "!=?", "<<<", ">>>", "<->", "->>", "|->", "|=>", "<<=", ">>=",
  "==", "!=", "<=", ">=", "&&", "||", "<<", ">>", "**", "~&", "~|", "~^", "^~", "->", "::", "+:", "-:", "++", "--",
  "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", ".*", "##",
];

export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src.charCodeAt(i);
    if (isSpace(c)) { i++; continue; }
    // Comments.
    if (c === 47 && src.charCodeAt(i + 1) === 47) { const e = src.indexOf("\n", i); i = e < 0 ? n : e; continue; }
    if (c === 47 && src.charCodeAt(i + 1) === 42) { const e = src.indexOf("*/", i + 2); i = e < 0 ? n : e + 2; continue; }
    // Attribute instances (* ... *), but not the event control @(*).
    if (c === 40 && src.charCodeAt(i + 1) === 42 && src.charCodeAt(i + 2) !== 41) {
      const prev = out[out.length - 1];
      if (!(prev && prev.text === "@")) {
        const e = src.indexOf("*)", i + 2);
        if (e >= 0) { i = e + 2; continue; }
      }
    }
    const start = i;
    if (isIdStart(c)) {
      i++;
      while (i < n && isIdPart(src.charCodeAt(i))) i++;
      // A sized literal with a space before the base is rare; numbers are handled below.
      const text = src.slice(start, i);
      out.push({ kind: KEYWORDS.has(text) ? "keyword" : "ident", text, from: start, to: i });
      continue;
    }
    if (c === 92) { // \escaped identifier, ends at whitespace
      i++;
      while (i < n && !isSpace(src.charCodeAt(i))) i++;
      out.push({ kind: "ident", text: src.slice(start + 1, i), from: start, to: i });
      continue;
    }
    if (c === 96) { // `directive or `MACRO
      i++;
      while (i < n && isIdPart(src.charCodeAt(i))) i++;
      out.push({ kind: "directive", text: src.slice(start, i), from: start, to: i });
      continue;
    }
    if (c === 36 && i + 1 < n && isIdStart(src.charCodeAt(i + 1))) { // $display
      i++;
      while (i < n && isIdPart(src.charCodeAt(i))) i++;
      out.push({ kind: "system", text: src.slice(start, i), from: start, to: i });
      continue;
    }
    if (c === 34) { // string
      i++;
      while (i < n) {
        const d = src.charCodeAt(i);
        if (d === 92) { i += 2; continue; }
        if (d === 34 || d === 10) { i++; break; }
        i++;
      }
      out.push({ kind: "string", text: src.slice(start, i), from: start, to: i });
      continue;
    }
    if (isDigit(c) || (c === 39 && /['][sS]?[bBoOdDhH01xXzZ]/.test(src.slice(i, i + 3)))) {
      i = scanNumber(src, i);
      out.push({ kind: "number", text: src.slice(start, i), from: start, to: i });
      continue;
    }
    let op = "";
    for (const o of OPS) if (src.startsWith(o, i)) { op = o; break; }
    if (!op) op = src[i];
    i += op.length;
    out.push({ kind: "op", text: op, from: start, to: i });
  }
  return out;
}

/** Decimal, real, or sized/based literal starting at i (digits or an apostrophe). */
function scanNumber(src: string, i: number): number {
  const n = src.length;
  while (i < n && (isDigit(src.charCodeAt(i)) || src[i] === "_")) i++;
  // Real: 1.5, 1e3
  if (src[i] === "." && isDigit(src.charCodeAt(i + 1))) {
    i++;
    while (i < n && (isDigit(src.charCodeAt(i)) || src[i] === "_")) i++;
  }
  if ((src[i] === "e" || src[i] === "E") && /[+-]?\d/.test(src.slice(i + 1, i + 3))) {
    i++;
    if (src[i] === "+" || src[i] === "-") i++;
    while (i < n && isDigit(src.charCodeAt(i))) i++;
    return i;
  }
  // Optional whitespace, then 'b / 'sd / '0 ...
  let j = i;
  while (j < n && (src[j] === " " || src[j] === "\t")) j++;
  if (src[j] !== "'") return i;
  j++;
  if (src[j] === "s" || src[j] === "S") j++;
  const base = src[j]?.toLowerCase();
  if (base === "b" || base === "o" || base === "d" || base === "h") {
    j++;
    while (j < n && (src[j] === " " || src[j] === "\t")) j++;
    const digits = /^[0-9a-fA-FxXzZ?_]+/.exec(src.slice(j));
    return digits ? j + digits[0].length : j;
  }
  // Unbased unsized: '0 '1 'x 'z
  if (/[01xXzZ]/.test(src[j] ?? "")) return j + 1;
  return i;
}

/** Offsets of each line start, for offset to line and column conversion. */
export function lineStarts(src: string): number[] {
  const out = [0];
  for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) out.push(i + 1);
  return out;
}

/** 1-based line of an offset. */
export function lineOf(starts: readonly number[], offset: number): number {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (starts[m] <= offset) lo = m; else hi = m - 1;
  }
  return lo + 1;
}

/** Offset of a 1-based line and column (Yosys columns are 1-based too). */
export function offsetOf(starts: readonly number[], line: number, col: number, textLength: number): number {
  const l = Math.min(Math.max(1, line), starts.length);
  return Math.min(textLength, starts[l - 1] + Math.max(0, col - 1));
}

/* ─── literals ───────────────────────────────────────────────────────────── */

export interface Literal {
  /** Declared width, or null for unsized. */
  width: number | null;
  signed: boolean;
  /** Bits LSB first in the kernel's codes (0, 1, 2 = z, 3 = x), sized to `width` or 32. */
  codes: Uint8Array;
  /** The value when every bit is 0 or 1. */
  value: bigint | null;
  /** Unbased unsized '0, '1, 'x, 'z: fills the context width. */
  fill?: number;
}

/** Parse a Verilog number token. Returns null for reals and malformed text. */
export function parseLiteral(text: string): Literal | null {
  const t = text.replace(/_/g, "").replace(/\s+/g, "");
  const unsized = /^'([01xXzZ])$/.exec(t);
  if (unsized) {
    const code = "01zx".indexOf(unsized[1].toLowerCase() === "x" ? "x" : unsized[1].toLowerCase());
    const fill = code < 0 ? 3 : code;
    return { width: null, signed: false, codes: new Uint8Array(1).fill(fill), value: fill < 2 ? BigInt(fill) : null, fill };
  }
  const m = /^(\d+)?'([sS])?([bBoOdDhH])([0-9a-fA-FxXzZ?]+)$/.exec(t);
  if (!m) {
    if (!/^\d+$/.test(t)) return null;
    const v = BigInt(t);
    const w = Math.max(32, v.toString(2).length);
    return { width: null, signed: true, codes: bigCodes(v, w), value: v };
  }
  const width = m[1] ? Number(m[1]) : null;
  const signed = !!m[2];
  const base = m[3].toLowerCase();
  const digits = m[4].toLowerCase().replace(/\?/g, "z");
  let codes: number[] = [];
  if (base === "d") {
    if (/^[xz]$/.test(digits)) {
      const w = width ?? 32;
      return { width, signed, codes: new Uint8Array(w).fill(digits === "x" ? 3 : 2), value: null };
    }
    if (!/^\d+$/.test(digits)) return null;
    const v = BigInt(digits);
    const w = width ?? Math.max(32, v.toString(2).length);
    return { width, signed, codes: bigCodes(v, w), value: w < 1 ? 0n : v & ((1n << BigInt(w)) - 1n) };
  }
  const per = base === "b" ? 1 : base === "o" ? 3 : 4;
  for (let i = digits.length - 1; i >= 0; i--) {
    const ch = digits[i];
    if (ch === "x" || ch === "z") { for (let k = 0; k < per; k++) codes.push(ch === "x" ? 3 : 2); continue; }
    const d = parseInt(ch, per === 1 ? 2 : per === 3 ? 8 : 16);
    if (Number.isNaN(d)) return null;
    for (let k = 0; k < per; k++) codes.push((d >> k) & 1);
  }
  const w = width ?? Math.max(32, codes.length);
  // Extension: an x or z in the top digit extends with x or z, otherwise zeros.
  const top = codes[codes.length - 1] ?? 0;
  const ext = top > 1 ? top : 0;
  if (codes.length < w) codes = codes.concat(new Array(w - codes.length).fill(ext));
  else codes = codes.slice(0, w);
  const arr = Uint8Array.from(codes);
  let value: bigint | null = 0n;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] > 1) { value = null; break; }
    value = (value << 1n) | BigInt(arr[i]);
  }
  return { width, signed, codes: arr, value };
}

function bigCodes(v: bigint, w: number): Uint8Array {
  const out = new Uint8Array(w);
  let x = v < 0n ? (1n << BigInt(w)) + v : v;
  for (let i = 0; i < w; i++) { out[i] = Number(x & 1n); x >>= 1n; }
  return out;
}
