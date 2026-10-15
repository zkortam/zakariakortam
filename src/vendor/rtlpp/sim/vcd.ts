/**
 * Streaming VCD reader (IEEE 1364 value change dump), fed chunk by chunk while a simulator runs.
 *
 * - Times are converted to integer femtoseconds through the file's $timescale, exactly (the scale is a
 *   power of ten, and every product is checked to stay within 2^53 - 1 fs).
 * - Values are 4-state strings, most significant bit first, lowercase ("01xz"), at the declared
 *   width: shorter vectors are extended as the standard says (0 for 0 or 1, otherwise the leading
 *   x or z repeated).
 * - A signal's change list holds only real changes: a value equal to the previous one ($dumpall,
 *   $dumpon) is dropped, and two changes at one time keep the last.
 * - Identifier codes shared by several variables (aliases) feed every alias.
 * - Parameters are kept apart from signals, with the value they were dumped with.
 * - Real and event variables are skipped; string variables are skipped.
 * - The input may stop anywhere (a run that was stopped): the incomplete tail is ignored.
 */

export interface VcdSignal {
  /** Hierarchical, dot separated: "tb_uart_rx.dut.state". */
  path: string;
  /** Scope path without the variable name. */
  scope: string;
  name: string;
  width: number;
  /** VCD variable type: wire, reg, logic, integer, ... */
  type: string;
  times: number[];
  values: string[];
}

export interface VcdScope {
  path: string;
  name: string;
  /** module, task, function, begin, fork, ... */
  type: string;
}

export interface VcdParameter {
  path: string;
  scope: string;
  name: string;
  width: number;
  /** MSB first, 4-state. */
  value: string;
}

export interface VcdData {
  /** Femtoseconds per VCD time unit. */
  fsPerUnit: number;
  /** The last time stamp seen, in femtoseconds. */
  endFs: number;
  scopes: VcdScope[];
  signals: VcdSignal[];
  parameters: VcdParameter[];
  /** Bytes consumed. */
  bytes: number;
}

const UNIT_FS: Record<string, number> = { s: 1e15, ms: 1e12, us: 1e9, ns: 1e6, ps: 1e3, fs: 1 };

/** "1ns", "10 ps", "100fs" to femtoseconds per unit. */
export function parseTimescale(text: string): number {
  const m = /^\s*(1|10|100)\s*(s|ms|us|ns|ps|fs)\s*$/.exec(text);
  if (!m) throw new Error(`Unsupported VCD timescale "${text.trim()}"`);
  return Number(m[1]) * UNIT_FS[m[2]];
}

/** Extend or keep a VCD vector value to `width` bits, lowercase. */
export function extendValue(raw: string, width: number): string {
  const v = raw.toLowerCase();
  if (v.length >= width) return v.length === width ? v : v.slice(v.length - width);
  const lead = v[0] === "x" || v[0] === "z" ? v[0] : "0";
  return lead.repeat(width - v.length) + v;
}

interface Var {
  scope: string;
  name: string;
  width: number;
  type: string;
  param: boolean;
  skip: boolean;
  index: number;
}

/** Incremental parser: `push` chunks as they arrive, `finish` for the result. */
/** A time in the VCD that femtoseconds cannot hold exactly (past 2^53 - 1 fs, about 9 s). */
export class VcdRangeError extends Error {
  constructor(readonly token: string, readonly fsPerUnit: number, readonly lastFs: number) {
    super(`VCD time ${token} is beyond the exact range (2^53 - 1 fs)`);
    this.name = "VcdRangeError";
  }
}

export class VcdParser {
  private readonly decoder = new TextDecoder();
  private carry = "";
  private inHeader = true;
  private command: string | null = null;
  private commandTokens: string[] = [];
  private scopeStack: string[] = [];
  private readonly vars = new Map<string, Var[]>();
  private readonly signals: VcdSignal[] = [];
  private readonly scopes: VcdScope[] = [];
  private readonly parameters: VcdParameter[] = [];
  private readonly paramByCode = new Map<string, VcdParameter[]>();
  private fsPerUnit = 1;
  private now = 0;
  private bytes = 0;
  private pendingValueVector: string | null = null;

  /** Byte count so far. */
  get size(): number { return this.bytes; }
  /** Femtoseconds per VCD time unit, from $timescale (1e15 when the source had no `timescale). */
  get timescaleFs(): number { return this.fsPerUnit; }

  /** Current time in femtoseconds (the last time stamp seen). */
  get timeFs(): number { return this.now; }

  push(chunk: Uint8Array | string): void {
    this.bytes += typeof chunk === "string" ? chunk.length : chunk.length;
    const text = this.carry + (typeof chunk === "string" ? chunk : this.decoder.decode(chunk, { stream: true }));
    // Keep a partial trailing token for the next chunk.
    let cut = text.length;
    while (cut > 0 && !/\s/.test(text[cut - 1])) cut--;
    this.carry = text.slice(cut);
    this.tokens(text.slice(0, cut));
  }

  /**
   * The waveform so far, without ending it: the same signal objects keep growing as chunks
   * arrive. Changes before `timeFs` are final; those at `timeFs` may still change.
   */
  snapshot(): VcdData {
    return { fsPerUnit: this.fsPerUnit, endFs: this.now, scopes: this.scopes, signals: this.signals, parameters: this.parameters, bytes: this.bytes };
  }

  /** True once $enddefinitions has been read. */
  get headerDone(): boolean { return !this.inHeader; }

  finish(): VcdData {
    // A clean file ends in whitespace; a cut-off one leaves a partial token, which is dropped.
    if (this.carry && /\n$/.test(this.carry)) this.tokens(this.carry);
    this.carry = "";
    return { fsPerUnit: this.fsPerUnit, endFs: this.now, scopes: this.scopes, signals: this.signals, parameters: this.parameters, bytes: this.bytes };
  }

  private tokens(text: string): void {
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) this.token(m[0]);
  }

  private token(t: string): void {
    if (this.command !== null) {
      if (t === "$end") { this.endCommand(); return; }
      this.commandTokens.push(t);
      return;
    }
    if (this.pendingValueVector !== null) {
      this.change(t, this.pendingValueVector);
      this.pendingValueVector = null;
      return;
    }
    const c = t[0];
    if (c === "$") {
      // $dumpvars, $dumpall, $dumpon, $dumpoff open blocks of value changes closed by a bare $end.
      if (t === "$dumpvars" || t === "$dumpall" || t === "$dumpon" || t === "$dumpoff" || t === "$end") return;
      this.command = t;
      this.commandTokens = [];
      return;
    }
    if (this.inHeader) return;
    if (c === "#") {
      const n = Number(t.slice(1));
      if (!Number.isFinite(n)) return;
      const fs = n * this.fsPerUnit;
      if (!Number.isSafeInteger(fs)) throw new VcdRangeError(t, this.fsPerUnit, this.now);
      this.now = fs;
      return;
    }
    if (c === "b" || c === "B") { this.pendingValueVector = t.slice(1); return; }
    if (c === "r" || c === "R" || c === "s" || c === "S") { this.pendingValueVector = "\u0000"; return; }
    if (c === "0" || c === "1" || c === "x" || c === "X" || c === "z" || c === "Z") {
      this.change(t.slice(1), c);
    }
  }

  private change(code: string, raw: string): void {
    if (raw === "\u0000") return;
    const p = this.paramByCode.get(code);
    if (p) for (const x of p) x.value = extendValue(raw, x.width);
    const list = this.vars.get(code);
    if (!list) return;
    for (const v of list) {
      if (v.skip) continue;
      const s = this.signals[v.index];
      const value = extendValue(raw, v.width);
      const n = s.times.length;
      if (n > 0 && s.times[n - 1] === this.now) {
        s.values[n - 1] = value;
        if (n > 1 && s.values[n - 2] === value) { s.times.pop(); s.values.pop(); }
      } else if (n === 0 || s.values[n - 1] !== value) {
        s.times.push(this.now);
        s.values.push(value);
      }
    }
  }

  private endCommand(): void {
    const cmd = this.command!;
    const tk = this.commandTokens;
    this.command = null;
    switch (cmd) {
      case "$timescale":
        this.fsPerUnit = parseTimescale(tk.join(" "));
        break;
      case "$scope": {
        const type = tk[0] ?? "module";
        const name = tk[1] ?? "";
        this.scopeStack.push(name);
        this.scopes.push({ path: this.scopeStack.join("."), name, type });
        break;
      }
      case "$upscope":
        this.scopeStack.pop();
        break;
      case "$var": {
        // $var <type> <size> <code> <reference> [<bit range>] $end
        const [type, size, code, ref] = tk;
        if (!type || !size || !code || !ref) break;
        const width = Number(size);
        const scope = this.scopeStack.join(".");
        const name = ref.replace(/\[[^\]]*\]$/, "");
        if (type === "parameter") {
          const p: VcdParameter = { path: scope ? `${scope}.${name}` : name, scope, name, width, value: "x".repeat(width) };
          this.parameters.push(p);
          const l = this.paramByCode.get(code);
          if (l) l.push(p); else this.paramByCode.set(code, [p]);
          break;
        }
        const skip = type === "real" || type === "realtime" || type === "event" || type === "string" || !(width > 0);
        const v: Var = { scope, name, width, type, param: false, skip, index: -1 };
        if (!skip) {
          v.index = this.signals.length;
          this.signals.push({ path: scope ? `${scope}.${name}` : name, scope, name, width, type, times: [], values: [] });
        }
        const l = this.vars.get(code);
        if (l) l.push(v); else this.vars.set(code, [v]);
        break;
      }
      case "$enddefinitions":
        this.inHeader = false;
        break;
      default:
        break;
    }
  }
}

export function parseVcd(text: string | Uint8Array): VcdData {
  const p = new VcdParser();
  p.push(text);
  return p.finish();
}

/** Index of the change in effect strictly before time t (-1 when none). Binary search. */
export function indexBefore(times: readonly number[], t: number): number {
  let lo = 0, hi = times.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] < t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

/** Value just before time t, or all-x when the signal had no value yet. */
export function valueBefore(s: Pick<VcdSignal, "times" | "values" | "width">, t: number): string {
  const i = indexBefore(s.times, t);
  return i < 0 ? "x".repeat(s.width) : s.values[i];
}

/** Value after all activity at time t. */
export function valueAt(s: Pick<VcdSignal, "times" | "values" | "width">, t: number): string {
  const i = indexBefore(s.times, t + 1);
  return i < 0 ? "x".repeat(s.width) : s.values[i];
}

/**
 * Times a one-bit signal arrives at 1 (rising) or at 0 (falling) from another value, as Verilog's
 * posedge and negedge count them. The first value a signal takes is its initial value, not an edge.
 */
export function edges(s: Pick<VcdSignal, "times" | "values">): { rising: number[]; falling: number[] } {
  const rising: number[] = [], falling: number[] = [];
  for (let i = 1; i < s.times.length; i++) {
    const prev = s.values[i - 1].slice(-1), v = s.values[i].slice(-1);
    if (v === "1" && prev !== "1") rising.push(s.times[i]);
    else if (v === "0" && prev !== "0") falling.push(s.times[i]);
  }
  return { rising, falling };
}
