/**
 * SPICE .model directive parser.
 *
 * Accepted syntax (case-insensitive, whitespace-flexible):
 *
 *   .model NAME TYPE(P1=V1 P2=V2 …)
 *   .model NAME TYPE (P1=V1 P2=V2 …)        ← space before "(" is fine
 *   .model NAME TYPE P1=V1 P2=V2 …          ← parens optional (Berkeley SPICE3 leniency)
 *   .MODEL NAME TYPE(IS=1n N=1.05 RS=0.1 +
 *                   CJO=2p VJ=0.7 M=0.5)    ← + continuation lines are pre-joined by the caller
 *
 * Supported TYPE strings (case-insensitive):
 *   D, ZENER, SCHOTTKY      → DiodeModel       (built on DEFAULT_MODELS.D as the base)
 *   NMOS, PMOS              → MosModel         (LEVEL=1 only; any other LEVEL is REJECTED with
 *                                              an error - see the note at the LEVEL check below)
 *   NPN, PNP                → BjtModel
 *
 * Anything else is reported as a warning and skipped - but the registry still records the bare
 * name so a body element referencing it doesn't trigger a follow-up "model not found" error.
 *
 * Returns a Map keyed by NAME.toUpperCase() so look-ups are case-insensitive (matches LTspice).
 */
import { DEFAULT_MODELS } from "../schematic/components";
import { parseValue } from "../units";
import type { DiodeModel, MosModel, BjtModel, SwitchModel, VdmosModel, JfetModel, SimError } from "./types";

export type AnyModel =
  | { kind: "D"; model: DiodeModel; name: string }
  | { kind: "M"; model: MosModel; name: string }
  | { kind: "Q"; model: BjtModel; name: string }
  | { kind: "SW"; model: SwitchModel; name: string }
  | { kind: "VDMOS"; model: VdmosModel; name: string }
  | { kind: "J"; model: JfetModel; name: string };

export type ModelRegistry = Map<string, AnyModel>;

/**
 * Parse zero-or-more .model directives from a text blob. Lines that don't start with .model are
 * ignored. Continuation lines (`+ …`) MUST already be joined onto the preceding logical line by
 * the caller - parseSubckts and netlist already do this; the standalone parseModels(text) helper
 * does the join itself.
 */
export function parseModels(text: string, errors: SimError[]): ModelRegistry {
  // Encrypted paste check runs FIRST: an encrypted blob contains no parsable .model lines, so
  // without this the user gets an empty registry and a silent fall-through to generic defaults.
  const enc = detectEncryptedModel(text, "The model text in this document");
  if (enc) errors.push(enc);
  return parseModelsFromJoinedLines(joinContinuations(text), errors);
}

/** Same as parseModels but expects pre-joined logical lines (one logical line per array entry). */
export function parseModelsFromJoinedLines(lines: string[], errors: SimError[]): ModelRegistry {
  const reg: ModelRegistry = new Map();
  for (const raw of lines) {
    const line = raw.trim();
    if (!/^\.model\b/i.test(line)) continue;
    const parsed = parseOneModel(line, errors);
    if (parsed) reg.set(parsed.name.toUpperCase(), parsed);
  }
  return reg;
}

/** Look up by name, case-insensitively. Returns undefined if absent. */
export function lookupModel(reg: ModelRegistry, name: string): AnyModel | undefined {
  return reg.get(name.toUpperCase());
}

// ─────────────────────────────────────────────────────────────────────────
// Encrypted / obfuscated vendor model detection
//
// WHY THIS EXISTS. A professional's first act in a new simulator is pasting the part they are
// actually using, and a large share of TI / ADI / Infineon `.lib` files are LTspice- or
// HSPICE-encrypted. Feeding one of those to the parsers below produces a registry of garbage
// names, zero recognised elements, and - critically - a `.subckt` whose body is empty, which
// then expands to an OPEN CIRCUIT. The simulation converges, the numbers look plausible, and
// they are completely wrong. That is the single worst outcome this codebase can produce.
//
// We deliberately DO NOT attempt decryption (see YC_BUILD_PLAN §5: legal/reputational hazard
// for single-digit coverage). We detect, name the part, and say what to do instead.

/** Printable-ASCII test used by the binary-payload heuristic (tab/newline count as printable). */
const isPrintable = (code: number) => code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126);

/**
 * Look for the signatures of an encrypted / binary model file. Returns null when the text looks
 * like ordinary SPICE. `label` is used in the message so the user is told WHICH paste failed.
 *
 * Three independent signals, in decreasing order of certainty:
 *   1. `.PROTECT` … `.UNPROTECT` — HSPICE's explicit "hide this section" directive pair.
 *   2. A vendor banner comment that says so in words ("encrypted", "encoded model", …).
 *   3. A binary payload — non-printable bytes, or long lines of dense high-entropy noise.
 *      This is the vendor-agnostic one: it catches LTspice `.enc` blobs and any future format
 *      without our having to guess magic strings.
 */
export function detectEncryptedModel(text: string, label = "the pasted model"): SimError | null {
  if (!text || text.length < 16) return null;
  const head = text.slice(0, 4000);

  // (1) HSPICE .PROTECT region. Unambiguous - the directive exists only to hide netlist text.
  if (/^\s*\.prot(ect)?\b/im.test(head)) {
    return encErr(label, "an HSPICE `.PROTECT` block (the encrypted-section directive)");
  }
  // (2) An explicit banner. Vendors say it in the header comment; require the word in a comment
  //     line so a `.subckt ENCRYPTED_TEST` in someone's own netlist can't trip it.
  const banner = head.split(/\r?\n/).slice(0, 40).find(
    (ln) => /^\s*[*;]/.test(ln) && /\b(encrypt(ed|ion)?|encoded\s+model|proprietary\s+model|do\s+not\s+distribute\s+decrypt)\b/i.test(ln),
  );
  if (banner) return encErr(label, `a vendor banner that declares the model encrypted (${banner.trim().slice(0, 80)})`);

  // (3) Binary payload. Two sub-tests, because encryptors differ: raw bytes vs base64-ish text.
  let nonPrintable = 0;
  for (let i = 0; i < head.length; i++) if (!isPrintable(head.charCodeAt(i))) nonPrintable++;
  if (nonPrintable / head.length > 0.02) {
    return encErr(label, `binary (non-text) content — ${(100 * nonPrintable / head.length).toFixed(1)}% of the first 4 kB is not printable ASCII`);
  }
  // Base64/ASCII-armoured payloads stay printable, so look for the shape instead: many long
  // lines with no whitespace and no SPICE punctuation. A real netlist line has spaces in it.
  const lines = head.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const armoured = lines.filter((l) => l.length >= 48 && !/\s/.test(l.trim()) && /^[A-Za-z0-9+/=_-]+$/.test(l.trim()));
  if (lines.length >= 4 && armoured.length / lines.length > 0.5) {
    return encErr(label, `ASCII-armoured (base64-like) content — ${armoured.length} of ${lines.length} lines are long unbroken character runs with no SPICE syntax`);
  }
  return null;
}

function encErr(label: string, why: string): SimError {
  return {
    severity: "error",
    message:
      `${label} is an ENCRYPTED vendor model (${why}). Spice++ does not decrypt vendor models, ` +
      `and it will not substitute a guessed stand-in for one — a plausible wrong model is worse than no model. ` +
      `Three ways forward: (1) ask the vendor for the unencrypted/“generic” version of the model — most publish both; ` +
      `(2) pick an equivalent part from the built-in Spice++ library (call find_part with the part's function, ` +
      `e.g. "JFET-input dual op-amp" or "5 V regulator") — those models are embedded in your document and always open; ` +
      `(3) build a datasheet-fitted macromodel from the numbers you DO have (GBW, slew rate, Vos, Iq, rails).`,
  };
}

/**
 * Resolve a diode by model name. Order of precedence:
 *   1. The runtime registry (top-level .model directives or .subckt-internal .model lines).
 *   2. DEFAULT_MODELS (hardcoded D / ZENER / SCHOTTKY).
 *   3. Fallback DEFAULT_MODELS.D - never throws.
 *
 * Per-instance attribute overrides (Is=, N=, …) layer on top of this - they're applied in
 * netlist.ts after this function returns.
 */
export function resolveDiode(reg: ModelRegistry, name: string, errors?: SimError[], where?: string): DiodeModel {
  const m = lookupModel(reg, name);
  if (m && m.kind === "D") return m.model;
  const builtin = (DEFAULT_MODELS as Record<string, unknown>)[name.toUpperCase()] as DiodeModel | undefined;
  if (builtin && (builtin as { Is?: number }).Is !== undefined) return builtin;
  missing(errors, name, where, "diode", "1N4148-class small-signal silicon");
  return DEFAULT_MODELS.D;
}

/** Resolve a MOSFET model. `isP=true` selects the PMOS default if the name isn't found. */
export function resolveMos(reg: ModelRegistry, name: string, isP: boolean, errors?: SimError[], where?: string): MosModel {
  const m = lookupModel(reg, name);
  if (m && m.kind === "M") return m.model;
  const builtin = (DEFAULT_MODELS as Record<string, unknown>)[name.toUpperCase()] as MosModel | undefined;
  if (builtin && (builtin as { kind?: string }).kind === (isP ? "pmos" : "nmos")) return builtin;
  missing(errors, name, where, isP ? "PMOS" : "NMOS", "generic 1 µm LEVEL-1");
  return isP ? DEFAULT_MODELS.PMOS : DEFAULT_MODELS.NMOS;
}

/** Resolve a switch model. `isI=true` selects the current-controlled (CSW) default. */
export function resolveSwitch(reg: ModelRegistry, name: string, isI: boolean, errors?: SimError[], where?: string): SwitchModel {
  const m = lookupModel(reg, name);
  if (m && m.kind === "SW") {
    // A .model declared as SW used on a W element (or CSW on an S element) is a wiring mistake,
    // not a parameter question: the thresholds are in different UNITS. Fix the kind so the
    // engine's transition-width fallback scales correctly, and say so.
    if ((m.model.kind === "iswitch") !== isI) {
      errors?.push({
        severity: "warning",
        message: `Model "${name}" is a ${m.model.kind === "iswitch" ? "current" : "voltage"}-controlled switch (${m.model.kind === "iswitch" ? "CSW" : "SW"}) but ${where ?? "this element"} is a ${isI ? "current" : "voltage"}-controlled switch. ` +
          `Its threshold is being read as ${isI ? "amperes" : "volts"}; declare a matching .model ${isI ? "CSW" : "SW"} card if that is not what you meant.`,
        location: where,
      });
      return { ...m.model, kind: isI ? "iswitch" : "vswitch" };
    }
    return m.model;
  }
  const builtin = (DEFAULT_MODELS as Record<string, unknown>)[name.toUpperCase()] as SwitchModel | undefined;
  if (builtin && (builtin as { Ron?: number }).Ron !== undefined) return builtin;
  missing(errors, name, where, isI ? "current-controlled switch" : "voltage-controlled switch", "Ron=1Ω Roff=1TΩ Vt=0 Vh=0");
  return isI ? DEFAULT_MODELS.CSW : DEFAULT_MODELS.SW;
}

/** Resolve a VDMOS power-MOSFET model. `isP=true` selects the p-channel default. */
export function resolveVdmos(reg: ModelRegistry, name: string, isP: boolean, errors?: SimError[], where?: string): VdmosModel {
  const m = lookupModel(reg, name);
  if (m && m.kind === "VDMOS") return m.model;
  const builtin = (DEFAULT_MODELS as Record<string, unknown>)[name.toUpperCase()] as VdmosModel | undefined;
  if (builtin && (builtin as { kind?: string }).kind === (isP ? "vdmos-p" : "vdmos-n")) return builtin;
  missing(errors, name, where, isP ? "p-channel VDMOS" : "n-channel VDMOS", "generic 100 V / 30 A TO-220-class");
  return isP ? DEFAULT_MODELS.VDMOSP : DEFAULT_MODELS.VDMOSN;
}

/** Resolve a BJT model. `isP=true` selects PNP fallback. */
export function resolveBjt(reg: ModelRegistry, name: string, isP: boolean, errors?: SimError[], where?: string): BjtModel {
  const m = lookupModel(reg, name);
  if (m && m.kind === "Q") return m.model;
  const builtin = (DEFAULT_MODELS as Record<string, unknown>)[name.toUpperCase()] as BjtModel | undefined;
  if (builtin && (builtin as { kind?: string }).kind === (isP ? "pnp" : "npn")) return builtin;
  missing(errors, name, where, isP ? "PNP" : "NPN", "generic small-signal");
  return isP ? DEFAULT_MODELS.PNP : DEFAULT_MODELS.NPN;
}

/** Resolve a JFET model. `isP=true` selects the p-channel default if the name isn't found. */
export function resolveJfet(reg: ModelRegistry, name: string, isP: boolean, errors?: SimError[], where?: string): JfetModel {
  const m = lookupModel(reg, name);
  if (m && m.kind === "J") return m.model;
  const builtin = (DEFAULT_MODELS as Record<string, unknown>)[name.toUpperCase()] as JfetModel | undefined;
  if (builtin && (builtin as { kind?: string }).kind === (isP ? "pjf" : "njf")) return builtin;
  missing(errors, name, where, isP ? "p-channel JFET" : "n-channel JFET", "generic 2N3819-class small-signal");
  return isP ? DEFAULT_MODELS.PJF : DEFAULT_MODELS.NJF;
}

/**
 * Say out loud that a named model was not found and a GENERIC device is standing in for it.
 *
 * This used to be silent, and silence here is the same failure class as the LEVEL≠1 degradation
 * below: a schematic that says `2N3904` but simulates a Bf=200/Vaf=100 generic prints confident
 * hFE and bandwidth numbers that belong to no real part. The fallback still happens (refusing to
 * simulate a whole schematic over one un-embedded model is worse), but it is now VISIBLE, and it
 * names the fix. `errors` is optional so existing callers keep compiling; pass it wherever you can.
 */
function missing(errors: SimError[] | undefined, name: string, where: string | undefined, kind: string, generic: string): void {
  if (!errors) return;
  errors.push({
    severity: "warning",
    message:
      `Model "${name}"${where ? ` (used by ${where})` : ""} is not defined in this document — ` +
      `simulating with the ${generic} ${kind} default instead. Any number reported for this device is for a GENERIC part, not for ${name}. ` +
      `Fix: paste the .model line into the model/directives pane, or place the part from the Spice++ library (find_part / add_part), which embeds its model in the document.`,
    location: where,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// internal helpers

/**
 * Pre-process a multi-line text blob: strip comments + blanks, join `+`-continuation lines onto
 * the previous logical line. This matches parseSubckts so callers can pass the same input.
 */
function joinContinuations(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/;.*$/, "");
    if (/^\s*\*/.test(line) || /^\s*$/.test(line)) continue;
    if (/^\s*\+/.test(line) && out.length > 0) {
      out[out.length - 1] += " " + line.replace(/^\s*\+\s*/, "");
    } else {
      out.push(line.trim());
    }
  }
  return out;
}

/** Parse one logical line that's already known to start with `.model`. Returns null on hard failure. */
function parseOneModel(line: string, errors: SimError[]): AnyModel | null {
  // .model NAME TYPE [(] params* [)]
  //   1            2     3
  const m = /^\.model\s+(\S+)\s+(\S+?)(?:\s*\(([\s\S]*?)\)|\s+([\s\S]+))?$/i.exec(line);
  if (!m) {
    errors.push({ severity: "warning", message: `Malformed .model line: "${line}"` });
    return null;
  }
  const name = m[1];
  // TYPE may have a trailing "(" stuck on it if the user wrote "TYPE(p=v)". Strip it.
  let type = m[2].replace(/\(.*$/, "").toUpperCase();
  const paramsText = (m[3] ?? m[4] ?? "").trim();

  // Some SPICE dialects accept "NMOS LEVEL=1" before the param block; LEVEL=1 is the only level
  // we support, so we consume it here and validate it just below.
  const params = parseParamList(paramsText, errors, line);

  // LEVEL handling. Reinterpreting a BSIM/EKV card as Shichman-Hodges is the single most
  // dangerous thing this parser can do: BSIM3 (LEVEL=49) parameters mean entirely different
  // physical quantities, so the solve still converges and still prints confident node voltages —
  // they are just wrong, with no visible sign anything happened. For a product whose whole claim
  // is that its numbers can be trusted, silent degradation is worse than refusing outright.
  // So: fail LOUDLY and specifically, and name the way out.
  // Scoped to MOSFETs: LEVEL selects the MOS model family, and BSIM/EKV cards are the real
  // hazard. Other device types use LEVEL differently (or not at all), so don't police them here.
  const level = params["LEVEL"];
  if ((type === "NMOS" || type === "PMOS") && typeof level === "number" && level !== 1) {
    const known: Record<number, string> = {
      2: "MOS2 (Meyer)", 3: "MOS3 (semi-empirical short-channel)", 6: "MOS6",
      14: "BSIM4", 49: "BSIM3v3", 54: "BSIM4", 55: "EKV", 57: "BSIM3 SOI", 8: "BSIM3",
    };
    const label = known[level] ? ` (${known[level]})` : "";
    errors.push({
      severity: "error",
      message: `.model ${name}: LEVEL=${level}${label} is not implemented — only LEVEL=1 (Shichman-Hodges) is. ` +
        `Its parameters mean different physical quantities than LEVEL=1, so reusing them would produce confident but wrong results. ` +
        `Use a LEVEL=1 model for this device, or replace the part with one whose model you have as LEVEL=1.`,
    });
    return null;   // refuse the model rather than register a plausible-looking impostor
  }

  switch (type) {
    case "D": case "ZENER": case "SCHOTTKY": {
      // DEFAULT_MODELS is a heterogeneous record (D/ZENER/SCHOTTKY are DiodeModels; NMOS/PMOS
      // are MosModels; NPN/PNP are BjtModels). The cast through `unknown` is safe because we
      // only access entries whose key we just checked - and the structural shape is enforced
      // by the field accesses below.
      const baseAny = (DEFAULT_MODELS as unknown as Record<string, DiodeModel | undefined>)[type];
      const base = baseAny ?? DEFAULT_MODELS.D;
      const model: DiodeModel = {
        Is:   num(params, "IS",   base.Is),
        N:    num(params, "N",    base.N),
        Rs:   num(params, "RS",   base.Rs),
        Cjo:  num(params, "CJO",  base.Cjo),
        Vj:   num(params, "VJ",   base.Vj),
        M:    num(params, "M",    base.M),
        Bv:   num(params, "BV",   base.Bv),
        Ibv:  num(params, "IBV",  base.Ibv),
        Tnom: num(params, "TNOM", base.Tnom),
        XTI:  num(params, "XTI",  base.XTI),
        Eg:   num(params, "EG",   base.Eg),
      };
      return { kind: "D", model, name };
    }
    case "NMOS": case "PMOS": {
      const isP = type === "PMOS";
      const base = isP ? DEFAULT_MODELS.PMOS : DEFAULT_MODELS.NMOS;
      const model: MosModel = {
        kind: isP ? "pmos" : "nmos",
        Vto:    num(params, "VTO",    base.Vto),
        Kp:     num(params, "KP",     base.Kp),
        Lambda: num(params, "LAMBDA", base.Lambda),
        Gamma:  num(params, "GAMMA",  base.Gamma),
        Phi:    num(params, "PHI",    base.Phi),
        W:      num(params, "W",      base.W),
        L:      num(params, "L",      base.L),
        Cgso:   num(params, "CGSO",   base.Cgso),
        Cgdo:   num(params, "CGDO",   base.Cgdo),
        Cgbo:   num(params, "CGBO",   base.Cgbo),
        Cbd:    num(params, "CBD",    base.Cbd),
        Cbs:    num(params, "CBS",    base.Cbs),
        Pb:     num(params, "PB",     base.Pb),
        Mj:     num(params, "MJ",     base.Mj),
        Tnom:   num(params, "TNOM",   base.Tnom),
        Kf:     num(params, "KF",     base.Kf),
        Af:     num(params, "AF",     base.Af),
        Nsubvt: num(params, "NSUBVT", base.Nsubvt),
      };
      return { kind: "M", model, name };
    }
    case "NPN": case "PNP": {
      const isP = type === "PNP";
      const base = isP ? DEFAULT_MODELS.PNP : DEFAULT_MODELS.NPN;
      // EMISSION-COEFFICIENT MAPPING — read this before "fixing" it.
      //
      // engine.ts:822 uses `BjtModel.Ne` as Nf and `BjtModel.Nc` as Nr: the FORWARD and REVERSE
      // transport emission coefficients. In real SPICE those are NF and NR; NE and NC are the
      // B-E and B-C LEAKAGE emission coefficients of the ISE/ISC terms, which this engine does
      // not implement at all. Reading a vendor card's `NE=1.259` into the field the engine uses
      // as Nf inflates Vt_eff by 26 %, which moves every Vbe by ~170 mV and every bias point
      // with it — silently. Real cards ship NE on almost every jellybean transistor, so this was
      // live on any pasted model. Map NF→Ne and NR→Nc; ignore NE/NC and say so.
      if (params["NE"] !== undefined || params["NC"] !== undefined || params["ISE"] !== undefined || params["ISC"] !== undefined) {
        errors.push({
          severity: "info",
          message: `.model ${name}: the low-current leakage terms (ISE/NE, ISC/NC) are not implemented — beta will NOT roll off at low collector current. ` +
            `Forward/reverse emission coefficients are taken from NF/NR (defaulting to 1).`,
        });
      }
      if (params["IKF"] !== undefined || params["IKR"] !== undefined) {
        errors.push({
          severity: "info",
          message: `.model ${name}: high-current roll-off (IKF/IKR) is not implemented — beta stays at BF=${num(params, "BF", base.Bf)} at every current. ` +
            `Above roughly IKF the real device's hFE falls, so a hard-driven switch will need more base drive than this model suggests.`,
        });
      }
      const model: BjtModel = {
        kind: isP ? "pnp" : "npn",
        Is:   num(params, "IS",   base.Is),
        Bf:   num(params, "BF",   base.Bf),
        Br:   num(params, "BR",   base.Br),
        Ne:   num(params, "NF",   base.Ne),
        Nc:   num(params, "NR",   base.Nc),
        Vaf:  num(params, "VAF",  base.Vaf),
        Var:  num(params, "VAR",  base.Var),
        Rb:   num(params, "RB",   base.Rb),
        Rc:   num(params, "RC",   base.Rc),
        Re:   num(params, "RE",   base.Re),
        Cje:  num(params, "CJE",  base.Cje),
        Vje:  num(params, "VJE",  base.Vje),
        Mje:  num(params, "MJE",  base.Mje),
        Cjc:  num(params, "CJC",  base.Cjc),
        Vjc:  num(params, "VJC",  base.Vjc),
        Mjc:  num(params, "MJC",  base.Mjc),
        Tnom: num(params, "TNOM", base.Tnom),
        XTI:  num(params, "XTI",  base.XTI),
        XTB:  num(params, "XTB",  base.XTB),
        Eg:   num(params, "EG",   base.Eg),
      };
      return { kind: "Q", model, name };
    }
    case "SW": case "VSWITCH": case "CSW": case "ISWITCH": {
      // .model SW  SW (Ron=… Roff=… Vt=… Vh=… [Vtr=…])
      // .model CSW CSW(Ron=… Roff=… It=… Ih=… [Itr=…])
      // Vt/It and Vh/Ih are the same two fields (see types.ts SwitchModel) - the units follow
      // from the element letter, not from the card.
      const isI = type === "CSW" || type === "ISWITCH";
      const base = isI ? DEFAULT_MODELS.CSW : DEFAULT_MODELS.SW;
      const thr = params["VT"] !== undefined ? "VT" : "IT";
      const hys = params["VH"] !== undefined ? "VH" : "IH";
      const tr = params["VTR"] !== undefined ? "VTR" : "ITR";
      const Vh = Math.abs(num(params, hys, base.Vh));
      const model: SwitchModel = {
        kind: isI ? "iswitch" : "vswitch",
        Ron:  Math.abs(num(params, "RON",  base.Ron)) || 1e-9,
        Roff: Math.abs(num(params, "ROFF", base.Roff)) || 1e12,
        Vt:   num(params, thr, base.Vt),
        Vh,
        ...(params[tr] !== undefined && Math.abs(params[tr]) > 0 ? { Vtr: Math.abs(params[tr]) } : {}),
      };
      if (model.Roff <= model.Ron) {
        errors.push({
          severity: "error",
          message: `.model ${name}: Roff (${model.Roff} Ω) must be greater than Ron (${model.Ron} Ω) - a switch whose "off" state conducts at least as well as its "on" state is not a switch.`,
        });
        return null;
      }
      return { kind: "SW", model, name };
    }
    case "VDMOS": {
      // LTspice's power-MOSFET card. `pchan` is a BARE token (no "="), so it never reaches
      // parseParamList - detect it on the raw text.
      const isP = /(^|[\s(])pchan([\s)]|$)/i.test(paramsText);
      const base = isP ? DEFAULT_MODELS.VDMOSP : DEFAULT_MODELS.VDMOSN;
      // `Ron` is not an LTspice VDMOS parameter, but it is what a datasheet gives you and the
      // first thing anyone reaches for. Accept it as the drain series resistance when Rd is
      // absent, and SAY that is what happened rather than silently ignoring the number.
      let Rd = num(params, "RD", base.Rd);
      if (params["RON"] !== undefined) {
        if (params["RD"] !== undefined) {
          errors.push({ severity: "info", message: `.model ${name}: both Rd and Ron given - Rd=${Rd} Ω is used and Ron is ignored (they describe the same series resistance).` });
        } else {
          Rd = Math.abs(params["RON"]);
          errors.push({ severity: "info", message: `.model ${name}: Ron=${Rd} Ω is not a VDMOS parameter; it has been applied as the drain series resistance Rd. The channel's own on-resistance (from Kp and Vgs) adds to it, so Rds(on) will be slightly HIGHER than ${Rd} Ω.` });
        }
      }
      // Vto sign is the polarity, and getting it wrong makes the device conduct at the wrong
      // gate voltage with no other symptom. Enforce it against the declared channel type.
      let Vto = num(params, "VTO", base.Vto);
      if (isP && Vto > 0) { Vto = -Vto; errors.push({ severity: "warning", message: `.model ${name}: a pchan VDMOS needs a NEGATIVE Vto; ${params["VTO"]} was interpreted as ${Vto} V.` }); }
      if (!isP && Vto < 0) { Vto = -Vto; errors.push({ severity: "warning", message: `.model ${name}: an n-channel VDMOS needs a POSITIVE Vto; ${params["VTO"]} was interpreted as ${Vto} V. Add "pchan" to the card if you meant a p-channel device.` }); }
      const body: DiodeModel = {
        Is:   num(params, "IS",   base.body.Is),
        N:    num(params, "N",    base.body.N),
        Rs:   0,                                          // body-diode series R is `Rb`
        Cjo:  num(params, "CJO",  base.body.Cjo),
        Vj:   num(params, "VJ",   base.body.Vj),
        M:    num(params, "M",    base.body.M),
        Bv:   num(params, "BV",   base.body.Bv),
        Ibv:  num(params, "IBV",  base.body.Ibv),
        Tnom: num(params, "TNOM", base.body.Tnom),
        XTI:  num(params, "XTI",  base.body.XTI),
        Eg:   num(params, "EG",   base.body.Eg),
      };
      if (params["TT"] !== undefined) {
        errors.push({ severity: "info", message: `.model ${name}: the body diode's transit time TT (reverse-recovery charge) is not implemented - reverse-recovery loss will be UNDER-reported. Every other body-diode parameter is used.` });
      }
      if (params["MTRIODE"] !== undefined) {
        errors.push({ severity: "info", message: `.model ${name}: mtriode (LTspice's triode-region conductance multiplier) is not implemented; the triode region follows the plain Shichman-Hodges expression, which is continuous with saturation. Use Rd to trim Rds(on).` });
      }
      const model: VdmosModel = {
        kind: isP ? "vdmos-p" : "vdmos-n",
        Vto,
        Kp:      Math.abs(num(params, "KP",      base.Kp)),
        Lambda:  Math.abs(num(params, "LAMBDA",  base.Lambda)),
        Rd:      Math.max(Rd, 0),
        Rs:      Math.max(num(params, "RS",      base.Rs), 0),
        Rg:      Math.max(num(params, "RG",      base.Rg), 0),
        Rds:     Math.max(num(params, "RDS",     base.Rds), 0),
        Cgs:     Math.max(num(params, "CGS",     base.Cgs), 0),
        Cgdmax:  Math.max(num(params, "CGDMAX",  base.Cgdmax), 0),
        Cgdmin:  Math.max(num(params, "CGDMIN",  base.Cgdmin), 0),
        Cgda:    Math.max(num(params, "A",       base.Cgda), 1e-6),
        Nsubvt:  Math.max(num(params, "KSUBTHRES", base.Nsubvt), 1),
        Tnom:    num(params, "TNOM", base.Tnom),
        Rb:      Math.max(num(params, "RB",      base.Rb), 0),
        body,
      };
      if (model.Cgdmin > model.Cgdmax) {
        errors.push({ severity: "warning", message: `.model ${name}: Cgdmin (${model.Cgdmin} F) exceeds Cgdmax (${model.Cgdmax} F) - they have been swapped. Cgdmax is the DRAIN-LOW value.` });
        const t = model.Cgdmin; model.Cgdmin = model.Cgdmax; model.Cgdmax = t;
      }
      return { kind: "VDMOS", model, name };
    }
    case "NJF": case "PJF": {
      const isP = type === "PJF";
      const base = isP ? DEFAULT_MODELS.PJF : DEFAULT_MODELS.NJF;
      const model: JfetModel = {
        kind: isP ? "pjf" : "njf",
        Vto:    num(params, "VTO",    base.Vto),
        Beta:   num(params, "BETA",   base.Beta),
        Lambda: num(params, "LAMBDA", base.Lambda),
        Rd:     num(params, "RD",     base.Rd),
        Rs:     num(params, "RS",     base.Rs),
        Cgs:    num(params, "CGS",    base.Cgs),
        Cgd:    num(params, "CGD",    base.Cgd),
        Pb:     num(params, "PB",     base.Pb),
        Is:     num(params, "IS",     base.Is),
        N:      num(params, "N",      base.N),
        Fc:     num(params, "FC",     base.Fc),
        Tnom:   num(params, "TNOM",   base.Tnom),
        Kf:     num(params, "KF",     base.Kf),
        Af:     num(params, "AF",     base.Af),
      };
      // A card whose VTO sign disagrees with its declared type is almost always a transcription
      // slip, and it silently turns a depletion device into one that never turns on. Correct the
      // MAGNITUDE onto the right sign and say so, rather than simulating a device that cannot work.
      if (model.Vto !== 0 && (model.Vto > 0) !== isP) {
        errors.push({
          severity: "warning",
          message: `.model ${name} ${type}: VTO=${model.Vto} has the wrong sign for a ${isP ? "p" : "n"}-channel JFET ` +
            `(${isP ? "positive" : "negative"} is expected) - using ${isP ? "+" : "-"}${Math.abs(model.Vto)}.`,
        });
        model.Vto = isP ? Math.abs(model.Vto) : -Math.abs(model.Vto);
      }
      return { kind: "J", model, name };
    }
    default:
      errors.push({ severity: "warning", message: `.model ${name}: type "${type}" is not supported in v1 (supported: D, ZENER, SCHOTTKY, NMOS, PMOS, NPN, PNP, SW, CSW, VDMOS, NJF, PJF).` });
      return null;
  }
}

/** Parse a `KEY=VAL KEY=VAL …` string into a name→number map (uppercase keys). */
function parseParamList(text: string, errors: SimError[], context: string): Record<string, number> {
  const out: Record<string, number> = {};
  // Tokenise on whitespace, but tokens may be "KEY=VAL" or split "KEY" "=" "VAL" or "KEY=" "VAL".
  // Simplest: turn `=` into space-equal-space, then process pairs.
  const norm = text.replace(/=/g, " = ");
  const toks = norm.split(/\s+/).filter(Boolean);
  for (let i = 0; i < toks.length; i++) {
    if (toks[i + 1] === "=" && i + 2 < toks.length) {
      const key = toks[i].toUpperCase();
      // femtoF: inside a .model card SPICE is case-insensitive and `F` is femto, never a unit.
      // An all-caps vendor card ("IS=6.734F CJE=4.493P") is the normal way these are published.
      const v = parseValue(toks[i + 2], { femtoF: true });
      if (!isFinite(v)) {
        errors.push({ severity: "warning", message: `${context}: cannot parse "${toks[i + 2]}" for parameter "${key}" - ignored.` });
      } else {
        out[key] = v;
      }
      i += 2;
    }
    // Bare tokens (no =) at this stage are likely TYPE prefixes that escaped - silently skip.
  }
  return out;
}

function num(p: Record<string, number>, key: string, fallback: number): number {
  const v = p[key];
  return typeof v === "number" && isFinite(v) ? v : fallback;
}
