/**
 * B-source expression compiler.
 *
 * SPICE behavioral sources (B-elements) take an expression in node voltages, branch currents,
 * and time, and stamp it as a nonlinear voltage or current. This module compiles such an
 * expression to an AST, walks it to determine which nodes/branches it references (so the engine
 * can build a finite-difference Jacobian), and evaluates it at each Newton iterate.
 *
 *   compileExpr("V(in) > 1 ? 5 : -5")        - comparator
 *   compileExpr("0.5 * V(a) * V(b)")         - multiplier
 *   compileExpr("if(time < 1ms, 0, 5)")      - soft-start ramp
 *   compileExpr("limit(V(ctrl), 0, 5)")      - clamp
 *
 * Grammar (lowest → highest precedence):
 *     ternary  := orExpr "?" expr ":" expr        // c-style ternary
 *     orExpr   := andExpr ("||" andExpr)*
 *     andExpr  := cmpExpr ("&&" cmpExpr)*
 *     cmpExpr  := sum (("==" | "!=" | "<" | "<=" | ">" | ">=") sum)?
 *     sum      := prod (("+" | "-") prod)*
 *     prod     := pow  (("*" | "/") pow)*
 *     pow      := unary (("^" | "**") unary)?     // right-associative
 *     unary    := ("-" | "+" | "!") unary | atom
 *     atom     := num | "(" ternary ")" | call | identifier
 *     call     := identifier "(" args ")"
 *     args     := (expr ("," expr)*)?
 *
 * Special function names:
 *     V(node), V(a, b)       - node voltage (or differential V(a) - V(b)) at current iterate
 *     I(srcName)             - branch current through V-source `srcName` at current iterate
 *     time                   - simulation time (0 during .op / DC sweep)
 *     exp, log, ln, log10    - natural/base-10 log; "log" is natural (SPICE convention)
 *     sqrt, abs, sgn         - sign returns -1/0/+1
 *     sin, cos, tan, tanh    - trig + hyperbolic
 *     min(a,b), max(a,b)     - variadic up to 2 args
 *     pow(a,b)               - same as a^b
 *     if(cond, a, b)         - branchless conditional
 *     limit(x, lo, hi)       - clamp
 *     pwl(x, x1,v1, x2,v2, …) - piecewise-linear (sorted x's; extends flat outside the range)
 *
 * Error handling: compileExpr returns { error: "<message>" } on any malformed input. The engine
 * surfaces this as a SimError before attempting to stamp the device.
 */
import { parseValue } from "../units";

export type BNode =
  | { kind: "num"; v: number }
  | { kind: "time" }
  | { kind: "nodeV"; node: string }
  | { kind: "nodeVDiff"; n1: string; n2: string }
  | { kind: "branchI"; src: string }
  | { kind: "fn"; name: string; args: BNode[] }
  | { kind: "bin"; op: string; a: BNode; b: BNode }
  | { kind: "un"; op: string; a: BNode }
  | { kind: "tern"; c: BNode; a: BNode; b: BNode };

export interface CompiledBExpr {
  ast: BNode;
  /** Distinct node names that V(...) references - used to build the FD Jacobian. */
  nodeRefs: string[];
  /** Distinct branch source names that I(...) references. */
  branchRefs: string[];
  /** True if the expression involves time - only matters for the engine's "is this DC?" check. */
  hasTime: boolean;
  /** Original source string (for error messages). */
  raw: string;
}

export interface BEvalEnv {
  nodeV: (name: string) => number;
  branchI: (src: string) => number;
  time: number;
}

// ───── tokenizer ───────────────────────────────────────────────────────────
type Tok =
  | { k: "num"; v: number }
  | { k: "id"; v: string }
  | { k: "op"; v: string }
  | { k: "lp" } | { k: "rp" } | { k: "comma" } | { k: "qmark" } | { k: "colon" }
  | { k: "eof" };

function tokenize(src: string): { toks: Tok[]; error?: string } {
  const toks: Tok[] = [];
  let i = 0;
  const n = src.length;
  // multi-char operators (longest first so "**" beats "*" and "<=" beats "<")
  const MULTI = ["**", "==", "!=", "<=", ">=", "&&", "||"];
  while (i < n) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue; }
    if (c === "(") { toks.push({ k: "lp" }); i++; continue; }
    if (c === ")") { toks.push({ k: "rp" }); i++; continue; }
    if (c === ",") { toks.push({ k: "comma" }); i++; continue; }
    if (c === "?") { toks.push({ k: "qmark" }); i++; continue; }
    if (c === ":") { toks.push({ k: "colon" }); i++; continue; }
    // numbers: digit or .digit start; greedy-eat numeric body + SI suffix, then validate via parseValue.
    if ((c >= "0" && c <= "9") || (c === "." && i + 1 < n && src[i + 1] >= "0" && src[i + 1] <= "9")) {
      // Numeric body: digits, decimal, optional exponent.
      const m = /^(\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(src.slice(i));
      if (!m) return { toks, error: `unexpected '${c}' at ${i}` };
      let end = i + m[0].length;
      // Optional SI suffix: greedy match letters; try the longest prefix that parses cleanly.
      const suffixMatch = /^[a-zA-Zµ]+/.exec(src.slice(end));
      if (suffixMatch) {
        // Try longest → shortest; stop at the longest one parseValue accepts as the same numeric value.
        let best = 0;
        for (let len = suffixMatch[0].length; len > 0; len--) {
          const candidate = src.slice(i, end + len);
          const parsed = parseValue(candidate);
          if (isFinite(parsed)) {
            // Sanity: if the suffix gives the same value as the bare number, treat the suffix
            // as identifier (e.g. "1e" - "e" is not a valid SI suffix here).
            const bare = parseValue(m[0]);
            if (parsed !== bare) { best = len; break; }
          }
        }
        end += best;
      }
      const literal = src.slice(i, end);
      const v = parseValue(literal);
      if (!isFinite(v)) return { toks, error: `bad numeric literal "${literal}" at ${i}` };
      toks.push({ k: "num", v });
      i = end;
      continue;
    }
    // identifiers
    if ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_") {
      let j = i + 1;
      while (j < n && /[a-zA-Z0-9_]/.test(src[j])) j++;
      toks.push({ k: "id", v: src.slice(i, j) });
      i = j;
      continue;
    }
    // operators
    let matched = false;
    for (const op of MULTI) {
      if (src.startsWith(op, i)) { toks.push({ k: "op", v: op }); i += op.length; matched = true; break; }
    }
    if (matched) continue;
    if ("+-*/^<>=!".indexOf(c) >= 0) { toks.push({ k: "op", v: c }); i++; continue; }
    return { toks, error: `unexpected character '${c}' at ${i}` };
  }
  toks.push({ k: "eof" });
  return { toks };
}

// ───── parser ─────────────────────────────────────────────────────────────
class Parser {
  constructor(public toks: Tok[], public p = 0) {}
  peek(): Tok { return this.toks[this.p]; }
  eat(k?: string): Tok { const t = this.toks[this.p++]; if (k && t.k !== k) throw new Error(`expected ${k}, got ${t.k}`); return t; }
  parseExpr(): BNode { return this.parseTernary(); }
  private parseTernary(): BNode {
    const c = this.parseOr();
    if (this.peek().k === "qmark") {
      this.eat("qmark");
      const a = this.parseTernary();
      const colon = this.peek();
      if (colon.k !== "colon") throw new Error(`expected ':' in ternary at token ${this.p}`);
      this.eat("colon");
      const b = this.parseTernary();
      return { kind: "tern", c, a, b };
    }
    return c;
  }
  private parseOr(): BNode {
    let a = this.parseAnd();
    while (this.peek().k === "op" && (this.peek() as { v: string }).v === "||") {
      this.eat();
      const b = this.parseAnd();
      a = { kind: "bin", op: "||", a, b };
    }
    return a;
  }
  private parseAnd(): BNode {
    let a = this.parseCmp();
    while (this.peek().k === "op" && (this.peek() as { v: string }).v === "&&") {
      this.eat();
      const b = this.parseCmp();
      a = { kind: "bin", op: "&&", a, b };
    }
    return a;
  }
  private parseCmp(): BNode {
    const a = this.parseSum();
    const t = this.peek();
    if (t.k === "op" && ["==", "!=", "<", "<=", ">", ">="].includes(t.v)) {
      this.eat();
      const b = this.parseSum();
      return { kind: "bin", op: t.v, a, b };
    }
    return a;
  }
  private parseSum(): BNode {
    let a = this.parseProd();
    while (this.peek().k === "op" && ((this.peek() as { v: string }).v === "+" || (this.peek() as { v: string }).v === "-")) {
      const op = (this.eat() as { v: string }).v;
      const b = this.parseProd();
      a = { kind: "bin", op, a, b };
    }
    return a;
  }
  private parseProd(): BNode {
    let a = this.parseUnary();
    while (this.peek().k === "op" && ((this.peek() as { v: string }).v === "*" || (this.peek() as { v: string }).v === "/")) {
      const op = (this.eat() as { v: string }).v;
      const b = this.parseUnary();
      a = { kind: "bin", op, a, b };
    }
    return a;
  }
  // PRECEDENCE: unary wraps pow, NOT the other way around. So `-2^2` parses as `-(2^2) = -4`,
  // matching Python, MATLAB, LTspice, and ngspice. The previous parser made it `(-2)^2 = 4`
  // which silently produced wrong answers for any expression with a unary minus over `^`.
  private parseUnary(): BNode {
    const t = this.peek();
    if (t.k === "op" && (t.v === "-" || t.v === "+" || t.v === "!")) {
      this.eat();
      const a = this.parseUnary();
      return { kind: "un", op: t.v, a };
    }
    return this.parsePow();
  }
  private parsePow(): BNode {
    const a = this.parseAtom();
    const t = this.peek();
    if (t.k === "op" && (t.v === "**" || t.v === "^")) {
      this.eat();
      // right-associative AND the RHS allows a unary, so `2 ^ -3` works.
      const b = this.parseUnary();
      return { kind: "bin", op: "^", a, b };
    }
    return a;
  }
  private parseAtom(): BNode {
    const t = this.peek();
    if (t.k === "num") { this.eat(); return { kind: "num", v: t.v }; }
    if (t.k === "lp") { this.eat(); const e = this.parseTernary(); this.eat("rp"); return e; }
    if (t.k === "id") {
      this.eat();
      const name = t.v;
      // Function call?
      if (this.peek().k === "lp") {
        this.eat("lp");
        // Special-case V(...) and I(...): args are node names / source names, not expressions.
        if (name === "V" || name === "v") {
          // V(node) or V(a, b)
          const a = this.parseNodeName();
          if (this.peek().k === "comma") {
            this.eat("comma");
            const b = this.parseNodeName();
            this.eat("rp");
            return { kind: "nodeVDiff", n1: a, n2: b };
          }
          this.eat("rp");
          return { kind: "nodeV", node: a };
        }
        if (name === "I" || name === "i") {
          const a = this.parseNodeName();
          this.eat("rp");
          return { kind: "branchI", src: a };
        }
        // general n-ary function call
        const args: BNode[] = [];
        if (this.peek().k !== "rp") {
          args.push(this.parseTernary());
          while (this.peek().k === "comma") { this.eat("comma"); args.push(this.parseTernary()); }
        }
        this.eat("rp");
        return { kind: "fn", name, args };
      }
      // Bare identifier reserved set. Comparison is case-insensitive so users can type
      // TIME / Time / time interchangeably; same for the constants.
      const lower = name.toLowerCase();
      if (lower === "time" || lower === "t") return { kind: "time" };
      if (lower === "pi")  return { kind: "num", v: Math.PI };
      if (lower === "e")   return { kind: "num", v: Math.E };
      throw new Error(`unknown identifier "${name}" - bare identifiers must be one of "time" / "t" / "pi" / "e"; node voltages use V(node).`);
    }
    throw new Error(`unexpected token at position ${this.p}`);
  }
  /** Read a node-name argument from inside V(...) or I(...). Accepts identifiers OR integer
   *  numbers (so V(0) parses as the ground reference, not as the literal zero). */
  private parseNodeName(): string {
    const t = this.peek();
    if (t.k === "id") { this.eat(); return t.v; }
    if (t.k === "num") {
      this.eat();
      // Only accept clean integers as node names - fractional/SI-suffixed numbers don't make
      // sense as node identifiers and almost certainly indicate a user mistake.
      if (Number.isInteger(t.v)) return String(t.v);
      throw new Error(`V(...) / I(...) expects a node/source name; got numeric literal ${t.v}`);
    }
    throw new Error(`V(...) / I(...) expects a node/source name`);
  }
}

// Walk the AST and collect distinct node-name and branch-source references.
function collectRefs(ast: BNode): { nodeRefs: string[]; branchRefs: string[]; hasTime: boolean } {
  const nodeSet = new Set<string>(); const branchSet = new Set<string>(); let hasTime = false;
  const walk = (n: BNode): void => {
    switch (n.kind) {
      case "num": return;
      case "time": hasTime = true; return;
      case "nodeV": if (n.node !== "0") nodeSet.add(n.node); return;
      case "nodeVDiff": if (n.n1 !== "0") nodeSet.add(n.n1); if (n.n2 !== "0") nodeSet.add(n.n2); return;
      case "branchI": branchSet.add(n.src); return;
      case "fn": n.args.forEach(walk); return;
      case "bin": walk(n.a); walk(n.b); return;
      case "un": walk(n.a); return;
      case "tern": walk(n.c); walk(n.a); walk(n.b); return;
    }
  };
  walk(ast);
  return { nodeRefs: [...nodeSet], branchRefs: [...branchSet], hasTime };
}

// ───── public API ─────────────────────────────────────────────────────────
export function compileExpr(expr: string): { compiled?: CompiledBExpr; error?: string } {
  const trimmed = (expr ?? "").trim();
  if (!trimmed) return { error: "empty expression" };
  const { toks, error: tokErr } = tokenize(trimmed);
  if (tokErr) return { error: tokErr };
  try {
    const p = new Parser(toks);
    const ast = p.parseExpr();
    if (p.peek().k !== "eof") return { error: `unexpected trailing tokens after ${p.p}` };
    const refs = collectRefs(ast);
    return { compiled: { ast, ...refs, raw: trimmed } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export function evalCompiled(c: CompiledBExpr, env: BEvalEnv): number {
  return evalNode(c.ast, env);
}

function evalNode(n: BNode, env: BEvalEnv): number {
  switch (n.kind) {
    case "num": return n.v;
    case "time": return isFinite(env.time) ? env.time : 0;
    case "nodeV": return n.node === "0" ? 0 : env.nodeV(n.node);
    case "nodeVDiff": return (n.n1 === "0" ? 0 : env.nodeV(n.n1)) - (n.n2 === "0" ? 0 : env.nodeV(n.n2));
    case "branchI": return env.branchI(n.src);
    case "un": {
      const v = evalNode(n.a, env);
      if (n.op === "-") return -v;
      if (n.op === "+") return v;
      if (n.op === "!") return v ? 0 : 1;
      return NaN;
    }
    case "bin": {
      // Short-circuit logical: don't evaluate b unless needed.
      if (n.op === "&&") return evalNode(n.a, env) && evalNode(n.b, env) ? 1 : 0;
      if (n.op === "||") return evalNode(n.a, env) || evalNode(n.b, env) ? 1 : 0;
      const a = evalNode(n.a, env), b = evalNode(n.b, env);
      switch (n.op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": {
          // Smooth division for Newton stability: if |b| is tiny, soften the singularity using
          // a sign-preserving floor. Previously we returned sign(a)·1e30 on b===0, which made
          // the Jacobian discontinuous and broke convergence whenever b crossed zero during
          // iteration. Now: if |b| < eps, lerp toward a/eps.
          const epsB = 1e-30;
          if (Math.abs(b) < epsB) return a / (b >= 0 ? epsB : -epsB);
          return a / b;
        }
        case "^": {
          // Math.pow returns NaN for negative base with fractional exponent - that's the
          // CORRECT mathematical answer (sqrt(-3) ∉ R). We surface NaN to the caller, which
          // propagates into the matrix solver (which now fails loudly). The previous code
          // silently returned pow(|a|, b), masking real user errors like sqrt(V(in)) when
          // V(in) goes briefly negative. If you genuinely want the magnitude, write abs(V)^b.
          return Math.pow(a, b);
        }
        case "==": return a === b ? 1 : 0;
        case "!=": return a !== b ? 1 : 0;
        case "<": return a < b ? 1 : 0;
        case "<=": return a <= b ? 1 : 0;
        case ">": return a > b ? 1 : 0;
        case ">=": return a >= b ? 1 : 0;
      }
      return NaN;
    }
    case "tern": return evalNode(n.c, env) ? evalNode(n.a, env) : evalNode(n.b, env);
    case "fn": {
      // Special-case lazy functions BEFORE eagerly evaluating arguments. `if(cond, then, else)`
      // is the canonical singularity guard ("if (V(x) > 0) 1/V(x) else 0") and must NOT evaluate
      // the unchosen branch - otherwise the guard is useless. Same for the C-style ternary.
      const ln = n.name.toLowerCase();
      if (ln === "if" && n.args.length === 3) {
        return evalNode(n.args[0], env) ? evalNode(n.args[1], env) : evalNode(n.args[2], env);
      }
      return evalFn(n.name, n.args.map((x) => evalNode(x, env)), n.args, env);
    }
  }
}

function evalFn(name: string, args: number[], rawArgs: BNode[], env: BEvalEnv): number {
  const n = name.toLowerCase();
  switch (n) {
    case "exp":   return Math.exp(clampExp(args[0]));
    case "log":   case "ln": return Math.log(Math.max(args[0], 1e-300));
    case "log10": return Math.log10(Math.max(args[0], 1e-300));
    case "sqrt":  return Math.sqrt(Math.max(args[0], 0));
    case "abs":   return Math.abs(args[0]);
    case "sgn":   return Math.sign(args[0]);
    case "sin":   return Math.sin(args[0]);
    case "cos":   return Math.cos(args[0]);
    case "tan":   return Math.tan(args[0]);
    case "tanh":  return Math.tanh(args[0]);
    case "atan":  return Math.atan(args[0]);
    case "asin":  return Math.asin(Math.max(-1, Math.min(1, args[0])));
    case "acos":  return Math.acos(Math.max(-1, Math.min(1, args[0])));
    case "min":   return Math.min(...args);
    case "max":   return Math.max(...args);
    case "pow": {
      // Sanitize same as `^` so a Newton iterate with a transiently-negative base doesn't yield
      // NaN that propagates through the matrix solve.
      const r = Math.pow(args[0], args[1]);
      if (isFinite(r)) return r;
      if (args[0] < 0 && args[1] !== Math.round(args[1])) {
        const r2 = Math.pow(Math.abs(args[0]), args[1]);
        return isFinite(r2) ? r2 : 0;
      }
      return 0;
    }
    case "if":    return evalNode(rawArgs[0], env) ? args[1] : args[2];
    case "smooth_if": {
      // Differentiable conditional - same as if(c>0, a, b) but with a tanh-smoothed crossover
      // over a width `eps`. Use this instead of `if` whenever the controlling signal can stay
      // near the boundary across Newton iterations, where the hard `if` makes the FD Jacobian
      // discontinuous (steps of (a-b)/eps_fd → singular matrix). With smooth_if the Jacobian is
      // O(1/eps) but FINITE and convergent.
      //   smooth_if(cond, a, b, eps)  →  a·s(cond/eps) + b·(1-s(cond/eps))   where s = ½(1+tanh)
      const cond = args[0], a = args[1], b = args[2];
      const eps = args.length > 3 && isFinite(args[3]) && args[3] > 0 ? args[3] : 1e-3;
      const s = 0.5 * (1 + Math.tanh(cond / eps));
      return a * s + b * (1 - s);
    }
    case "limit": return Math.max(args[1], Math.min(args[2], args[0]));
    case "pwl": {
      // pwl(x, x1, v1, x2, v2, …) - linear interpolation, flat outside.
      const x = args[0];
      const pts: [number, number][] = [];
      for (let i = 1; i + 1 < args.length; i += 2) pts.push([args[i], args[i + 1]]);
      pts.sort((p, q) => p[0] - q[0]);
      if (pts.length === 0) return 0;
      if (x <= pts[0][0]) return pts[0][1];
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, v0] = pts[i], [x1, v1] = pts[i + 1];
        if (x >= x0 && x <= x1) return x1 === x0 ? v1 : v0 + (v1 - v0) * ((x - x0) / (x1 - x0));
      }
      return pts[pts.length - 1][1];
    }
  }
  return NaN;
}

// Clamp exponent argument so Math.exp can't overflow to Infinity inside Newton iteration.
// 700 ≈ ln(Number.MAX_VALUE); we keep some headroom.
const clampExp = (x: number) => x > 700 ? 700 : x < -700 ? -700 : x;

/** Compute the value and a finite-difference Jacobian wrt all referenced node voltages and
 *  branch currents. Central differences are about 2× more accurate than forward differences
 *  at the same cost (2N+1 evals vs. N+1) and avoid bias in convex regions, which matters
 *  when the expression is something like exp(V(a)) used in a comparator. */
export function evalAndJacobian(
  c: CompiledBExpr,
  env: BEvalEnv,
): { value: number; dV: Record<string, number>; dI: Record<string, number> } {
  const value = evalCompiled(c, env);
  const dV: Record<string, number> = {};
  const dI: Record<string, number> = {};
  // Step size: tied to the operating-point scale of each variable. 1e-6·max(|v|, 1) gives
  // single-precision relative accuracy without amplifying noise on small voltages.
  for (const node of c.nodeRefs) {
    const v0 = env.nodeV(node);
    const eps = Math.max(1e-6 * Math.abs(v0), 1e-9);
    const env_p = makePerturbedEnv(env, "V", node, eps);
    const env_m = makePerturbedEnv(env, "V", node, -eps);
    const fp = evalCompiled(c, env_p);
    const fm = evalCompiled(c, env_m);
    dV[node] = (fp - fm) / (2 * eps);
  }
  for (const src of c.branchRefs) {
    const i0 = env.branchI(src);
    const eps = Math.max(1e-9 * Math.abs(i0), 1e-12);
    const env_p = makePerturbedEnv(env, "I", src, eps);
    const env_m = makePerturbedEnv(env, "I", src, -eps);
    const fp = evalCompiled(c, env_p);
    const fm = evalCompiled(c, env_m);
    dI[src] = (fp - fm) / (2 * eps);
  }
  return { value, dV, dI };
}

function makePerturbedEnv(env: BEvalEnv, kind: "V" | "I", key: string, eps: number): BEvalEnv {
  return {
    time: env.time,
    nodeV: kind === "V" ? (n) => (n === key ? env.nodeV(n) + eps : env.nodeV(n)) : env.nodeV,
    branchI: kind === "I" ? (s) => (s === key ? env.branchI(s) + eps : env.branchI(s)) : env.branchI,
  };
}
