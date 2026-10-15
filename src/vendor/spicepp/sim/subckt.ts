/**
 * .subckt parser + expander.
 *
 * Vendor SPICE model files (ADI / TI / LT op-amps, references, comparators, etc.) ship as
 * `.subckt NAME pin1 pin2 ... / <body> / .ends` blocks. The Volt simulator's engine only knows
 * primitive elements (R/C/L/V/I/D/E/G/F/H/OPAMP/M/Q/K/B), so subcircuit instances are inlined
 * BEFORE the engine sees the netlist:
 *
 *   1. parseSubckts(text)            - read the concatenated .subckt block text and produce
 *                                       a Registry: name → SubcktDef.
 *   2. expandSubckts(elements, reg)  - walk the element list and recursively replace every X
 *                                       instance with mangled-node primitive elements.
 *
 * Scope:
 *   • Body element types: R, C, L, V, I, D, M, Q, E, G, F, H, B, X (nested). K not allowed inside
 *     subckts (since K refers to L names by global handle, and inner L names get mangled - the
 *     user can place the K at top level using the mangled name if they really need it).
 *   • PARAMETERS. `.subckt NAME p1 p2 params: gain=10 rl={2*rbase}` declares defaults; an
 *     instance overrides them (`X1 a b MYSUB gain=22`); element values may be arbitrary
 *     expressions in those parameters. Parameters are resolved to numbers ONCE PER INSTANCE,
 *     so two instances of the same subckt with different parameters are genuinely different.
 *   • `.param` (file scope) and `.func NAME(a,b)={expr}` (file scope) are honoured.
 *   • Behavioural B sources, plus E/G `VALUE={}` / `TABLE()` / `POLY()` and F/H `POLY()`, which
 *     are all rewritten into B sources - that is how post-2005 vendor macromodels are written
 *     and it is why almost all of them used to die on import here.
 *   • Internal `.model` lines are captured per-subckt and shadow the outer registry (SPICE
 *     inner-wins scoping) - common in Boyle op-amp macromodels.
 *   • Recursion: detected and rejected with a clear error (depth cap = 32 to also catch
 *     extremely deep but ultimately-terminating chains).
 *   • ENCRYPTED vendor models are DETECTED and REFUSED, never partially parsed. See the note
 *     at `parseSubckts` - an encrypted block parses to an EMPTY body, which expands to an open
 *     circuit, which simulates fine and reports numbers that are entirely fictional.
 *
 * ONE EXPRESSION COMPILER. Every expression in this file - parameter defaults, element values,
 * B-source bodies, TABLE/POLY translations - goes through `compileExpr`/`evalCompiled` from
 * src/lib/sim/bsource.ts. There is deliberately no second evaluator: a divergence between two
 * expression semantics is exactly the sort of bug that produces confident wrong numbers.
 */
import type { NetlistElement, SimError } from "./types";
import { parseValue } from "../units";
import {
  parseModelsFromJoinedLines, resolveDiode, resolveMos, resolveBjt, detectEncryptedModel,
  type ModelRegistry,
} from "./model_parser";
import { compileExpr, evalCompiled } from "./bsource";

/**
 * A body value. A plain numeric literal is resolved at PARSE time and stays a number (so the
 * overwhelmingly common numeric-literal subckt costs nothing extra). Anything else is kept as
 * raw expression text and evaluated at EXPANSION time against that instance's parameter scope -
 * it has to be, because the same `{rl}` means different things in two different instances.
 */
export type ValueSpec = number | string;

/** File-level scope shared by every .subckt parsed out of one text blob. */
export interface SubcktScope {
  /** `.param NAME=<expr>` — raw text, keys lower-cased. Resolved per instance (a subckt param
   *  of the same name shadows it, which is why we keep the text rather than a number). */
  params: Map<string, string>;
  /** `.func NAME(a,b)={expr}` — expanded textually at evaluation time. */
  funcs: Map<string, { args: string[]; body: string }>;
}

export interface SubcktDef {
  name: string;
  /** Pin names in the order they appear after `.subckt NAME ...`. Body element node refs that
   *  match a pin name are replaced with the instance's connected node at expansion time. */
  pins: string[];
  /** Body element templates. Node fields reference either pin names (substituted) or
   *  subckt-local node names (mangled with `<instance>.` prefix). */
  body: BodyElement[];
  /** Internal .model lines declared inside the subckt body. Resolved at expansion time and
   *  shadowed by the outer (global) registry to match SPICE scoping (inner wins). Common in
   *  Boyle op-amp macromodels which carry their own NPN/PNP transistors. */
  models: ModelRegistry;
  /** `params:` defaults from the .subckt line — lower-cased name → raw expression text. */
  defaults: Map<string, string>;
  /** The file-level `.param`/`.func` scope this definition was parsed in. Carried on the def so
   *  expandSubckts() can evaluate expressions without a signature change at every call site. */
  scope: SubcktScope;
}

/** Body element template - node fields are strings (pin name or local-net name). */
export type BodyElement =
  | { type: "R"; name: string; n1: string; n2: string; value: ValueSpec }
  | { type: "C"; name: string; n1: string; n2: string; value: ValueSpec; ic?: number }
  | { type: "L"; name: string; n1: string; n2: string; value: ValueSpec; ic?: number }
  | { type: "V"; name: string; n1: string; n2: string; dc: ValueSpec }
  | { type: "I"; name: string; n1: string; n2: string; dc: ValueSpec }
  | { type: "D"; name: string; nA: string; nK: string; modelName: string; area?: ValueSpec }
  | { type: "M"; name: string; nD: string; nG: string; nS: string; nB: string; modelName: string; W?: ValueSpec; L?: ValueSpec }
  | { type: "Q"; name: string; nC: string; nB: string; nE: string; modelName: string; area?: ValueSpec }
  | { type: "E"; name: string; n1: string; n2: string; nc1: string; nc2: string; gain: ValueSpec }
  | { type: "G"; name: string; n1: string; n2: string; nc1: string; nc2: string; gain: ValueSpec }
  | { type: "F"; name: string; n1: string; n2: string; vsrc: string; gain: ValueSpec }
  | { type: "H"; name: string; n1: string; n2: string; vsrc: string; gain: ValueSpec }
  /** Behavioural source. `expr` still carries BODY-LOCAL node/source names; expandSubckts
   *  rewrites the V(...)/I(...) references to the mangled names before emitting. */
  | { type: "B"; name: string; n1: string; n2: string; ctrl: "V" | "I"; expr: string }
  | { type: "X"; name: string; subcktName: string; nodes: string[]; params: Map<string, string> };

export type SubcktRegistry = Map<string, SubcktDef>;

const emptyScope = (): SubcktScope => ({ params: new Map(), funcs: new Map() });

/** Parse a concatenated text blob containing zero or more .subckt … .ends blocks plus arbitrary
 *  other text (.model lines, comments, empty lines). Returns a name-keyed registry plus any
 *  syntax warnings encountered. The input is typically `doc.models.join("\n")`. */
export function parseSubckts(text: string): { registry: SubcktRegistry; errors: SimError[]; scope: SubcktScope } {
  const registry: SubcktRegistry = new Map();
  const errors: SimError[] = [];
  const scope = emptyScope();

  // ENCRYPTION GATE. Run before anything else and on the RAW text, because the comment stripper
  // below throws away the vendor banner that says "this model is encrypted". We still attempt a
  // best-effort parse afterwards (a library can mix one encrypted part with several open ones),
  // but every individual block is re-checked and an unreadable one is REFUSED rather than
  // registered with an empty body - see the per-block check further down.
  const encTop = detectEncryptedModel(text, "The subcircuit library pasted into this document");
  if (encTop) errors.push(encTop);

  // Pre-process: drop `*`-prefixed comments and lower-case the leading directive token for
  // case-insensitive matching, but preserve original casing of identifiers and values.
  // Continuation lines (`+ ...`) are joined onto the preceding line - SPICE convention.
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/;.*$/, "");                    // SPICE inline comment
    if (/^\s*\*/.test(line) || /^\s*$/.test(line)) continue; // comment / blank
    if (/^\s*\+/.test(line) && lines.length > 0) {
      lines[lines.length - 1] += " " + line.replace(/^\s*\+\s*/, "");
    } else {
      lines.push(line.trim());
    }
  }

  // File-scope `.param` and `.func`, collected in a first pass so a body line may reference a
  // `.param` declared textually AFTER it (SPICE decks are not required to be topologically
  // ordered). Values stay as TEXT: they are resolved per instance, because a `.subckt` parameter
  // of the same name legitimately shadows a global one and resolving early would lose that.
  for (const ln of lines) {
    const fm = /^\.func\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*=?\s*(.+)$/i.exec(ln);
    if (fm) {
      const args = fm[2].split(",").map((s) => s.trim()).filter(Boolean);
      scope.funcs.set(fm[1].toLowerCase(), { args, body: stripBraces(fm[3]) });
      continue;
    }
    const pm = /^\.param\s+(.+)$/i.exec(ln);
    if (!pm) continue;
    for (const [k, v] of splitAssignments(pm[1])) scope.params.set(k, v);
  }

  // Scan for .subckt … .ends pairs. A nested .subckt inside another is treated as the end of the
  // outer's body and the start of a new top-level subckt (this matches SPICE3 - there is no real
  // nesting; .subckts are flat in the source file).
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = /^\.subckt\s+(\S+)\s+(.*)$/i.exec(line);
    if (!m) { i++; continue; }
    const name = m[1];
    // Pin list, then (optionally after a `params:` keyword) the parameter defaults. SPICE
    // convention: the pin list ends at the first `k=v` token or at `params:`, whichever is first.
    const restToks = m[2].split(/\s+/).filter(Boolean);
    const pins: string[] = [];
    const defaults = new Map<string, string>();
    {
      let k = 0;
      for (; k < restToks.length; k++) {
        const tok = restToks[k];
        if (/^params:?$/i.test(tok) || tok.includes("=")) break;
        pins.push(tok);
      }
      // Everything from here is `k=v` (possibly spaced as `k = v`, possibly with `{}` values).
      const tail = restToks.slice(k).filter((t) => !/^params:?$/i.test(t)).join(" ");
      for (const [pk, pv] of splitAssignments(tail)) defaults.set(pk, pv);
    }
    if (defaults.size) {
      // Surface the knobs. When someone pastes a vendor macromodel the first question is "what
      // can I change?", and the answer is otherwise buried in the .subckt line. Info severity:
      // this is discoverability, not a problem.
      errors.push({
        severity: "info",
        message: `.subckt ${name}: exposes ${defaults.size} parameter${defaults.size === 1 ? "" : "s"} — ` +
          `${[...defaults].map(([k, v]) => `${k}=${v}`).join(", ")}. Override at the instance, e.g. "X1 ${pins.join(" ")} ${name} ${[...defaults.keys()][0]}=…".`,
      });
    }
    if (pins.length === 0) {
      errors.push({ severity: "warning", message: `.subckt ${name}: declared with no pins; skipped.` });
      // Advance to next .subckt or .ends - don't ingest the body.
      i++;
      while (i < lines.length && !/^\.ends\b/i.test(lines[i]) && !/^\.subckt\b/i.test(lines[i])) i++;
      if (i < lines.length && /^\.ends\b/i.test(lines[i])) i++;
      continue;
    }
    // Names visible inside this body: file `.param`s + this subckt's own `params:` defaults.
    // Used only to decide whether an unresolvable token deserves a parse-time warning.
    const known = new Set<string>([...scope.params.keys(), ...defaults.keys()]);
    // Consume the body up to .ends (or the next .subckt - be forgiving).
    const body: BodyElement[] = [];
    const modelLines: string[] = [];
    const bodyLines: string[] = [];
    i++;
    while (i < lines.length) {
      const bl = lines[i];
      if (/^\.ends\b/i.test(bl)) { i++; break; }
      if (/^\.subckt\b/i.test(bl)) {
        errors.push({ severity: "warning", message: `.subckt ${name}: missing .ends - terminated at the next .subckt.` });
        break;   // don't consume - let the outer loop pick up the new .subckt
      }
      bodyLines.push(bl);
      if (/^\.model\b/i.test(bl)) {
        // Inner .model - captured into the subckt's local registry. Resolved at expansion
        // time and overrides any top-level model of the same name (SPICE inner-wins scoping).
        modelLines.push(bl);
        i++; continue;
      }
      if (/^\.(param|func)\b/i.test(bl)) {
        // Collected into the file scope by the first pass above.
        i++; continue;
      }
      if (/^\./.test(bl)) {
        // Other directives (.options, .ic, …) - not honoured inside a subcircuit.
        errors.push({ severity: "info", message: `.subckt ${name}: directive "${bl}" ignored (element lines, .model, .param and .func are honoured inside a subcircuit).` });
        i++; continue;
      }
      const el = parseBodyLine(bl, name, errors, known, scope.funcs);
      if (el) body.push(el);
      i++;
    }
    // PER-BLOCK ENCRYPTION / UNREADABILITY GATE. Two signals, either of which means "do not
    // register this": the body looks binary/armoured, or it has content that produced not one
    // recognisable element. Registering it anyway would give an X instance an EMPTY body, i.e.
    // an open circuit that simulates cleanly and reports fiction.
    const encBlock = detectEncryptedModel(bodyLines.join("\n"), `.subckt ${name}`);
    const unreadable = bodyLines.length >= 3 && body.length === 0 && modelLines.length === 0;
    if (encBlock || unreadable) {
      errors.push(encBlock ?? {
        severity: "error",
        message: `.subckt ${name}: ${bodyLines.length} body lines and not one recognisable SPICE element — the block is either encrypted or in a dialect Spice++ cannot read. ` +
          `It has NOT been registered: an empty subcircuit body is an open circuit, and simulating one silently produces numbers that describe nothing. ` +
          `Paste an unencrypted model, or use a built-in Spice++ part (find_part).`,
      });
      continue;
    }
    const internalModels = parseModelsFromJoinedLines(modelLines, errors);
    const key = name.toUpperCase();
    if (registry.has(key)) {
      errors.push({ severity: "warning", message: `.subckt ${name} is defined more than once - the later definition overwrites the earlier.` });
    }
    registry.set(key, { name, pins, body, models: internalModels, defaults, scope });
  }
  return { registry, errors, scope };
}

// ─────────────────────────────────────────────────────────────────────────
// Body-line parsing

/** Parse a single SPICE-syntax body line into a BodyElement. Returns null on unknown/unsupported
 *  syntax (a warning is pushed into `errors`). `known` is the set of parameter names visible in
 *  this subcircuit; a token that is neither a literal nor built from known names warns HERE,
 *  early, rather than silently becoming 0 at simulation time. */
function parseBodyLine(
  line: string, subckt: string, errors: SimError[],
  known: Set<string>, funcs: Map<string, { args: string[]; body: string }>,
): BodyElement | null {
  const toks = line.split(/\s+/).filter(Boolean);
  if (toks.length === 0) return null;
  const refdes = toks[0];
  const prefix = refdes[0].toUpperCase();

  /** Literal → number; anything else → raw text kept for per-instance evaluation. Warns now if
   *  the text references a name that cannot possibly resolve, which is the check the old
   *  `.param`-only implementation did and which callers (and tests) rely on. */
  const nv = (s: string): ValueSpec => {
    const v = parseValue(s);
    if (isFinite(v)) return v;
    const expr = stripBraces(s);
    const unknown = freeIdentifiers(expr).filter((id) => !known.has(id) && !funcs.has(id) && !RESERVED_IDS.has(id));
    if (unknown.length) {
      errors.push({
        severity: "warning",
        message: `.subckt ${subckt}: cannot resolve "${s}" in line "${line}" — ${unknown.map((u) => `"${u}"`).join(", ")} ` +
          `${unknown.length === 1 ? "is" : "are"} not a numeric literal, a .param, a .func, or a parameter declared on the .subckt line. ` +
          `Add it to the .subckt's "params:" list or to a .param directive.`,
      });
    }
    return expr;
  };

  switch (prefix) {
    case "R": if (toks.length < 4) break; return { type: "R", name: refdes, n1: toks[1], n2: toks[2], value: nv(toks[3]) };
    case "C": if (toks.length < 4) break; return { type: "C", name: refdes, n1: toks[1], n2: toks[2], value: nv(toks[3]) };
    case "L": if (toks.length < 4) break; return { type: "L", name: refdes, n1: toks[1], n2: toks[2], value: nv(toks[3]) };
    case "V": if (toks.length < 4) break; return { type: "V", name: refdes, n1: toks[1], n2: toks[2], dc: parseDCSpec(toks.slice(3).join(" "), nv, subckt, line, errors) };
    case "I": if (toks.length < 4) break; return { type: "I", name: refdes, n1: toks[1], n2: toks[2], dc: parseDCSpec(toks.slice(3).join(" "), nv, subckt, line, errors) };
    case "D": {
      if (toks.length < 4) break;
      // `D name A K MODEL [area]` — the optional 5th token is the area multiplier.
      return { type: "D", name: refdes, nA: toks[1], nK: toks[2], modelName: toks[3], area: toks[4] && !toks[4].includes("=") ? nv(toks[4]) : undefined };
    }
    case "M": {
      if (toks.length < 6) break;
      // `M name D G S B MODEL [W=… L=…]` — W/L are what set the device size, and dropping them
      // (as v1 did) silently simulated every vendor FET at the 1 µm × 1 µm default. That is a
      // 10-1000× current error with no visible sign, so they are parsed now.
      const kv = new Map(splitAssignments(toks.slice(6).join(" ")));
      return {
        type: "M", name: refdes, nD: toks[1], nG: toks[2], nS: toks[3], nB: toks[4], modelName: toks[5],
        W: kv.has("w") ? nv(kv.get("w")!) : undefined,
        L: kv.has("l") ? nv(kv.get("l")!) : undefined,
      };
    }
    case "Q": {
      if (toks.length < 5) break;
      return { type: "Q", name: refdes, nC: toks[1], nB: toks[2], nE: toks[3], modelName: toks[4], area: toks[5] && !toks[5].includes("=") ? nv(toks[5]) : undefined };
    }
    case "E": case "G": return parseControlledSource(prefix, refdes, toks, line, subckt, errors, nv);
    case "F": case "H": return parseControlledSource(prefix, refdes, toks, line, subckt, errors, nv);
    case "B": {
      // `B name n+ n- V=<expr>` or `I=<expr>` (LTspice also writes `V={…}`).
      if (toks.length < 4) break;
      const rest = toks.slice(3).join(" ");
      const bm = /^\s*([VI])\s*=\s*([\s\S]+)$/i.exec(rest);
      if (!bm) {
        errors.push({ severity: "warning", message: `.subckt ${subckt}: B element "${refdes}" needs "V=<expr>" or "I=<expr>"; got "${rest}".` });
        return null;
      }
      return { type: "B", name: refdes, n1: toks[1], n2: toks[2], ctrl: bm[1].toUpperCase() === "V" ? "V" : "I", expr: stripBraces(bm[2]) };
    }
    case "X": {
      // X NAME node1 node2 ... SUBCKT_NAME [params:] [k=v …]
      // Parameter assignments are stripped first so the "last token is the subckt name" rule
      // still works on a modern instance line.
      if (toks.length < 3) break;
      const params = new Map<string, string>();
      const positional: string[] = [];
      const assignTail: string[] = [];
      let inParams = false;
      for (let k = 1; k < toks.length; k++) {
        const t = toks[k];
        if (/^params:?$/i.test(t)) { inParams = true; continue; }
        if (inParams || t.includes("=")) { assignTail.push(t); continue; }
        positional.push(t);
      }
      for (const [pk, pv] of splitAssignments(assignTail.join(" "))) params.set(pk, pv);
      if (positional.length < 2) break;
      const subName = positional[positional.length - 1];
      return { type: "X", name: refdes, subcktName: subName, nodes: positional.slice(0, -1), params };
    }
    default:
      errors.push({ severity: "warning", message: `.subckt ${subckt}: unsupported element "${refdes}" - only R/C/L/V/I/D/M/Q/E/G/F/H/B/X are honored.` });
      return null;
  }
  errors.push({ severity: "warning", message: `.subckt ${subckt}: malformed line "${line}" - too few tokens for a "${prefix}" element.` });
  return null;
}

/**
 * E/G/F/H, including the four forms that made vendor macromodels unusable:
 *
 *   E1 o 0 in 0 12                       plain gain                      → E
 *   E1 o 0 VALUE={V(a)*V(b)}             behavioural                     → B
 *   E1 o 0 TABLE {V(a)} = (0,0) (1,5)    piecewise-linear transfer       → B (pwl)
 *   E1 o 0 POLY(2) (a,0) (b,0) 0 .5 .5   polynomial in N controls        → B
 *   F1 o 0 POLY(5) v1 v2 … 0 k1 … k5     polynomial in N branch currents → B
 *
 * Rewriting the last three into B sources rather than adding three new element types to the
 * engine keeps ONE nonlinear stamping path (and one Jacobian) - fewer places for the numbers
 * to diverge. The B expression here still carries BODY-LOCAL names; expandSubckts rewrites them.
 */
function parseControlledSource(
  prefix: string, refdes: string, toks: string[], line: string, subckt: string,
  errors: SimError[], nv: (s: string) => ValueSpec,
): BodyElement | null {
  const isCurrentControlled = prefix === "F" || prefix === "H";
  const outputsCurrent = prefix === "G" || prefix === "F";     // G/F push current; E/H force voltage
  const n1 = toks[1], n2 = toks[2];
  const rest = toks.slice(3).join(" ").trim();
  const mkB = (expr: string): BodyElement => ({ type: "B", name: refdes, n1, n2, ctrl: outputsCurrent ? "I" : "V", expr });

  // ── VALUE={expr} / bare {expr} ──────────────────────────────────────────
  const vm = /^value\s*=?\s*([\s\S]+)$/i.exec(rest);
  if (vm) return mkB(stripBraces(vm[1]));
  if (rest.startsWith("{")) return mkB(stripBraces(rest));

  // ── TABLE {ctrl} = (x1,y1) (x2,y2) … ───────────────────────────────────
  const tm = /^table\s*(\{[^}]*\}|\([^)]*\)|\S+)\s*=?\s*([\s\S]*)$/i.exec(rest);
  if (tm) {
    const ctrl = stripBraces(tm[1]);
    const nums = tm[2].replace(/[(),]/g, " ").split(/\s+/).filter(Boolean).map((t) => parseValue(t));
    if (nums.length < 4 || nums.length % 2 !== 0 || nums.some((x) => !isFinite(x))) {
      errors.push({ severity: "warning", message: `.subckt ${subckt}: ${refdes} TABLE needs an even number (≥2) of numeric (x,y) pairs; got "${tm[2]}".` });
      return null;
    }
    // pwl() in bsource.ts sorts the breakpoints and extends flat outside the range, which is
    // exactly SPICE TABLE semantics.
    return mkB(`pwl(${ctrl}, ${nums.join(", ")})`);
  }

  // ── POLY(k) <k controls> c0 c1 … ───────────────────────────────────────
  const pm = /^poly\s*\(\s*(\d+)\s*\)\s*([\s\S]*)$/i.exec(rest);
  if (pm) {
    const k = parseInt(pm[1], 10);
    const flat = pm[2].replace(/[(),]/g, " ").split(/\s+/).filter(Boolean);
    const needed = isCurrentControlled ? k : 2 * k;
    if (k < 1 || flat.length < needed + 1) {
      errors.push({ severity: "warning", message: `.subckt ${subckt}: ${refdes} POLY(${pm[1]}) needs ${needed} controlling ${isCurrentControlled ? "source name(s)" : "node(s)"} plus at least one coefficient; got "${pm[2]}".` });
      return null;
    }
    const ctrls: string[] = [];
    if (isCurrentControlled) for (let j = 0; j < k; j++) ctrls.push(`I(${flat[j]})`);
    else for (let j = 0; j < k; j++) ctrls.push(`V(${flat[2 * j]},${flat[2 * j + 1]})`);
    const coeffs = flat.slice(needed).map((t) => parseValue(t));
    if (coeffs.some((c) => !isFinite(c))) {
      errors.push({ severity: "warning", message: `.subckt ${subckt}: ${refdes} POLY coefficients must be numeric literals; got "${flat.slice(needed).join(" ")}".` });
      return null;
    }
    if (k === 1) {
      // Single control: full 1-D polynomial c0 + c1·x + c2·x² + …
      const terms = coeffs.map((c, p) => (p === 0 ? `${c}` : p === 1 ? `${c}*${ctrls[0]}` : `${c}*${ctrls[0]}^${p}`));
      return mkB(terms.join(" + "));
    }
    // Multi-control: SPICE's ordering for the square/cross terms is positional and easy to get
    // subtly wrong. We implement the linear form exactly and REFUSE the rest rather than guess -
    // a mis-ordered cross term is a silent gain error inside somebody's macromodel.
    if (coeffs.length > k + 1) {
      errors.push({
        severity: "error",
        message: `.subckt ${subckt}: ${refdes} is POLY(${k}) with ${coeffs.length} coefficients — Spice++ implements the linear form (1 constant + ${k} first-order terms) only. ` +
          `Higher-order/cross terms in a multi-input POLY have a positional ordering that would have to be guessed, and a guessed coefficient is a silent gain error. ` +
          `Rewrite this element as a B source with the polynomial written out, e.g. "B${refdes.slice(1)} ${n1} ${n2} ${outputsCurrent ? "I" : "V"}={…}".`,
      });
      return null;
    }
    const terms = [`${coeffs[0]}`];
    for (let j = 0; j < k; j++) if (coeffs[j + 1] !== undefined) terms.push(`${coeffs[j + 1]}*${ctrls[j]}`);
    return mkB(terms.join(" + "));
  }

  // ── plain linear form ──────────────────────────────────────────────────
  if (isCurrentControlled) {
    if (toks.length < 5) return null;
    return prefix === "F"
      ? { type: "F", name: refdes, n1, n2, vsrc: toks[3], gain: nv(toks[4]) }
      : { type: "H", name: refdes, n1, n2, vsrc: toks[3], gain: nv(toks[4]) };
  }
  if (toks.length < 6) return null;
  return prefix === "E"
    ? { type: "E", name: refdes, n1, n2, nc1: toks[3], nc2: toks[4], gain: nv(toks[5]) }
    : { type: "G", name: refdes, n1, n2, nc1: toks[3], nc2: toks[4], gain: nv(toks[5]) };
}

/** Parse a V/I source-value tail. Only the DC operating value is honoured inside a subcircuit;
 *  a transient/AC function would need the engine's source machinery, which X expansion does not
 *  reach. That demotion used to be SILENT - it now warns, because a macromodel whose internal
 *  PULSE became a DC level is a circuit that behaves nothing like the datasheet part. */
function parseDCSpec(
  spec: string, nv: (s: string) => ValueSpec, subckt: string, line: string, errors: SimError[],
): ValueSpec {
  const s = spec.trim().replace(/^DC\s+/i, "");
  if (/^(sin|pulse|exp|pwl|sffm|noise)\s*\(/i.test(s) || /\bAC\s+\S/i.test(s)) {
    errors.push({
      severity: "warning",
      message: `.subckt ${subckt}: line "${line}" uses a time/AC-dependent source spec inside a subcircuit. Only the DC value is applied — the waveform is NOT reproduced. ` +
        `Move the source to the top level if its shape matters.`,
    });
    const lead = /^\w+\s*\(\s*([^\s,)]+)/.exec(s);
    return lead ? nv(lead[1]) : 0;
  }
  const first = s.split(/\s+/)[0] ?? "";
  return first ? nv(first) : 0;
}

// ─────────────────────────────────────────────────────────────────────────
// Expression evaluation — one compiler, reused (src/lib/sim/bsource.ts)

/** Bare identifiers bsource.ts resolves on its own; never treated as an undefined parameter. */
const RESERVED_IDS = new Set([
  "time", "t", "pi", "e",
  "exp", "log", "ln", "log10", "sqrt", "abs", "sgn", "sin", "cos", "tan", "tanh",
  "atan", "asin", "acos", "min", "max", "pow", "if", "smooth_if", "limit", "pwl", "v", "i",
]);

const stripBraces = (s: string): string => {
  const t = String(s ?? "").trim();
  return t.startsWith("{") && t.endsWith("}") ? t.slice(1, -1).trim() : t;
};

/** Split `a=1 b = 2k c={x*2}` into lower-cased key → raw value text. Tolerates spaces around
 *  `=` (SPICE allows them) and brace-wrapped values containing spaces. */
function splitAssignments(text: string): [string, string][] {
  const out: [string, string][] = [];
  // Collapse spaces around '=' first so "a = 1" and "a=1" tokenise the same way, then walk
  // tokens joining any that are inside an unbalanced { }.
  const norm = String(text ?? "").replace(/\s*=\s*/g, "=");
  const toks = norm.split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < toks.length) {
    let tok = toks[i++];
    while (braceDepth(tok) > 0 && i < toks.length) tok += " " + toks[i++];   // re-join `{a + b}`
    const eq = tok.indexOf("=");
    if (eq <= 0) continue;
    out.push([tok.slice(0, eq).trim().toLowerCase(), tok.slice(eq + 1).trim()]);
  }
  return out;
}
const braceDepth = (s: string) => (s.match(/\{/g)?.length ?? 0) - (s.match(/\}/g)?.length ?? 0);

/** Identifiers appearing in an expression that are NOT function-call heads and NOT preceded by a
 *  digit (so the `k` of `4.7k` and the `Meg` of `1Meg` are not mistaken for parameter names). */
function freeIdentifiers(expr: string): string[] {
  const out = new Set<string>();
  const re = /(?<![A-Za-z0-9_.])([A-Za-z_]\w*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr))) {
    const after = expr.slice(m.index + m[1].length).match(/^\s*\(/);
    if (after) continue;                       // function call head (or V(…)/I(…))
    out.add(m[1].toLowerCase());
  }
  return [...out];
}

/** Replace every free identifier that has a numeric binding with its literal value. Done
 *  textually and BEFORE compileExpr, because bsource.ts's grammar deliberately rejects unknown
 *  bare identifiers - which is the behaviour we want for a genuinely undefined parameter. */
function substituteParams(expr: string, scope: Map<string, number>): string {
  return expr.replace(/(?<![A-Za-z0-9_.])([A-Za-z_]\w*)/g, (whole, id: string, offset: number) => {
    if (/^\s*\(/.test(expr.slice(offset + id.length))) return whole;   // function call head
    const v = scope.get(id.toLowerCase());
    return v === undefined ? whole : `(${numLiteral(v)})`;
  });
}
/** Emit a literal bsource's tokenizer reads back exactly (no SI suffix ambiguity, no bare `-`
 *  gluing onto a preceding operator - the surrounding parens in substituteParams handle that). */
const numLiteral = (v: number) => (Number.isInteger(v) ? String(v) : v.toExponential(12));

/** Textually expand `.func` calls. Depth-capped; a recursive .func is reported, not hung on. */
function expandFuncs(expr: string, funcs: Map<string, { args: string[]; body: string }>, depth = 0): { text?: string; error?: string } {
  if (funcs.size === 0) return { text: expr };
  if (depth > 8) return { error: "`.func` expansion exceeded 8 levels — is the function defined in terms of itself?" };
  const re = /(?<![A-Za-z0-9_.])([A-Za-z_]\w*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr))) {
    const fn = funcs.get(m[1].toLowerCase());
    if (!fn) continue;
    // Find the matching ')' for the '(' at the end of the match.
    const open = m.index + m[0].length - 1;
    let d = 0, close = -1;
    for (let i = open; i < expr.length; i++) {
      if (expr[i] === "(") d++;
      else if (expr[i] === ")") { d--; if (d === 0) { close = i; break; } }
    }
    if (close < 0) return { error: `unbalanced parentheses in call to .func ${m[1]}` };
    const args = splitTopLevel(expr.slice(open + 1, close));
    if (args.length !== fn.args.length) {
      return { error: `.func ${m[1]} takes ${fn.args.length} argument(s), called with ${args.length}` };
    }
    let bodyText = fn.body;
    for (let a = 0; a < fn.args.length; a++) {
      const argRe = new RegExp(`(?<![A-Za-z0-9_.])${fn.args[a].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9_])`, "g");
      bodyText = bodyText.replace(argRe, `(${args[a]})`);
    }
    return expandFuncs(expr.slice(0, m.index) + `(${bodyText})` + expr.slice(close + 1), funcs, depth + 1);
  }
  return { text: expr };
}

/** Split "a, b, f(c,d)" on TOP-LEVEL commas only. */
function splitTopLevel(s: string): string[] {
  const out: string[] = []; let d = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") d++;
    else if (ch === ")") d--;
    if (ch === "," && d === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Evaluate a parameter/value expression to a number in `scope`. */
function evalParamExpr(raw: string, scope: Map<string, number>, funcs: Map<string, { args: string[]; body: string }>): { value?: number; error?: string } {
  const s = stripBraces(raw);
  if (!s) return { error: "empty expression" };
  const direct = parseValue(s);
  if (isFinite(direct)) return { value: direct };            // fast path: "4.7k", "1e-9", "22"
  const fx = expandFuncs(s, funcs);
  if (fx.error) return { error: fx.error };
  const sub = substituteParams(fx.text!, scope);
  const c = compileExpr(sub);
  if (c.error) return { error: `${c.error} (expression after parameter substitution: "${sub}")` };
  const comp = c.compiled!;
  if (comp.nodeRefs.length || comp.branchRefs.length || comp.hasTime) {
    return { error: `a parameter or component value may not depend on V(), I() or time — that needs a B source, not a parameter` };
  }
  const v = evalCompiled(comp, { nodeV: () => 0, branchI: () => 0, time: 0 });
  if (!isFinite(v)) return { error: `evaluates to ${v}` };
  return { value: v };
}

/** Resolve a raw name→text scope to numbers, allowing params to reference other params.
 *  Fixpoint with a pass cap; anything still unresolved after that is genuinely circular or
 *  undefined and is reported by name. */
function resolveScope(
  raw: Map<string, string>, funcs: Map<string, { args: string[]; body: string }>,
  errors: SimError[] | null, where: string,
): Map<string, number> {
  const scope = new Map<string, number>();
  const pending = new Map(raw);
  for (let pass = 0; pass <= raw.size + 1 && pending.size > 0; pass++) {
    let progressed = false;
    for (const [k, v] of [...pending]) {
      const r = evalParamExpr(v, scope, funcs);
      if (r.value !== undefined) { scope.set(k, r.value); pending.delete(k); progressed = true; }
    }
    if (!progressed) break;
  }
  if (pending.size && errors) {
    for (const [k, v] of pending) {
      const r = evalParamExpr(v, scope, funcs);
      errors.push({
        severity: "error",
        message: `${where}: parameter "${k}={${v}}" could not be resolved to a number — ${r.error ?? "circular reference"}. ` +
          `The elements that use it fall back to 0, so DO NOT trust any result from this subcircuit until it is fixed.`,
      });
    }
  }
  return scope;
}

// ─────────────────────────────────────────────────────────────────────────
// Expansion

/**
 * Does this subcircuit - or anything it instantiates, transitively - contain a behavioural
 * source? It matters because of an ugly but real constraint:
 *
 *   bsource.ts tokenises identifiers as [A-Za-z_][A-Za-z0-9_]*, so `V(X1.n9)` is a HARD
 *   tokeniser error. The default `.`-joined mangling would therefore make every B source
 *   inside every expanded subcircuit fail to compile — and a B that fails to compile stamps
 *   nothing, i.e. silently becomes an open circuit in the middle of a converging solve.
 *
 * So a subtree containing any B is mangled with `_` instead, which keeps every generated node
 * and element name inside the expression grammar. Subtrees with no B keep the `.` form (it reads
 * better, and every existing document/test depends on it).
 */
function subtreeHasBehavioural(registry: SubcktRegistry, name: string, seen = new Set<string>()): boolean {
  const key = name.toUpperCase();
  if (seen.has(key)) return false;
  seen.add(key);
  const def = registry.get(key);
  if (!def) return false;
  for (const be of def.body) {
    if (be.type === "B") return true;
    if (be.type === "X" && subtreeHasBehavioural(registry, be.subcktName, seen)) return true;
  }
  return false;
}

/** Rewrite the V(...) / I(...) references inside a behavioural expression to expanded names.
 *  Scanner-based (not regex) so nested parentheses in the surrounding expression are safe. */
function rewriteBRefs(expr: string, rewriteNode: (n: string) => string, rewriteSrc: (n: string) => string): string {
  let out = "", i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < expr.length && /[A-Za-z0-9_]/.test(expr[j])) j++;
      const id = expr.slice(i, j);
      let k = j;
      while (k < expr.length && /\s/.test(expr[k])) k++;
      const head = id.toUpperCase();
      if ((head === "V" || head === "I") && expr[k] === "(") {
        let d = 0, m = k;
        for (; m < expr.length; m++) { if (expr[m] === "(") d++; else if (expr[m] === ")") { d--; if (d === 0) break; } }
        if (m >= expr.length) { out += expr.slice(i); break; }   // unbalanced — compileExpr reports it
        const args = expr.slice(k + 1, m).split(",").map((a) => a.trim()).filter(Boolean);
        const mapped = args.map((a) => (head === "V" ? rewriteNode(a) : rewriteSrc(a)));
        out += `${id}(${mapped.join(",")})`;
        i = m + 1; continue;
      }
      out += id; i = j; continue;
    }
    out += c; i++;
  }
  return out;
}

/** Split an instance's subckt reference token, which may carry trailing parameter assignments.
 *  The schematic's subckt symbol exposes a single free-text "Subckt" attribute, so
 *  `TL072 gbw=4Meg` typed there is the only way a user can parameterise a top-level instance -
 *  supporting it here means no netlist.ts change is required. */
function splitInstanceRef(raw: string): { name: string; params: Map<string, string> } {
  const toks = String(raw ?? "").trim().split(/\s+/).filter(Boolean);
  const params = new Map<string, string>();
  const positional: string[] = [];
  const tail: string[] = [];
  let inParams = false;
  for (const t of toks) {
    if (/^params:?$/i.test(t)) { inParams = true; continue; }
    if (inParams || t.includes("=")) { tail.push(t); continue; }
    positional.push(t);
  }
  for (const [k, v] of splitAssignments(tail.join(" "))) params.set(k, v);
  return { name: positional[0] ?? "", params };
}

/**
 * Walk an element list and recursively replace every X element with its expanded body.
 * Pure: returns a NEW element list - the input is not mutated. Errors are appended to `errors`.
 *
 * Node-mangling rule (textbook SPICE expansion):
 *   • Every body element node ref that matches a pin name is replaced with the instance's
 *     connected node (from `x.nodes[]`).
 *   • Every other node ref (including "0" - see below) gets prefixed with `<instance>.`
 *     to keep it disjoint from the parent scope. (`_` instead of `.` for subtrees containing a
 *     behavioural source — see subtreeHasBehavioural.)
 *   • Ground "0" is the SAME ground everywhere: we do NOT mangle "0".
 *
 * `vsrc` references on F/H elements are also rewritten - to the mangled name of the V source
 * inside the same expansion (so a body F1 senses the body's own V1, not a parent's V1) - as are
 * the V()/I() references inside B-source expressions.
 */
export function expandSubckts(
  elements: NetlistElement[],
  registry: SubcktRegistry,
  errors: SimError[],
  outerModels?: ModelRegistry,
): NetlistElement[] {
  const out: NetlistElement[] = [];
  const MAX_DEPTH = 32;
  const globalModels = outerModels ?? new Map();
  /** Expand one X into primitive elements, prefixed with `prefix.` and stacked into `out`.
   *  `enclosingModels` is the model registry visible from outside this expansion - the inner
   *  subckt's `.model` lines shadow it via the `combinedModels` merge below. `parentScope` is
   *  the resolved parameter scope of the caller, which is what an instance-override expression
   *  (`X1 a b SUB rl={rbase*2}`) is evaluated in. */
  const expand = (
    xName: string, subcktName: string, connectNodes: string[], prefix: string, depth: number,
    stack: string[], enclosingModels: ModelRegistry, instParams: Map<string, string>,
    parentScope: Map<string, number>, sep: string,
  ) => {
    if (depth > MAX_DEPTH) {
      errors.push({ severity: "error", message: `Subcircuit expansion of "${xName}" exceeded depth ${MAX_DEPTH} - likely infinite recursion in .subckt definitions.` });
      return;
    }
    const subKey = subcktName.toUpperCase();
    if (stack.includes(subKey)) {
      errors.push({ severity: "error", message: `Subcircuit "${subcktName}" recursively contains itself (call chain: ${stack.concat(subcktName).join(" → ")}).` });
      return;
    }
    const def = registry.get(subKey);
    if (!def) {
      errors.push({ severity: "error", message: `Subcircuit "${subcktName}" (referenced by ${xName}) is not defined. Check the .subckt blocks loaded into the design.` });
      return;
    }
    // Merge model scope: this subckt's local models shadow the outer registry. We do this by
    // building a per-expansion combined registry; the inner subckt sees a registry that combines
    // its own .model lines with everything visible above. This mirrors SPICE scoping.
    const combinedModels: ModelRegistry = new Map();
    for (const [k, v] of enclosingModels) combinedModels.set(k, v);
    for (const [k, v] of def.models) combinedModels.set(k, v);     // inner wins
    if (def.pins.length !== connectNodes.length) {
      errors.push({ severity: "error", message: `${xName} connects ${connectNodes.length} node(s) but .subckt ${subcktName} has ${def.pins.length} pin(s) (${def.pins.join(", ")}).` });
      return;
    }
    const where = `${xName} (.subckt ${def.name})`;
    // ---- parameter scope for THIS instance ----
    // 1. file `.param`s + the subckt's own defaults, resolved silently to give instance-override
    //    expressions something to reference; 2. overrides evaluated in the caller's scope;
    // 3. the whole thing re-resolved with the overrides pinned as literals, so a default that is
    //    DERIVED from an overridden parameter (`c1={gm/(2*pi*gbw)}`) picks up the new value.
    const rawBase = new Map<string, string>([...def.scope.params, ...def.defaults]);
    const baseScope = resolveScope(rawBase, def.scope.funcs, null, where);
    const overrideCtx = parentScope.size ? parentScope : baseScope;
    const raw = new Map(rawBase);
    for (const [k, vexpr] of instParams) {
      const r = evalParamExpr(vexpr, overrideCtx, def.scope.funcs);
      if (r.value === undefined) {
        errors.push({ severity: "error", message: `${where}: instance parameter "${k}=${vexpr}" could not be evaluated — ${r.error}.` });
        continue;
      }
      if (!def.defaults.has(k) && !def.scope.params.has(k)) {
        errors.push({ severity: "warning", message: `${where}: parameter "${k}" is not declared on ".subckt ${def.name} … params:" — it is applied anyway, but check the spelling; an unread parameter means the model is running with its DEFAULT value.` });
      }
      raw.set(k, numLiteral(r.value));
    }
    const scope = resolveScope(raw, def.scope.funcs, errors, where);

    // pin name → connected node lookup
    const pinMap: Record<string, string> = {};
    for (let k = 0; k < def.pins.length; k++) pinMap[def.pins[k]] = connectNodes[k];
    // rewrite a body node reference: pin → connected node; "0" stays "0"; else "<prefix><sep><node>"
    const rewriteNode = (n: string): string => {
      if (n === "0") return "0";
      if (pinMap[n] !== undefined) return pinMap[n];
      return `${prefix}${sep}${n}`;
    };
    // mangled element name: every body element gets `<prefix><sep><bodyName>`
    const rewriteName = (n: string): string => `${prefix}${sep}${n}`;
    /** Element value → number. A literal is already a number; an expression is evaluated in this
     *  instance's scope. A failure is an ERROR (not a warning) and falls back to 0 - loudly. */
    const val = (v: ValueSpec | undefined, fallback: number, what: string): number => {
      if (v === undefined) return fallback;
      if (typeof v === "number") return v;
      const r = evalParamExpr(v, scope, def.scope.funcs);
      if (r.value === undefined) {
        errors.push({ severity: "error", message: `${where}: cannot evaluate "${v}" for ${what} — ${r.error}. Using 0; the result of this simulation is not meaningful until this is fixed.` });
        return 0;
      }
      return r.value;
    };

    const newStack = stack.concat(subKey);
    for (const be of def.body) {
      if (be.type === "X") {
        // recurse with deeper prefix; child sees the combined model scope (its own + ours)
        const childPrefix = rewriteName(be.name);
        const childNodes = be.nodes.map(rewriteNode);
        expand(rewriteName(be.name), be.subcktName, childNodes, childPrefix, depth + 1, newStack, combinedModels, be.params, scope, sep);
        continue;
      }
      const nm = rewriteName(be.name);
      switch (be.type) {
        case "R": out.push({ type: "R", name: nm, n1: rewriteNode(be.n1), n2: rewriteNode(be.n2), value: val(be.value, 0, `${be.name} resistance`) }); break;
        case "C": out.push({ type: "C", name: nm, n1: rewriteNode(be.n1), n2: rewriteNode(be.n2), value: val(be.value, 0, `${be.name} capacitance`), ic: be.ic }); break;
        case "L": out.push({ type: "L", name: nm, n1: rewriteNode(be.n1), n2: rewriteNode(be.n2), value: val(be.value, 0, `${be.name} inductance`), ic: be.ic }); break;
        case "V": out.push({ type: "V", name: nm, n1: rewriteNode(be.n1), n2: rewriteNode(be.n2), dc: val(be.dc, 0, `${be.name} DC value`) }); break;
        case "I": out.push({ type: "I", name: nm, n1: rewriteNode(be.n1), n2: rewriteNode(be.n2), dc: val(be.dc, 0, `${be.name} DC value`) }); break;
        case "D": {
          const model = resolveDiode(combinedModels, be.modelName, errors, `${nm} in ${where}`);
          out.push({ type: "D", name: nm, nA: rewriteNode(be.nA), nK: rewriteNode(be.nK), model, area: be.area !== undefined ? val(be.area, 1, `${be.name} area`) : undefined });
          break;
        }
        case "M": {
          // Guess PMOS-vs-NMOS from the resolved-model kind. If resolution falls all the way through,
          // assume NMOS - the user can override the name to PMOS.
          const isP = be.modelName.toUpperCase().includes("PMOS");
          const base = resolveMos(combinedModels, be.modelName, isP, errors, `${nm} in ${where}`);
          const model = { ...base, W: be.W !== undefined ? val(be.W, base.W, `${be.name} W`) : base.W, L: be.L !== undefined ? val(be.L, base.L, `${be.name} L`) : base.L };
          out.push({ type: "M", name: nm, nD: rewriteNode(be.nD), nG: rewriteNode(be.nG), nS: rewriteNode(be.nS), nB: rewriteNode(be.nB), model });
          break;
        }
        case "Q": {
          const isP = be.modelName.toUpperCase().includes("PNP");
          const model = resolveBjt(combinedModels, be.modelName, isP, errors, `${nm} in ${where}`);
          out.push({ type: "Q", name: nm, nC: rewriteNode(be.nC), nB: rewriteNode(be.nB), nE: rewriteNode(be.nE), model, area: be.area !== undefined ? val(be.area, 1, `${be.name} area`) : undefined });
          break;
        }
        case "E": out.push({ type: "E", name: nm, n1: rewriteNode(be.n1), n2: rewriteNode(be.n2), nc1: rewriteNode(be.nc1), nc2: rewriteNode(be.nc2), gain: val(be.gain, 0, `${be.name} gain`) }); break;
        case "G": out.push({ type: "G", name: nm, n1: rewriteNode(be.n1), n2: rewriteNode(be.n2), nc1: rewriteNode(be.nc1), nc2: rewriteNode(be.nc2), gain: val(be.gain, 0, `${be.name} gm`) }); break;
        case "F": out.push({ type: "F", name: nm, n1: rewriteNode(be.n1), n2: rewriteNode(be.n2), vsrc: rewriteName(be.vsrc), gain: val(be.gain, 0, `${be.name} gain`) }); break;
        case "H": out.push({ type: "H", name: nm, n1: rewriteNode(be.n1), n2: rewriteNode(be.n2), vsrc: rewriteName(be.vsrc), gain: val(be.gain, 0, `${be.name} transresistance`) }); break;
        case "B": {
          // Order matters: rewrite V()/I() FIRST (the raw text still holds body-local names, and
          // a parameter could legitimately share a name with a local net), then substitute
          // parameters, then COMPILE-CHECK. If it doesn't compile we emit an error and no
          // element - an un-stamped B is an open circuit, and shipping one quietly is exactly
          // the failure mode this whole module exists to prevent.
          const rewritten = rewriteBRefs(be.expr, rewriteNode, rewriteName);
          const fx = expandFuncs(rewritten, def.scope.funcs);
          if (fx.error) {
            errors.push({ severity: "error", message: `${where}: behavioural source ${be.name} — ${fx.error}. The element was NOT stamped; treat every number from this circuit as invalid.` });
            break;
          }
          const finalExpr = substituteParams(fx.text!, scope);
          const chk = compileExpr(finalExpr);
          if (chk.error) {
            errors.push({
              severity: "error",
              message: `${where}: behavioural source ${be.name} ${be.ctrl}={${be.expr}} does not compile — ${chk.error}. ` +
                `The element was NOT stamped (that would leave a silent open circuit), so this simulation has no valid result. ` +
                `Supported inside an expression: V(node), V(a,b), I(vsource), time, and exp/log/sqrt/abs/sgn/sin/cos/tan/tanh/min/max/pow/if/smooth_if/limit/pwl.`,
            });
            break;
          }
          out.push({ type: "B", name: nm, n1: rewriteNode(be.n1), n2: rewriteNode(be.n2), ctrl: be.ctrl, expr: finalExpr });
          break;
        }
      }
    }
  };

  for (const el of elements) {
    if (el.type !== "X") { out.push(el); continue; }
    const { name, params } = splitInstanceRef(el.subcktName);
    // `_` mangling for any subtree containing a behavioural source (see subtreeHasBehavioural).
    const sep = subtreeHasBehavioural(registry, name) ? "_" : ".";
    expand(el.name, name, el.nodes, el.name, 0, [], globalModels, params, new Map(), sep);
  }
  return out;
}
