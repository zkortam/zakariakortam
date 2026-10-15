/**
 * Digital logic simulator shared by Spice++ and RTL++.
 *
 * Self-contained: no React, no DOM, no runtime dependencies, safe inside a Web Worker.
 *
 * Build a design from parts or load a Yosys netlist, then drive it:
 *
 *   const b = new CircuitBuilder();
 *   const a = b.input("a"), c = b.input("c"), y = b.output("y");
 *   b.nand([a, c], y, { rise: 120 * PS, fall: 90 * PS });
 *   const sim = createSimulator(b);
 *   sim.setInput("a", 1); sim.setInput("c", 1, 5 * NS);
 *   sim.run(10 * NS);
 *   sim.get("y").toString();                 // "0"
 *   sim.getTrace("y");                        // { times: [0, 5000120], values: [x→1 ..., 0] }
 *
 *   const rtl = createSimulator(yosysJson, { initRegisters: "zero" });   // `write_json` output
 *
 * Time is integer femtoseconds (exact to 2^53 - 1 fs ≈ 9.007 s); use the FS…S constants.
 *
 * Mixed-signal hosts step the kernel from their own loop and never need it to roll back:
 *   const t = sim.nextEventTime();            // earliest pending digital activity, or null
 *   sim.advanceTo(tAccepted);                 // after the analog step to tAccepted is accepted
 *   sim.setInput("cmp_out", 1, tCross);       // a threshold crossing at tCross >= sim.now
 *   sim.onChange("dac_bit", (v, t) => ...);   // settled digital edges for the analog side
 *
 * Causality for "why this value": every recorded change carries the cell that caused it.
 *   sim.changeAt(net, t)   → { time, value, cause: { id, name, type, src } }
 *   sim.driversOf("q")     → the cells driving each bit
 *   sim.cellPorts(id)      → the nets on each port, to read the inputs with valueAt / valueBefore
 *
 * Determinism: equal-time events apply in scheduling order, and each delta cycle evaluates the
 * affected cells once, in netlist order, so a given design and stimulus always produce the same
 * event sequence (see kernel.ts).
 */

import { DigitalSimError } from "./errors";
import { Kernel, type KernelOptions, type NetlistIR } from "./kernel";
import { CircuitBuilder } from "./primitives";
import { loadYosys, type YosysJson, type YosysLoadOptions } from "./yosys";

export { Kernel as DigitalSimulator, Kernel, Cell, OutPort } from "./kernel";
export type {
  CellDef, CellEval, CellInfo, DelaySpec, DriverInfo, KernelOptions, KernelStats, NetChange, NetlistIR, OutputDef,
  SignalDef, SignalInfo, SignalKind, SignalRef, VectorTrace,
} from "./kernel";
export { CircuitBuilder, edgeOf, exact3 } from "./primitives";
export type { Edge, PartOptions, Sig } from "./primitives";
export { loadYosys } from "./yosys";
export type { YosysDesign, YosysJson, YosysLoadOptions, YosysModule, YosysCell } from "./yosys";
export { DigitalSimError } from "./errors";
export type { DigitalErrorCode } from "./errors";
export { LogicVec, Strength, L0, L1, LZ, LX, logicChar, toCodes } from "./logic";
export type { Logic, ValueLike } from "./logic";

export const FS = 1;
export const PS = 1e3;
export const NS = 1e6;
export const US = 1e9;
export const MS = 1e12;
export const S = 1e15;

/** Seconds to integer femtoseconds (rounded to the nearest fs). */
export function toFs(seconds: number): number {
  const v = Math.round(seconds * 1e15);
  if (!Number.isSafeInteger(v) || v < 0) throw new DigitalSimError("time-overflow", `${seconds} s is outside the kernel's exact time range (0 to 9.007 s)`, { seconds });
  return v;
}

export type SimulatorOptions = KernelOptions & YosysLoadOptions;

/**
 * Creates a simulator from a CircuitBuilder, a Yosys `write_json` netlist (object or JSON text)
 * or a prebuilt NetlistIR.
 */
export function createSimulator(design: CircuitBuilder | YosysJson | NetlistIR | string, opts: SimulatorOptions = {}): Kernel {
  let ir: NetlistIR;
  if (design instanceof CircuitBuilder) ir = design.build();
  else if (typeof design === "string" || "modules" in design) ir = loadYosys(design as YosysJson | string, opts);
  else if ("netCount" in design && "cells" in design) ir = design;
  else throw new DigitalSimError("bad-netlist", "createSimulator needs a CircuitBuilder, a Yosys JSON netlist or a NetlistIR");
  return new Kernel(ir, opts);
}
