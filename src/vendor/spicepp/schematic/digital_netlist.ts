/**
 * Netlisting of digital parts: schematic components → DigitalDesign (plain data for the kernel)
 * plus the D2A elements and A2D bridges where digital pins meet analog nets.
 *
 * NET CLASSIFICATION, the one rule everything else follows:
 *   • A net that touches only digital pins is a DIGITAL net. It is one kernel signal; its drivers
 *     resolve by strength (two push-pull outputs that disagree give X; tri-state outputs release
 *     to Z) and it never enters the analog matrix.
 *   • A net that also touches an analog terminal (any analog element, ground, an ADC input or a
 *     DAC output) is a MIXED net. Each digital output on it becomes a D2A element with its
 *     family's levels, edge times and output resistance; each digital input reads it through an
 *     A2D bridge with its family's thresholds. A gate driving an RC therefore sees the RC: the
 *     next gate switches when the capacitor voltage crosses its threshold, not when the first
 *     gate's output changed.
 */
import type { A2DBridge, AnalyzerSpec, DigitalDesign, DigitalNetSpec, DigitalPartSpec, DisplaySpec, NetlistElement, SimError } from "../sim/types";
import { parseValue } from "../units";
import { DEFAULT_FAMILY, DIGITAL_META, LOGIC_FAMILIES, analogGateMeta, type DigitalSymbolMeta, type LogicFamily } from "./digital_parts";

export interface DigitalComp {
  ref: string;
  symbolId: string;
  /** Attribute value with the symbol default applied. */
  attr: (key: string, dflt?: string) => string;
  /** Schematic pin name → net name (dangling pins carry the netlister's N_dangling_ name). */
  pinNet: Record<string, string>;
  optionalPins: Set<string>;
}

const DANGLING = /^N_dangling_/;
const DAC_BITS = ["D0", "D1", "D2", "D3"];
const ADC_LEVELS = 15;

export function familyOf(comp: DigitalComp): { name: string; f: LogicFamily } {
  if (meta(comp)?.kind && comp.symbolId.startsWith("gate_")) {
    // An analog-family gate switched to Digital: its rail picks the family.
    const vhi = parseValue(comp.attr("vhi", "5"));
    const name = Number.isFinite(vhi) && Math.abs(vhi - 3.3) < 0.6 ? "3.3 V CMOS" : DEFAULT_FAMILY;
    return { name, f: LOGIC_FAMILIES[name] };
  }
  const name = comp.attr("family", DEFAULT_FAMILY);
  return LOGIC_FAMILIES[name] ? { name, f: LOGIC_FAMILIES[name] } : { name: DEFAULT_FAMILY, f: LOGIC_FAMILIES[DEFAULT_FAMILY] };
}

function meta(comp: DigitalComp): DigitalSymbolMeta | null {
  return DIGITAL_META[comp.symbolId] ?? analogGateMeta(comp.symbolId);
}

/** A time attribute in seconds, or the default with a warning when it does not parse. */
function timeAttr(comp: DigitalComp, key: string, dflt: string, errors: SimError[], positive = false): number {
  const raw = comp.attr(key, dflt);
  const v = parseValue(raw);
  if (!Number.isFinite(v) || v < 0 || (positive && v <= 0)) {
    errors.push({ severity: "warning", message: `${comp.ref}: "${raw}" is not a valid ${key === "delay" ? "delay" : key}; using ${dflt}s.`, location: comp.ref });
    return parseValue(dflt);
  }
  return v;
}

export function buildDigitalDesign(comps: DigitalComp[], analogNodes: Set<string>, errors: SimError[]): { design: DigitalDesign; elements: NetlistElement[] } {
  const nets: DigitalNetSpec[] = [];
  const declared = new Set<string>();
  const declare = (name: string, host = false) => { if (!declared.has(name)) { declared.add(name); nets.push(host ? { name, host } : { name }); } };
  const netOf: Record<string, string> = {};
  const elements: NetlistElement[] = [];
  const parts: DigitalPartSpec[] = [];
  const a2d: A2DBridge[] = [];
  const analyzers: AnalyzerSpec[] = [];
  const displays: DisplaySpec[] = [];

  // ── which nets are mixed ──
  const analogPinNets = new Set<string>();
  for (const c of comps) {
    const m = meta(c);
    if (!m) continue;
    for (const [pin, pm] of Object.entries(m.pins)) if (pm.analog && c.pinNet[pin] && !DANGLING.test(c.pinNet[pin])) analogPinNets.add(c.pinNet[pin]);
  }
  const isMixed = (net: string) => net === "0" || analogNodes.has(net) || analogPinNets.has(net);

  // ── drivers per digital net, for the diagnostics below ──
  const driversOn = new Map<string, { ref: string; tri: boolean }[]>();
  const readersOn = new Map<string, string[]>();

  // ── A2D bridges, one per (net, thresholds) ──
  const bridgeKey = new Map<string, string>();
  let a2dCount = 0;
  const bridge = (net: string, vhi: number, vlo: number): string => {
    const key = `${net}|${vhi}|${vlo}`;
    const have = bridgeKey.get(key);
    if (have) return have;
    const n = [...bridgeKey.keys()].filter((k) => k.startsWith(`${net}|`)).length;
    const sig = n === 0 ? `${net}~in` : `${net}~in${n + 1}`;
    bridgeKey.set(key, sig);
    declare(sig, true);
    netOf[sig] = net;
    a2d.push({ name: `A2D${++a2dCount}`, node: net, ref: "0", vhi, vlo, signal: sig });
    return sig;
  };

  /** Signal an input pin reads, or null when it is unconnected. */
  const inputSignal = (c: DigitalComp, pin: string, fam: LogicFamily, schmitt = false): string | null => {
    const net = c.pinNet[pin];
    if (!net || DANGLING.test(net)) return null;
    if (isMixed(net)) return schmitt ? bridge(net, fam.vtPlus, fam.vtMinus) : bridge(net, fam.vhi, fam.vlo);
    declare(net);
    (readersOn.get(net) ?? readersOn.set(net, []).get(net)!).push(`${c.ref}.${pin}`);
    return net;
  };
  /** Signal an output pin drives (adding its D2A on a mixed net), or null when unconnected. */
  const outputSignal = (c: DigitalComp, pin: string, fam: LogicFamily, tri = false): string | null => {
    const net = c.pinNet[pin];
    if (!net || DANGLING.test(net)) return null;
    if (!isMixed(net)) {
      declare(net);
      (driversOn.get(net) ?? driversOn.set(net, []).get(net)!).push({ ref: c.ref, tri });
      return net;
    }
    const sig = `${c.ref}.${pin}`;
    declare(sig);
    netOf[sig] = net;
    elements.push({
      type: "D2A", name: `${c.ref}.${pin}`, n1: net, n2: "0", bits: [sig],
      v0: fam.vol, vstep: fam.voh - fam.vol, vundef: (fam.vol + fam.voh) / 2,
      rout: fam.rout, roff: 1e9, tr: fam.tr, tf: fam.tf,
    });
    return sig;
  };

  for (const c of comps) {
    const m = meta(c);
    if (!m) continue;
    const { f: fam } = familyOf(c);
    const schmitt = c.symbolId === "logic_schmitt";
    // Required inputs left open are reported; optional ones (enables, preset, clear) are not.
    for (const [pin, pm] of Object.entries(m.pins)) {
      const net = c.pinNet[pin];
      if (pm.dir === "in" && (!net || DANGLING.test(net)) && !c.optionalPins.has(pin) && m.kind !== "analyzer" && m.kind !== "seg7") {
        errors.push({ severity: "warning", message: `Pin "${pin}" of ${c.ref} is not connected; it reads X (unknown).`, location: c.ref });
      }
    }

    if (m.kind === "analyzer") {
      const channels: AnalyzerSpec["channels"] = [];
      for (let i = 0; i < 8; i++) {
        const pin = `CH${i}`;
        const sig = inputSignal(c, pin, fam);
        if (sig) channels.push({ label: c.pinNet[pin], signal: sig });
      }
      analyzers.push({ name: c.ref, channels });
      continue;
    }
    if (m.kind === "seg7") {
      const segs = ["a", "b", "c", "d", "e", "f", "g", "dp"].map((p) => inputSignal(c, p, fam));
      displays.push({ name: c.ref, kind: "seg7", segs });
      continue;
    }
    if (m.kind === "dac") {
      const bits = DAC_BITS.map((pin) => {
        const s = inputSignal(c, pin, fam);
        if (s) return s;
        // An unconnected bit is a 0, held by a constant so the D2A always has a value to read.
        const nc = `${c.ref}.${pin}.open`;
        declare(nc);
        parts.push({ kind: "const", name: `${c.ref}.${pin}.tie`, ref: c.ref, ins: {}, outs: { Y: nc }, params: { value: 0 } });
        return nc;
      });
      const out = c.pinNet.VOUT;
      const fs = parseValue(c.attr("fullscale", "5"));
      const settle = timeAttr(c, "settle", "100n", errors, true);
      const rout = parseValue(c.attr("rout", "1"));
      if (out && !DANGLING.test(out)) {
        const full = Number.isFinite(fs) && fs > 0 ? fs : 5;
        elements.push({
          type: "D2A", name: `${c.ref}.VOUT`, n1: out, n2: "0", bits,
          v0: 0, vstep: full / 16, vundef: full / 2,
          rout: Number.isFinite(rout) && rout > 0 ? rout : 1, roff: 1e9, tr: settle, tf: settle,
        });
      } else errors.push({ severity: "warning", message: `${c.ref}: the DAC output is not connected.`, location: c.ref });
      continue;
    }
    if (m.kind === "adc") {
      const vin = c.pinNet.VIN;
      const fs = parseValue(c.attr("fullscale", "5"));
      const full = Number.isFinite(fs) && fs > 0 ? fs : 5;
      const lsb = full / 16;
      const ins: Record<string, string | null> = {};
      for (let k = 1; k <= ADC_LEVELS; k++) {
        if (!vin || DANGLING.test(vin)) { ins[`C${k}`] = null; continue; }
        // An ideal quantiser: code = floor(VIN / LSB), transitions exactly at k·LSB. The band of
        // ±0.1 % LSB is only there so a slow input cannot chatter across a transition.
        ins[`C${k}`] = bridge(vin, k * lsb + lsb * 1e-3, k * lsb - lsb * 1e-3);
      }
      ins.CLK = inputSignal(c, "CLK", fam);
      const outs: Record<string, string | null> = {};
      DAC_BITS.forEach((pin, i) => { outs[`Q${i}`] = outputSignal(c, pin, fam); });
      parts.push({ kind: "adcenc", name: c.ref, ref: c.ref, ins, outs, params: { delay: timeAttr(c, "delay", "10n", errors) } });
      continue;
    }

    const ins: Record<string, string | null> = {};
    const outs: Record<string, string | null> = {};
    const tri = m.kind === "tribuf";
    for (const [pin, pm] of Object.entries(m.pins)) {
      if (pm.dir === "in") ins[pm.port] = inputSignal(c, pin, fam, schmitt);
      else outs[pm.port] = outputSignal(c, pin, fam, tri);
    }
    const params: Record<string, number | string | boolean> = {};
    switch (m.kind) {
      case "clock": {
        const f = parseValue(c.attr("freq", "1k"));
        const freq = Number.isFinite(f) && f > 0 ? f : 1e3;
        if (!(Number.isFinite(f) && f > 0)) errors.push({ severity: "warning", message: `${c.ref}: "${c.attr("freq", "1k")}" is not a frequency; using 1 kHz.`, location: c.ref });
        const dutyRaw = parseValue(c.attr("duty", "50").replace("%", ""));
        const duty = Number.isFinite(dutyRaw) && dutyRaw > 0 && dutyRaw < 100 ? dutyRaw / 100 : 0.5;
        const period = 1 / freq;
        // The clock starts low; its first rising edge comes one low phase after the delay, so
        // every edge (including the first) is a real edge and nothing is clocked at t = 0.
        params.period = period;
        params.duty = duty;
        params.offset = timeAttr(c, "delay", "0", errors) + (1 - duty) * period;
        break;
      }
      case "pattern": {
        params.bits = c.attr("bits", "01101001");
        params.step = timeAttr(c, "step", "1m", errors, true);
        params.repeat = /^no$/i.test(c.attr("repeat", "Yes")) ? "false" : "true";
        params.offset = timeAttr(c, "delay", "0", errors);
        break;
      }
      case "const": params.value = c.symbolId === "logic_high" ? 1 : 0; break;
      default: {
        params.delay = timeAttr(c, "delay", "10n", errors);
        if (m.params?.init) {
          const init = c.attr("init", "0").toLowerCase();
          params.init = init === "1" ? "1" : init === "x" ? "x" : "0";
        }
        if (m.params?.edge) params.edge = /^falling$/i.test(c.attr("edge", "Rising")) ? "falling" : "rising";
        if (m.kind === "counter") {
          const mod = parseValue(c.attr("modulus", "16"));
          params.modulus = Number.isFinite(mod) && mod >= 2 && mod <= 16 ? Math.round(mod) : 16;
          if (!(Number.isFinite(mod) && mod >= 2 && mod <= 16)) errors.push({ severity: "warning", message: `${c.ref}: count must be 2 to 16; using 16.`, location: c.ref });
        }
        if (m.kind === "decoder") params.activeLow = /low/i.test(c.attr("outputs", "Active high")) ? "true" : "false";
        if (m.kind === "tribuf") params.activeLow = /low/i.test(c.attr("enable", "Active high")) ? "true" : "false";
      }
    }
    parts.push({ kind: m.kind, name: c.ref, ref: c.ref, ins, outs, params });
  }

  // ── diagnostics on digital nets ──
  for (const [net, readers] of readersOn) {
    if (!driversOn.has(net)) errors.push({ severity: "warning", message: `Digital net ${net} has no driver, so ${readers.join(", ")} read${readers.length === 1 ? "s" : ""} Z (unknown).`, location: readers[0].split(".")[0] });
  }
  for (const [net, drv] of driversOn) {
    const hard = drv.filter((d) => !d.tri);
    if (hard.length > 1) errors.push({ severity: "warning", message: `Digital net ${net} is driven by ${hard.map((d) => d.ref).join(" and ")}; where they disagree it reads X. Use tri-state buffers for a shared bus.`, location: hard[0].ref });
  }

  return {
    design: {
      nets, parts, a2d,
      ...(analyzers.length ? { analyzers } : {}),
      ...(displays.length ? { displays } : {}),
      ...(Object.keys(netOf).length ? { netOf } : {}),
    },
    elements,
  };
}

/** Every node an analog element references (ground included). */
export function analogNodesOf(elements: NetlistElement[]): Set<string> {
  const s = new Set<string>();
  for (const el of elements) {
    const e = el as unknown as Record<string, unknown>;
    for (const k of ["n1", "n2", "n3", "n4", "nA", "nK", "nc1", "nc2", "nOut", "nInP", "nInN", "nD", "nG", "nS", "nB", "nC", "nE"]) {
      const v = e[k];
      if (typeof v === "string") s.add(v);
    }
    if (el.type === "X") for (const n of el.nodes) s.add(n);
  }
  return s;
}
