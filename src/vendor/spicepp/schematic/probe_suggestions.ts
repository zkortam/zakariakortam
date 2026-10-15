/**
 * Topology-aware probe suggestions.
 *
 * Given a schematic, return a ranked list of "obvious" things a user would plot - so the
 * WaveformDock can offer one-click chips instead of forcing the user to probe every time, and
 * the AI can auto-place probes after running a simulation.
 *
 * The algorithm walks the netlist (so it sees nodes by their resolved names - user labels first,
 * then N001/N002 auto-names) and uses textbook heuristics:
 *
 *   • OUTPUTS (high priority):
 *       - Op-amp output pins                                              → "Op-amp output"
 *       - BJT collector, MOSFET drain (= the gain-stage output)           → "Q1 collector" / "M1 drain"
 *       - Diode cathode / anode (the rectified node)                      → "D1 cathode"
 *       - User-labeled nodes matching /^(out|vout|y|vo|drain|coll|q)/i    → "Labeled output"
 *
 *   • INPUTS (medium priority):
 *       - The "+" terminal of every V source / I source                   → "V1 input"
 *       - User-labeled nodes matching /^(in|vin|x|src|sig)/i              → "Labeled input"
 *
 *   • BRANCH CURRENTS (medium priority):
 *       - Each independent V source's current I(Vname) - universal sense  → "V1 current"
 *
 *   • OTHER named (non-N00x) nodes get a small bonus - the user named them, they probably matter.
 *
 * Suggestions are deduped (same expr never appears twice), capped at 6, and returned in
 * descending priority. If the schematic has nothing simulatable yet, the list is empty -
 * callers should fall back to the existing "click a wire" hint.
 *
 * Used by:
 *   - src/components/Waveforms/WaveformDock.tsx (one-click chips when no probes set)
 *   - src/lib/ai/tools.ts ("suggest_probes" tool - AI auto-probes after run)
 */
import type { SchematicDoc } from "./types";
import { buildNetlist } from "./netlist";
import type { Complex, NetlistElement, SimResult } from "../sim/types";

export interface ProbeSuggestion {
  /** SPICE-style probe expression: "V(node)", "V(a,b)", or "I(refdes)". */
  expr: string;
  /** Short human label for the chip. */
  label: string;
  /** Tooltip / "why this matters" - one sentence, plain English. */
  why: string;
  /** Sort key, higher = more obvious. Used for ranking only - never shown. */
  priority: number;
  /** What kind of probe this is - UI may use to color the chip differently. */
  kind: "output" | "input" | "current" | "other";
}

const AUTO_NODE_RE = /^N\d+$/i;
/**
 * Recognize "output-looking" node labels.
 *
 * The trick is to treat `_`, `-`, and digits as ENDS-of-word - JS's `\b` doesn't (it treats `_`
 * as a word character), so we use an explicit lookahead `(?=$|[^a-zA-Z])` that lets the keyword
 * be followed by anything that ISN'T a letter (or by end-of-string). This way:
 *
 *   OUT, OUT2, OUT_A, OUT-X        → match (delimiter or end after keyword)
 *   OUTSIDE, OUTGOING              → no match (more letters → not a delimited keyword)
 *   VOUT, V_OUT, V-OUT, VOUTPUT    → match via `v[_-]?(out|output)`
 *   Y, Y_BUS, Y2, DRAIN, COLL      → match
 *   YIELD, DRAINING                → no match
 *   SIG_OUT, SIG.OUT, SIGOUT       → match via the anywhere-in-string `sig[._-]?out` clause
 *   bare Q (FF output convention)  → match via `q(?=$|[^a-zA-Z])`
 */
const OUTPUT_NAME_RE = /^(?:v[_-]?(?:out|output)|out|output|y|vo|drain|coll|load|q)(?=$|[^a-zA-Z])|sig[._-]?out/i;
/**
 * Mirror for inputs. Common conventions: VIN, V_IN, V-IN, IN, IN_X, SIG_IN, X, SRC, STIM.
 * Same delimiter-aware lookahead - IN matches, INSIDE doesn't.
 */
const INPUT_NAME_RE = /^(?:v[_-]?in|in|x|src|stim)(?=$|[^a-zA-Z])|sig[._-]?in/i;

// ── Which node is the amplifier's OUTPUT? ───────────────────────────────────────────────────
//
// THE FAILURE THIS CLOSES, from a real session. On a two-stage Miller CMOS op-amp the auto-probe
// plotted V(N005) (dead flat) and V(N006) (−150 dB and rising). Neither is the output. Every
// MOSFET drain scores the same 75 here — mirror nodes, the tail node, the diode-connected node —
// so the "output" came down to which drain the netlister happened to emit first, i.e. to where
// the parts sat on the canvas.
//
// For a transistor amplifier the output is the node with the most SMALL-SIGNAL GAIN FROM THE
// INPUT. That is not a topological guess when an .ac result exists: it is measured. So whenever
// the caller hands us a complex result we rank the candidates by |V(node)/V(in)| and let the
// measurement outrank the structural heuristics.

/** The node an AC-tagged source drives, and the drive magnitude. Null when nothing carries AC. */
function acDriveNode(elements: NetlistElement[]): { node: string; mag: number } | null {
  let best: { node: string; mag: number } | null = null;
  for (const el of elements) {
    if (el.type !== "V" && el.type !== "I") continue;
    const m = el.ac?.mag ?? 0;
    if (!(m > 0)) continue;
    const node = el.n1 !== "0" ? el.n1 : el.n2;
    if (!node || node === "0") continue;
    if (!best || m > best.mag) best = { node, mag: m };
  }
  return best;
}

export interface ACOutputPick {
  /** Signal key as it appears in csignals, e.g. "V(N003)". */
  key: string;
  /** Bare net name. */
  net: string;
  /** Largest |V(node)/V(in)| across the sweep, in dB. */
  gain_db: number;
  /** The input the gain is referred to ("V(N001)"), or null when no AC source was found. */
  ref: string | null;
}

/**
 * The node with the most small-signal gain from the input, measured off an .ac result.
 *
 * Only V(node) traces are considered: the branch currents the engine also puts in `csignals`
 * are not candidate outputs, and sorting them together with voltages by raw magnitude is how a
 * current trace can win an "output" contest. Returns null when nothing amplifies (max gain ≤ 1),
 * because a circuit whose every node attenuates has no measured output to point at and a
 * confidently-picked wrong one is worse than falling back to topology.
 */
export function pickACOutput(
  csignals: Record<string, Complex[]>,
  elements?: NetlistElement[],
  opts?: { minGain?: number },
): ACOutputPick | null {
  const drive = elements ? acDriveNode(elements) : null;
  const refKey = drive ? Object.keys(csignals).find((k) => k.toLowerCase() === `v(${drive.node})`.toLowerCase()) ?? null : null;
  const ref = refKey ? csignals[refKey] : null;
  const minGain = opts?.minGain ?? 1;
  let best: ACOutputPick | null = null;
  let bestGain = 0;
  for (const k of Object.keys(csignals)) {
    const m = k.match(/^V\(\s*([^,)]+)\s*\)$/i);
    if (!m) continue;                              // I(...) / V(a,b) are not output candidates
    const net = m[1].trim();
    if (net === "0" || (refKey && k === refKey)) continue;
    const arr = csignals[k];
    if (!arr?.length) continue;
    let g = 0;
    for (let i = 0; i < arr.length; i++) {
      const c = arr[i]; if (!c || !Number.isFinite(c.re) || !Number.isFinite(c.im)) continue;
      const num = Math.hypot(c.re, c.im);
      // Refer every sample to the drive AT THAT FREQUENCY: an AC source is flat, but referring
      // sample-by-sample also keeps the ratio honest if the drive is shaped.
      let den = 1;
      if (ref?.[i]) { const d = Math.hypot(ref[i].re, ref[i].im); if (d > 0) den = d; else continue; }
      else if (drive) den = drive.mag;
      const r = num / den;
      if (Number.isFinite(r) && r > g) g = r;
    }
    if (g > bestGain) {
      bestGain = g;
      best = { key: k, net, gain_db: 20 * Math.log10(Math.max(g, 1e-300)), ref: refKey };
    }
  }
  return best && bestGain > minGain ? best : null;
}

/** Nets that cannot be the amplifier's output because another device is USING them:
 *   • a gate/base — the drain feeding it is an interstage node (a Miller op-amp's first-stage
 *     drain is the classic case);
 *   • a source/emitter — that is a tail/degeneration node, held low-impedance by the device
 *     sitting on it (a diff pair's tail is a drain, and it is not an output).
 *  Both used to rank 75, identical to the real output, so which one won came down to netlist
 *  emission order — i.e. to where the parts happened to sit on the canvas. */
function nonOutputNets(elements: NetlistElement[]): Set<string> {
  const s = new Set<string>();
  const put = (n: string | undefined) => { if (n && n !== "0") s.add(n); };
  for (const el of elements) {
    if (el.type === "M" || el.type === "VDMOS") { put(el.nG); put(el.nS); }
    else if (el.type === "Q") { put(el.nB); put(el.nE); }
  }
  return s;
}

/**
 * Return up to `max` probe suggestions for this circuit, ranked by how "obvious" the choice is.
 *
 * The optional `lastResult` lets us drop suggestions for signals that wouldn't actually appear
 * in the result (e.g. asking for V(out) on a brand-new circuit before any sim runs). For now we
 * use it only to filter - the ranking is purely topological.
 */
export function suggestProbes(doc: SchematicDoc, lastResult?: SimResult, max = 6): ProbeSuggestion[] {
  // Run the netlister with the user's directives in place - this is the SAME node-naming the
  // engine and the existing probe chips use, so suggestions are clickable.
  let elements: NetlistElement[];
  let nodes: string[];
  try {
    const nl = buildNetlist(doc);
    elements = nl.elements;
    nodes = nl.nodes;
  } catch {
    return [];   // malformed schematic - better to show nothing than crash
  }
  if (elements.length === 0) return [];

  // Per-node "touched by" tally - used to spot midpoints and dead-end "leaves".
  const touches: Record<string, { count: number; passiveOnly: boolean }> = {};
  const bump = (n: string, passive: boolean) => {
    if (n === "0") return;
    const t = touches[n] ?? (touches[n] = { count: 0, passiveOnly: true });
    t.count += 1;
    if (!passive) t.passiveOnly = false;
  };

  const suggestions: ProbeSuggestion[] = [];
  /** Push a candidate; the caller's responsible for dedupe (handled at the end). */
  const push = (s: ProbeSuggestion) => suggestions.push(s);

  // A drain/collector that feeds the NEXT stage's gate/base is an interstage node, not the
  // amplifier's output. Ranking every drain at 75 is what made a Miller op-amp's auto-probe pick
  // its own mirror node; the last stage's drain — the one that drives nothing's control input —
  // is the output.
  const usedNets = nonOutputNets(elements);
  const stageOutPriority = (net: string) => (usedNets.has(net) ? 62 : 75);

  // Pass 1 - primary roles per element type. We push candidates eagerly; later we dedupe by expr.
  for (const el of elements) {
    switch (el.type) {
      case "R": case "C": case "L":
        bump(el.n1, true); bump(el.n2, true); break;
      case "D":
        bump(el.nA, false); bump(el.nK, false);
        if (el.nK !== "0") {
          push({ expr: `V(${el.nK})`, label: `V(${el.nK})`, why: `${el.name} cathode (rectified node)`, priority: 55, kind: "output" });
        }
        // Diode current - useful for rectifier circuits (peak / RMS current through the diode).
        push({ expr: `I(${el.name})`, label: `I(${el.name})`, why: `${el.name} current`, priority: 35, kind: "current" });
        break;
      case "V":
        bump(el.n1, false); bump(el.n2, false);
        if (el.n1 !== "0") {
          push({ expr: `V(${el.n1})`, label: `V(${el.n1})`, why: `${el.name} drive node (input)`, priority: 35, kind: "input" });
        }
        push({ expr: `I(${el.name})`, label: `I(${el.name})`, why: `Current through ${el.name}`, priority: 30, kind: "current" });
        break;
      case "I":
        bump(el.n1, false); bump(el.n2, false);
        break;
      case "OPAMP":
        bump(el.nOut, false); bump(el.nInP, false); bump(el.nInN, false);
        if (el.nOut !== "0") {
          push({ expr: `V(${el.nOut})`, label: `V(${el.nOut})`, why: `${el.name} output`, priority: 90, kind: "output" });
        }
        break;
      case "Q":
        bump(el.nC, false); bump(el.nB, false); bump(el.nE, false);
        if (el.nC !== "0") {
          push({ expr: `V(${el.nC})`, label: `V(${el.nC})`, why: usedNets.has(el.nC) ? `${el.name} collector (feeds another device's base/emitter — an interstage or tail node, not the output)` : `${el.name} collector (gain-stage output)`, priority: stageOutPriority(el.nC), kind: "output" });
        }
        // IMPORTANT: emit I(Qn) form, not Ic(Qn) - the engine emits BOTH names but the
        // WaveformDock's parseProbe regex only matches `^I\(`. A chip labeled Ic(Q1) would
        // be unclickable in practice. The engine aliases I(Q1) := Ic(Q1) at engine.ts
        // readSignals, so this is the BJT collector current either way.
        push({ expr: `I(${el.name})`, label: `I(${el.name})`, why: `${el.name} collector current`, priority: 45, kind: "current" });
        break;
      case "M":
        bump(el.nD, false); bump(el.nG, false); bump(el.nS, false); bump(el.nB, false);
        if (el.nD !== "0") {
          push({ expr: `V(${el.nD})`, label: `V(${el.nD})`, why: usedNets.has(el.nD) ? `${el.name} drain (feeds another device's gate/source — an interstage or tail node, not the output)` : `${el.name} drain (gain-stage output)`, priority: stageOutPriority(el.nD), kind: "output" });
        }
        push({ expr: `I(${el.name})`, label: `I(${el.name})`, why: `${el.name} drain current`, priority: 45, kind: "current" });
        break;
      case "E": case "G": case "F": case "H":
        bump(el.n1, false); bump(el.n2, false);
        // Controlled-source outputs are often what the user wants to see - but lower priority
        // than real-device outputs since they're typically used as building blocks.
        if (el.n1 !== "0") {
          push({ expr: `V(${el.n1})`, label: `V(${el.n1})`, why: `${el.name} (controlled source) output`, priority: 40, kind: "output" });
        }
        break;
    }
  }

  // Pass 2 - name-based bonuses for nodes that look like inputs/outputs by their label.
  for (const n of nodes) {
    if (AUTO_NODE_RE.test(n)) continue;   // skip auto-names
    if (OUTPUT_NAME_RE.test(n)) {
      push({ expr: `V(${n})`, label: `V(${n})`, why: `Labeled "${n}" - looks like an output node`, priority: 100, kind: "output" });
    } else if (INPUT_NAME_RE.test(n)) {
      push({ expr: `V(${n})`, label: `V(${n})`, why: `Labeled "${n}" - looks like an input node`, priority: 60, kind: "input" });
    } else {
      // any user-labeled node - bonus over auto-named
      push({ expr: `V(${n})`, label: `V(${n})`, why: `Labeled node "${n}"`, priority: 25, kind: "other" });
    }
  }

  // Pass 3 - passive-chain midpoints. For an RC LPF, the cap-side node is touched only by R and
  // C, no source, no ground. It's the textbook "output" of a 2-stage divider/filter. If we
  // haven't already proposed it as a labeled output, propose it here.
  for (const [node, t] of Object.entries(touches)) {
    if (!t.passiveOnly) continue;
    if (t.count >= 2) {
      // candidate output of a passive ladder
      push({ expr: `V(${node})`, label: `V(${node})`, why: `Internal node between passive components (likely the filter output)`, priority: 50, kind: "output" });
    }
  }

  // Pass 4 - TRANSFER-FUNCTION pair for AC analyses. When the user runs a Bode plot, the
  // canonical "what you want to see" is V(out) - V(in), the gain. We propose this ONLY when the
  // current result is AC (so we don't clutter time-domain suggestions with a difference probe
  // that's usually just noise around the input swing) AND we have both an output candidate and
  // an input candidate identified.
  if (lastResult?.complex && lastResult.csignals) {
    // MEASURED beats GUESSED. The node with the most gain from the input IS the output; the
    // structural heuristics above are only a stand-in for this measurement. 98 keeps it above
    // every topological rank (drain/collector 75, passive midpoint 50) while still leaving a
    // node the USER explicitly labelled "out" (100) on top — their intent outranks our physics
    // when the two disagree, and they almost never do.
    const acPick = pickACOutput(lastResult.csignals, elements);
    if (acPick) {
      push({
        expr: `V(${acPick.net})`, label: `V(${acPick.net})`,
        why: `the node with the most small-signal gain from the input (${acPick.gain_db.toFixed(1)} dB${acPick.ref ? ` vs ${acPick.ref}` : ""}) — measured on the .ac result, so this is the amplifier's output`,
        priority: 98, kind: "output",
      });
    }
    const topOut = suggestions
      .filter((s) => s.kind === "output")
      .sort((a, b) => b.priority - a.priority)[0];
    const topIn = suggestions
      .filter((s) => s.kind === "input")
      .sort((a, b) => b.priority - a.priority)[0];
    if (topOut && topIn) {
      // Extract the bare node names from the V(...) wrappers.
      const outName = topOut.expr.match(/^V\(([^,)]+)\)$/i)?.[1];
      const inName = topIn.expr.match(/^V\(([^,)]+)\)$/i)?.[1];
      if (outName && inName && outName !== inName) {
        push({
          expr: `V(${outName},${inName})`,
          label: `V(${outName},${inName})`,
          why: `Transfer function - output relative to input (classic Bode probe)`,
          priority: 95,
          kind: "output",
        });
      }
    }
  }

  // Dedup by expr - keep the HIGHEST priority instance and concatenate "why"s briefly.
  const byExpr = new Map<string, ProbeSuggestion>();
  for (const s of suggestions) {
    const cur = byExpr.get(s.expr);
    if (!cur || s.priority > cur.priority) byExpr.set(s.expr, s);
  }
  let out = [...byExpr.values()];

  // If we have a result, drop suggestions whose underlying signal isn't actually present -
  // engine.ts only emits Ic/Ib/Ie for BJTs in transient/op, and `I(R1)` is derived from a
  // resistor current that may not be in csignals for AC. A missing signal would render an empty
  // probe, which is confusing.
  if (lastResult) {
    const has = (e: string): boolean => {
      // accept either real or complex signal map
      if (lastResult.complex && lastResult.csignals) return !!lastResult.csignals[e];
      return !!lastResult.signals[e];
    };
    out = out.filter((s) => {
      // expand V(a,b) into both halves; both must be present
      const md = s.expr.match(/^V\(([^,)]+),([^)]+)\)$/i);
      if (md) return has(`V(${md[1].trim()})`) && has(`V(${md[2].trim()})`);
      return has(s.expr);
    });
  }

  // Nodes inside a part's model (OPout:U1) aren't on the user's schematic: never offer them.
  out = out.filter((s) => !s.expr.includes(":"));
  out.sort((a, b) => b.priority - a.priority);
  return out.slice(0, max);
}
