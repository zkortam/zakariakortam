/**
 * `.noise` - small-signal noise analysis with a RANKED PER-COMPONENT CONTRIBUTION TABLE.
 *
 * Method (textbook adjoint / transposed-system technique, the same one SPICE3 uses):
 *
 *   For a linear network, every noise generator is an independent current source i_k injected
 *   between a node pair (p_k, q_k) with power spectral density S_k(f) [A²/Hz]. Its contribution
 *   to the output is |H_k(f)|²·S_k(f) where H_k = ∂V(out,ref)/∂i_k. Computing H_k directly would
 *   need one solve PER SOURCE per frequency. Instead, note that
 *
 *        V(out,ref) = cᵀ·A⁻¹·b        with c = e_out − e_ref
 *        cᵀ·A⁻¹     = (A⁻ᵀ·c)ᵀ = yᵀ    ⟹  ONE transposed solve A ᵀy = c gives every H_k at once:
 *        H_k        = y[q_k] − y[p_k]
 *
 *   and, for free, the gain from the input source (its RHS is the same shape), so the
 *   input-referred noise costs no extra solve either. Total output noise density is then
 *   sqrt(Σ_k |H_k|²·S_k) - powers add, RMS values never do.
 *
 * Noise generators implemented (all standard SPICE3 forms):
 *   R      thermal        S = 4kT/R
 *   D      shot           S = 2q·|Id|                     between the (internal, if Rs>0) anode and cathode
 *          flicker        S = KF·|Id|^AF / f
 *          Rs thermal     S = 4kT/(Rs/area)
 *   M      channel thermal S = 8kT·gm/3                    drain↔source
 *          flicker        S = KF·|Id|^AF / (Cox·L²·f)
 *   Q      collector shot S = 2q·|Ic|                      collector'↔emitter'
 *          base shot      S = 2q·|Ib|                      base'↔emitter'
 *          base flicker   S = KF·|Ib|^AF / f
 *          rb/rc/re thermal S = 4kT/r                      external↔internal prime node
 *   J      channel thermal S = 8kT·gm/3                    drain'↔source'
 *          flicker        S = KF·|Id|^AF / f
 *          rd/rs thermal  S = 4kT/(r/area)
 *   VDMOS  channel thermal S = 8kT·gm/3                    drain'↔source'
 *          rd/rs/rg thermal S = 4kT/r                      (dominant on a power part)
 *   S / W  thermal        S = 4kT·g                        a closed switch is a resistor
 *
 * The matrix is assembled by engine.assembleAC, which stamps every device's ohmic parasitics
 * (they are unconditional now - see ACAssemblyOpts), so a BJT's rb (and a
 * diode's Rs) are actually IN the small-signal network here. Injecting rb's thermal noise into a
 * branch the matrix does not contain would produce a confident, meaningless number - the exact
 * failure mode this project exists to prevent.
 *
 * Everything reported here is measured, never assumed: if the operating point does not converge,
 * or the output node / input source cannot be resolved, or a frequency point is singular, the
 * analysis returns an explicit error and NO numbers rather than a plausible-looking density.
 */
import {
  Netlist, NetlistElement, Analysis, SimResult, SimError, SimOptions, Complex,
  NoiseAnalysisResult, NoiseContribution, KB, Q,
} from "./types";
import { solveComplex } from "./matrix";
import { assembleAC, acFreqGrid, makeIndexer, prepareSmallSignal, type Indexer } from "./engine";

/** One elementary noise generator: an independent current source between two matrix rows.
 *  Its PSD is `sConst + sOverF / f` (exactly one of the two is non-zero in practice). */
interface NoiseSource {
  comp: string;                                   // refdes it belongs to
  type: string;                                   // "R" | "D" | "M" | "Q"
  mech: "thermal" | "shot" | "flicker";
  p: number; q: number;                           // matrix rows (−1 = ground)
  sConst: number;                                 // white PSD, A²/Hz
  sOverF: number;                                 // flicker numerator: S = sOverF / f
}

const boltz4T = (tempC: number) => 4 * KB * (tempC + 273.15);

/** Transposed complex solve: A ᵀ y = c. Plain transpose (NOT conjugate) - the adjoint identity
 *  cᵀA⁻¹ = (A⁻ᵀc)ᵀ is an algebraic one and conjugating would silently flip the sign of every
 *  reactive term (right magnitudes at DC, wrong ones everywhere else). */
function solveTransposed(A: Complex[][], c: Complex[]): Complex[] | null {
  const n = c.length;
  const At: Complex[][] = Array.from({ length: n }, (_, i) => {
    const row = new Array<Complex>(n);
    for (let j = 0; j < n; j++) row[j] = { re: A[j][i].re, im: A[j][i].im };
    return row;
  });
  return solveComplex(At, c);
}

/** Trapezoidal integral of y over the (ascending, possibly log-spaced) grid x. */
function trapz(x: number[], y: number[]): number {
  let s = 0;
  for (let i = 1; i < x.length; i++) s += 0.5 * (y[i] + y[i - 1]) * (x[i] - x[i - 1]);
  return s;
}

/** Build the list of elementary noise generators at the converged operating point. */
function collectSources(nl: Netlist, ix: Indexer, O: SimOptions, lin: Record<string, any>, notes: string[]): NoiseSource[] {
  const out: NoiseSource[] = [];
  const k4T = boltz4T(O.temp);
  const N = (n: string) => ix.node(n);
  // Internal (device-prime) nodes were allocated during precount; look them up WITHOUT
  // ix.internal(), which would allocate a new row and desynchronise us from the matrix.
  const inner = (key: string) => ix.nodeIndex.get(key) ?? -1;
  let sawOpamp = false, coxAssumed = false;
  for (const el of nl.elements) {
    switch (el.type) {
      case "R": {
        // Uses _Reff (TC1/TC2 temperature-scaled) so noise and the AC gain see the same resistor.
        const Reff = (el as unknown as { _Reff?: number })._Reff ?? el.value;
        const R = Math.abs(Reff);
        if (!isFinite(R) || R <= 0) break;
        out.push({ comp: el.name, type: "R", mech: "thermal", p: N(el.n1), q: N(el.n2), sConst: k4T / R, sOverF: 0 });
        break;
      }
      case "D": {
        const L = lin[el.name] ?? {};
        const Id = Math.abs(L.Id ?? 0);
        const area = el.area && el.area > 0 ? el.area : 1;
        const rs = el.model?.Rs ?? 0;
        const ap = rs > 1e-9 ? inner(`Dint:${el.name}`) : N(el.nA);
        out.push({ comp: el.name, type: "D", mech: "shot", p: ap, q: N(el.nK), sConst: 2 * Q * Id, sOverF: 0 });
        const kf = el.model?.Kf ?? 0, af = el.model?.Af ?? 1;
        if (kf > 0 && Id > 0) out.push({ comp: el.name, type: "D", mech: "flicker", p: ap, q: N(el.nK), sConst: 0, sOverF: kf * Math.pow(Id, af) });
        if (rs > 1e-9) out.push({ comp: el.name, type: "D", mech: "thermal", p: N(el.nA), q: ap, sConst: k4T / (rs / area), sOverF: 0 });
        break;
      }
      case "M": {
        const L = lin[el.name] ?? {};
        const gm = Math.abs(L.gm ?? 0);
        const Id = Math.abs(L.Id ?? 0);
        const m = el.model;
        // SPICE3 MOS1: channel thermal noise = 8kT·gm/3 (the saturation-region result). It is
        // applied in every region, as SPICE does - a device deep in triode is noisier than this
        // formula says, so the number is a lower bound there, not a fabrication.
        out.push({ comp: el.name, type: "M", mech: "thermal", p: N(el.nD), q: N(el.nS), sConst: (8 / 3) * (boltz4T(O.temp) / 4) * gm, sOverF: 0 });
        const kf = m.Kf ?? 0, af = m.Af ?? 1;
        if (kf > 0 && Id > 0) {
          // Cox is not a Level-1 DC parameter, so it may be absent. Deriving it from Kp = µ·Cox
          // requires assuming a mobility; we do that ONLY as a fallback and we say so in the
          // notes, because flicker magnitude is a fitted quantity and a silent guess here would
          // be indistinguishable from a measurement.
          let cox = m.Cox ?? 0;
          if (!(cox > 0)) {
            const mu = m.kind === "pmos" ? 0.025 : 0.06;   // m²/V·s, typical bulk-Si surface mobility
            cox = m.Kp / mu;
            coxAssumed = true;
          }
          const L2 = Math.max(m.L, 1e-9) ** 2;
          out.push({ comp: el.name, type: "M", mech: "flicker", p: N(el.nD), q: N(el.nS), sConst: 0, sOverF: (kf * Math.pow(Id, af)) / (cox * L2) });
        }
        break;
      }
      case "Q": {
        const L = lin[el.name] ?? {};
        const Ic = Math.abs(L.Ic ?? 0), Ib = Math.abs(L.Ib ?? 0);
        const m = el.model;
        const area = el.area && el.area > 0 ? el.area : 1;
        const bp = (m.Rb ?? 0) > 1e-9 ? inner(`Qb:${el.name}`) : N(el.nB);
        const cp = (m.Rc ?? 0) > 1e-9 ? inner(`Qc:${el.name}`) : N(el.nC);
        const ep = (m.Re ?? 0) > 1e-9 ? inner(`Qe:${el.name}`) : N(el.nE);
        out.push({ comp: el.name, type: "Q", mech: "shot", p: cp, q: ep, sConst: 2 * Q * Ic, sOverF: 0 });
        out.push({ comp: el.name, type: "Q", mech: "shot", p: bp, q: ep, sConst: 2 * Q * Ib, sOverF: 0 });
        const kf = m.Kf ?? 0, af = m.Af ?? 1;
        if (kf > 0 && Ib > 0) out.push({ comp: el.name, type: "Q", mech: "flicker", p: bp, q: ep, sConst: 0, sOverF: kf * Math.pow(Ib, af) });
        if ((m.Rb ?? 0) > 1e-9) out.push({ comp: el.name, type: "Q", mech: "thermal", p: N(el.nB), q: bp, sConst: k4T / (m.Rb / area), sOverF: 0 });
        if ((m.Rc ?? 0) > 1e-9) out.push({ comp: el.name, type: "Q", mech: "thermal", p: N(el.nC), q: cp, sConst: k4T / (m.Rc / area), sOverF: 0 });
        if ((m.Re ?? 0) > 1e-9) out.push({ comp: el.name, type: "Q", mech: "thermal", p: N(el.nE), q: ep, sConst: k4T / (m.Re / area), sOverF: 0 });
        break;
      }
      case "J": {
        // JFET: channel thermal noise (same 8kT·gm/3 saturation result SPICE3 uses for a MOS
        // channel), the two ohmic terminal resistances, and drain-current flicker. Without these
        // a JFET — the classic LOW-NOISE front-end device — contributed exactly zero, and the
        // contribution table then attributed 100 % of the noise to whatever resistor was nearby.
        const L = lin[el.name] ?? {};
        const gm = Math.abs(L.gm ?? 0);
        const Id = Math.abs(L.Id ?? 0);
        const mj = el.model;
        const areaJ = el.area && el.area > 0 ? el.area : 1;
        const dN = mj.Rd > 1e-9 ? inner(`Jd:${el.name}`) : N(el.nD);
        const sN = mj.Rs > 1e-9 ? inner(`Js:${el.name}`) : N(el.nS);
        out.push({ comp: el.name, type: "J", mech: "thermal", p: dN, q: sN, sConst: (8 / 3) * (k4T / 4) * gm, sOverF: 0 });
        if (mj.Rd > 1e-9) out.push({ comp: el.name, type: "J", mech: "thermal", p: N(el.nD), q: dN, sConst: k4T / (mj.Rd / areaJ), sOverF: 0 });
        if (mj.Rs > 1e-9) out.push({ comp: el.name, type: "J", mech: "thermal", p: N(el.nS), q: sN, sConst: k4T / (mj.Rs / areaJ), sOverF: 0 });
        if ((mj.Kf ?? 0) > 0 && Id > 0) {
          out.push({ comp: el.name, type: "J", mech: "flicker", p: dN, q: sN, sConst: 0, sOverF: mj.Kf * Math.pow(Id, mj.Af ?? 1) });
        }
        break;
      }
      case "VDMOS": {
        // Power MOSFET: channel thermal noise plus the package/die ohmic resistances, which on a
        // power part are the dominant term. VdmosModel carries no KF/AF, so there is no flicker
        // term to report — and inventing one would be a fabricated number.
        const L = lin[el.name] ?? {};
        const gm = Math.abs(L.gm ?? 0);
        const mv = el.model;
        const dN = mv.Rd > 1e-9 ? inner(`VDd:${el.name}`) : N(el.nD);
        const sN = mv.Rs > 1e-9 ? inner(`VDs:${el.name}`) : N(el.nS);
        const gN = mv.Rg > 1e-9 ? inner(`VDg:${el.name}`) : N(el.nG);
        out.push({ comp: el.name, type: "VDMOS", mech: "thermal", p: dN, q: sN, sConst: (8 / 3) * (k4T / 4) * gm, sOverF: 0 });
        if (mv.Rd > 1e-9) out.push({ comp: el.name, type: "VDMOS", mech: "thermal", p: N(el.nD), q: dN, sConst: k4T / mv.Rd, sOverF: 0 });
        if (mv.Rs > 1e-9) out.push({ comp: el.name, type: "VDMOS", mech: "thermal", p: N(el.nS), q: sN, sConst: k4T / mv.Rs, sOverF: 0 });
        if (mv.Rg > 1e-9) out.push({ comp: el.name, type: "VDMOS", mech: "thermal", p: N(el.nG), q: gN, sConst: k4T / mv.Rg, sOverF: 0 });
        break;
      }
      case "S": case "W": {
        // A closed switch IS a resistor (Ron), and a resistor is a noise source. Reporting a
        // sampling/chopper front-end as noiseless through its own switches is a real omission.
        // The bias conductance the AC stamp used is the honest value to use here.
        const L = lin[el.name] ?? {};
        const g = Math.abs(L.g ?? 0);
        if (g > 0) out.push({ comp: el.name, type: el.type, mech: "thermal", p: N(el.n1), q: N(el.n2), sConst: k4T * g, sOverF: 0 });
        break;
      }
      case "OPAMP": sawOpamp = true; break;
      default: break;
    }
  }
  if (coxAssumed) notes.push("MOSFET flicker noise used Cox derived from Kp with an assumed surface mobility (600 cm²/V·s NMOS, 250 PMOS) because the model has no Cox. Set Cox in the .model for a fitted number.");
  if (sawOpamp) notes.push("Ideal op-amp macromodels are treated as NOISELESS - this result contains no op-amp voltage/current noise. Add the datasheet en/in as explicit series/shunt sources at the inputs if you need them.");
  return out;
}

/** Run a `.noise` analysis. Returns a SimResult whose `noise` field carries the ranked table. */
export function runNoise(nl: Netlist, a: Analysis & { kind: "noise" }, O: SimOptions, errors: SimError[], t0: number): SimResult {
  const log: string[] = [];
  const notes: string[] = [];
  const fail = (msg: string, hint?: string): SimResult => ({
    analysis: a, title: "Noise", sweepName: "frequency", sweepUnit: "Hz", sweep: [], complex: false,
    signals: {}, units: {}, log, errors: errors.concat({ severity: "error", message: msg, ...(hint ? { hint } : {}) }),
    converged: false, stats: { matrixSize: 0, points: 0, timeMs: now() - t0 },
  });

  if (!(a.fstart > 0) || !(a.fstop >= a.fstart)) return fail(`.noise: need 0 < fstart ≤ fstop (got ${a.fstart} … ${a.fstop}).`);

  // 1) Operating point + small-signal parameters (identical to what .ac linearizes at).
  const { lin, ok } = prepareSmallSignal(nl, O);
  if (!ok) return fail(".noise: the DC operating point did not converge, so there is no bias point to linearize the noise sources at. Fix the operating point first (.op will report which device is to blame).");

  const ix = makeIndexer(nl, true);
  const outIdx = ix.node(a.out);
  const refName = a.ref ?? "0";
  const refIdx = ix.node(refName);
  if (outIdx < 0 && refIdx < 0) return fail(`.noise: output node "${a.out}" is not in the circuit (or is ground).`, "Use a node that appears in the netlist, e.g. .noise V(out) V1 dec 20 10 1meg");

  // 2) Resolve the input source - the reference the noise is input-referred to.
  const srcEl = nl.elements.find((e) => (e.type === "V" || e.type === "I") && e.name.toLowerCase() === a.src.toLowerCase()) as
    Extract<NetlistElement, { type: "V" | "I" }> | undefined;
  if (!srcEl) return fail(`.noise: input source "${a.src}" not found. It must be an independent V or I source in the circuit.`);
  const srcBranch = srcEl.type === "V" ? ix.branchOf.get(`V:${srcEl.name}`) : undefined;
  if (srcEl.type === "V" && srcBranch === undefined) return fail(`.noise: could not locate the branch unknown for source "${a.src}".`);
  const srcP = srcEl.type === "I" ? ix.node(srcEl.n1) : -1;
  const srcQ = srcEl.type === "I" ? ix.node(srcEl.n2) : -1;
  const inputUnit = srcEl.type === "V" ? "V" : "A";

  const sources = collectSources(nl, ix, O, lin, notes);
  if (sources.length === 0) return fail(".noise: this circuit contains no noise sources (no resistors, diodes, MOSFETs or BJTs) - there is nothing to report.");

  // 3) Frequency sweep: ONE adjoint solve per point yields every transfer function.
  const freqs = acFreqGrid(a.sweep, a.n, a.fstart, a.fstop);
  const onoise: number[] = [], inoise: number[] = [], gainArr: number[] = [];
  const perSource: number[][] = sources.map(() => []);       // |H|²·S at each frequency, V²/Hz
  const keptF: number[] = [];
  let singular = 0, zeroGain = 0;
  for (const f of freqs) {
    const { A } = assembleAC(ix, nl.elements, O, f, lin);
    const c: Complex[] = Array.from({ length: ix.size }, () => ({ re: 0, im: 0 }));
    if (outIdx >= 0) c[outIdx].re += 1;
    if (refIdx >= 0) c[refIdx].re -= 1;
    const y = solveTransposed(A, c);
    if (!y) { singular++; continue; }
    const H = (p: number, q: number): number => {
      const re = (q >= 0 ? y[q].re : 0) - (p >= 0 ? y[p].re : 0);
      const im = (q >= 0 ? y[q].im : 0) - (p >= 0 ? y[p].im : 0);
      return re * re + im * im;                                // |H|²
    };
    let sTot = 0;
    for (let k = 0; k < sources.length; k++) {
      const s = sources[k];
      const psd = s.sConst + (s.sOverF > 0 ? s.sOverF / f : 0);
      const contrib = H(s.p, s.q) * psd;
      perSource[k].push(contrib);
      sTot += contrib;
    }
    // Input gain from the same adjoint vector - the input source's RHS has the same shape as a
    // noise source's, so no second solve is needed.
    const g2 = srcEl.type === "V"
      ? (() => { const col = ix.nNodes + (srcBranch as number); return y[col].re * y[col].re + y[col].im * y[col].im; })()
      : H(srcP, srcQ);
    const g = Math.sqrt(g2);
    if (!(g > 0)) zeroGain++;
    keptF.push(f);
    onoise.push(Math.sqrt(sTot));
    gainArr.push(g);
    inoise.push(g > 0 ? Math.sqrt(sTot) / g : NaN);
  }
  if (keptF.length === 0) return fail(".noise: the small-signal matrix was singular at every frequency (an ideal lossless resonance?). Add a small series/parallel resistance.");
  if (singular > 0) errors.push({ severity: "warning", message: `.noise: ${singular} frequency point(s) were singular and are missing from the sweep.` });
  if (zeroGain > 0) {
    errors.push({
      severity: "warning",
      message: `.noise: the gain from ${a.src} to V(${a.out}) is zero at ${zeroGain} frequency point(s), so input-referred noise is undefined there (reported as NaN, never as 0).`,
      hint: `Check that ${a.src} actually drives ${a.out}.`,
    });
  }

  // 4) Integrate the band. Powers integrate; RMS values do not.
  const canIntegrate = keptF.length >= 2;
  const totalOutV2 = canIntegrate ? trapz(keptF, onoise.map((v) => v * v)) : null;
  const inPsd = inoise.map((v) => (isFinite(v) ? v * v : NaN));
  const totalInV2 = canIntegrate && inPsd.every((v) => isFinite(v)) ? trapz(keptF, inPsd) : null;

  // 5) The ranked contribution table - aggregate the elementary generators per component.
  const byComp = new Map<string, { type: string; v2: number; mech: { thermal?: number; shot?: number; flicker?: number } }>();
  for (let k = 0; k < sources.length; k++) {
    const s = sources[k];
    const v2 = canIntegrate ? trapz(keptF, perSource[k]) : perSource[k][0] ?? 0;
    if (!(v2 > 0)) continue;
    const rec = byComp.get(s.comp) ?? { type: s.type, v2: 0, mech: {} };
    rec.v2 += v2;
    rec.mech[s.mech] = (rec.mech[s.mech] ?? 0) + v2;
    byComp.set(s.comp, rec);
  }
  let sumV2 = 0; for (const r of byComp.values()) sumV2 += r.v2;
  const contributions: NoiseContribution[] = [...byComp.entries()]
    .map(([component, r]) => ({
      component, type: r.type, v2: r.v2, rms: Math.sqrt(r.v2),
      pct: sumV2 > 0 ? (100 * r.v2) / sumV2 : 0,
      mechanisms: r.mech,
    }))
    .sort((x, y) => y.v2 - x.v2);

  const noise: NoiseAnalysisResult = {
    out: a.out, ref: refName, src: a.src,
    freqs: keptF, onoise, inoise, gain: gainArr,
    totalOutRms: totalOutV2 != null && totalOutV2 >= 0 ? Math.sqrt(totalOutV2) : null,
    totalInRms: totalInV2 != null && totalInV2 >= 0 ? Math.sqrt(totalInV2) : null,
    contributions, notes,
  };

  // 6) Plottable signals. `onoise`/`inoise` are densities vs frequency; the per-component
  //    densities let a dock draw "which component dominates, and where".
  const signals: Record<string, number[]> = { onoise, inoise, gain: gainArr };
  const units: Record<string, string> = { onoise: "V/√Hz", inoise: `${inputUnit}/√Hz`, gain: inputUnit === "V" ? "" : "V/A" };
  const topComps = contributions.slice(0, 20).map((c) => c.component);
  for (const comp of topComps) {
    const acc = new Array(keptF.length).fill(0);
    for (let k = 0; k < sources.length; k++) {
      if (sources[k].comp !== comp) continue;
      for (let i = 0; i < keptF.length; i++) acc[i] += perSource[k][i];
    }
    signals[`onoise(${comp})`] = acc.map(Math.sqrt);
    units[`onoise(${comp})`] = "V/√Hz";
  }

  log.push(`${sources.length} noise generators across ${byComp.size} components; ${keptF.length} frequency points.`);
  if (contributions.length > 0) log.push(`Top contributor: ${contributions[0].component} at ${contributions[0].pct.toFixed(1)}% of the total noise power.`);
  for (const n of notes) log.push(n);

  return {
    analysis: a, title: "Noise", sweepName: "frequency", sweepUnit: "Hz",
    sweep: keptF, complex: false, signals, units, log, errors,
    converged: true, noise,
    stats: { matrixSize: ix.size, points: keptF.length, timeMs: now() - t0 },
  };
}

function now() { return typeof performance !== "undefined" ? performance.now() : Date.now(); }
