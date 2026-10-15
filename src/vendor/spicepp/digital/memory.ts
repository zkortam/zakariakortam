/**
 * Multi-port memory with the exact semantics of Yosys's `$mem_v2` simulation model (simlib.v):
 * one process, re-run on any port change, that in order
 *   1. latches clocked read ports on their active edge (old contents; then per-bit
 *      transparency / collision-X against same-cycle writes to the same address),
 *   2. performs every active write, ports in index order (a later port wins a collision),
 *   3. updates asynchronous read ports (they see this cycle's writes),
 *   4. applies read-port sync reset on the edge, then async reset (level).
 * Reads of an out-of-range or unknown address give X; writes to one are dropped; a write-enable
 * or read-enable bit that is not 1 does nothing (Verilog `if (x)` takes the else branch).
 * Loose `$memrd` / `$memwr` / `$meminit` cells sharing a MEMID are assembled into this same model.
 */

import type { CellDef, DelaySpec, Kernel, Cell } from "./kernel";
import { LX, codesToBig } from "./logic";

export interface MemReadPort {
  clkEnable: boolean;
  clkPolarity: boolean;
  clk: number;
  en: number;
  arst: number;
  srst: number;
  addr: number[];
  data: number[];
  /** Per write port: read returns the data being written this cycle (transparent). */
  transparent: boolean[];
  /** Per write port: a same-address write this cycle makes the read X. */
  collisionX: boolean[];
  arstValue: Uint8Array;
  srstValue: Uint8Array;
  initValue: Uint8Array;
  ceOverSrst: boolean;
}

export interface MemWritePort {
  clkEnable: boolean;
  clkPolarity: boolean;
  clk: number;
  /** One enable bit per data bit. */
  en: number[];
  addr: number[];
  data: number[];
}

export interface MemSpec {
  name: string;
  src?: string;
  type: string;
  size: number;
  offset: number;
  width: number;
  /** size * width initial codes, word 0 first. */
  init: Uint8Array;
  rd: MemReadPort[];
  wr: MemWritePort[];
  delay?: DelaySpec;
}

export function memoryCell(m: MemSpec): CellDef {
  const W = m.width;
  const inputs: Record<string, number[]> = {
    RD_CLK: m.rd.map(p => p.clk), RD_EN: m.rd.map(p => p.en), RD_ARST: m.rd.map(p => p.arst), RD_SRST: m.rd.map(p => p.srst),
    RD_ADDR: m.rd.flatMap(p => p.addr),
    WR_CLK: m.wr.map(p => p.clk), WR_EN: m.wr.flatMap(p => p.en), WR_ADDR: m.wr.flatMap(p => p.addr), WR_DATA: m.wr.flatMap(p => p.data),
  };
  const sequential = m.rd.some(p => p.clkEnable) || m.wr.length > 0;
  return {
    type: m.type, name: m.name, src: m.src, inputs, sequential,
    outputs: { RD_DATA: { nets: m.rd.flatMap(p => p.data), delay: m.delay } },
    create: () => {
      const mem = m.init.slice();
      const lastRd = new Uint8Array(m.rd.length).fill(LX), lastWr = new Uint8Array(m.wr.length).fill(LX);
      const data = new Uint8Array(m.rd.length * W);
      m.rd.forEach((p, i) => data.set(p.clkEnable ? p.initValue : new Uint8Array(W).fill(LX), i * W));
      const rdAddrOff: number[] = [], wrAddrOff: number[] = [];
      let o = 0; for (const p of m.rd) { rdAddrOff.push(o); o += p.addr.length; }
      o = 0; for (const p of m.wr) { wrAddrOff.push(o); o += p.addr.length; }
      let ins: Uint8Array[] = [];
      const idxOf = (addr: Uint8Array, off: number, len: number): number => {
        const a = codesToBig(addr, off, len);
        if (a === null) return -1;
        const i = a - BigInt(m.offset);
        return i < 0n || i >= BigInt(m.size) ? -1 : Number(i);
      };
      const active = (en: boolean, pol: boolean, last: number, cur: number) => !en || (pol ? last === 0 && cur === 1 : last === 1 && cur === 0);
      return (k: Kernel, c: Cell) => {
        ins = c.ins.map(n => k.read(n));
        const [rdClk, rdEn, rdArst, rdSrst, rdAddr, wrClk, wrEn, wrAddr, wrData] = ins;
        if (c.first) { lastRd.set(rdClk); lastWr.set(wrClk); }
        const wrActive = m.wr.map((p, j) => active(p.clkEnable, p.clkPolarity, lastWr[j], wrClk[j]));
        const wrIdx = m.wr.map((p, j) => idxOf(wrAddr, wrAddrOff[j], p.addr.length));
        const rdIdx = m.rd.map((p, i) => idxOf(rdAddr, rdAddrOff[i], p.addr.length));
        const rdActive = m.rd.map((p, i) => active(p.clkEnable, p.clkPolarity, lastRd[i], rdClk[i]));
        const readWord = (i: number, idx: number) => { if (idx < 0) data.fill(LX, i * W, i * W + W); else data.set(mem.subarray(idx * W, idx * W + W), i * W); };
        // 1. clocked reads (old data), then transparency / collision against this cycle's writes
        m.rd.forEach((p, i) => {
          if (!p.clkEnable || rdEn[i] !== 1 || !rdActive[i]) return;
          readWord(i, rdIdx[i]);
          m.wr.forEach((_, j) => {
            if (!wrActive[j] || rdIdx[i] < 0 || rdIdx[i] !== wrIdx[j]) return;
            for (let b = 0; b < W; b++) if (wrEn[j * W + b] === 1) {
              if (p.transparent[j]) data[i * W + b] = wrData[j * W + b];
              if (p.collisionX[j]) data[i * W + b] = LX;
            }
          });
        });
        // 2. writes
        m.wr.forEach((_, j) => {
          if (!wrActive[j] || wrIdx[j] < 0) return;
          const base = wrIdx[j] * W;
          for (let b = 0; b < W; b++) if (wrEn[j * W + b] === 1) mem[base + b] = wrData[j * W + b];
        });
        // 3. asynchronous reads
        m.rd.forEach((p, i) => { if (!p.clkEnable) readWord(i, rdIdx[i]); });
        // 4. resets
        m.rd.forEach((p, i) => {
          if (rdSrst[i] === 1 && rdActive[i] && p.clkEnable && (rdEn[i] === 1 || !p.ceOverSrst)) data.set(p.srstValue, i * W);
          if (rdArst[i] === 1) data.set(p.arstValue, i * W);
        });
        lastRd.set(rdClk); lastWr.set(wrClk);
        k.drive(c.outs[0], data);
      };
    },
  };
}
