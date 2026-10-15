/**
 * Shared types for the RTL++ engine layer. Everything here is plain data so a job and its result can
 * cross a Web Worker boundary with structured clone, and so a job can be hashed into an evidence key.
 */

/** A virtual file tree, flattened: POSIX relative paths ("rtl/top.v") to contents. */
export type FileMap = Record<string, string | Uint8Array>;

/** The uniform engine job: input files plus a command line, exactly as the tool would see them. */
export interface EngineJob {
  inputs: FileMap;
  args: string[];
}

/** The uniform engine result. `files` holds only files the tool created or changed, always as bytes. */
export interface EngineResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  files: Record<string, Uint8Array>;
  durationMs: number;
  /** Upstream tool version plus the exact WebAssembly package, e.g. "Yosys 0.69+62 (git sha1 0edda7a3a) [@yowasp/yosys@0.70.62-dev.1236]". */
  toolVersion: string;
}

/** Tools the evidence layer knows about. A claim is accepted only from evidence produced by the right one. */
export type ToolKind =
  | "yosys"
  | "slang"
  | "nextpnr-ice40"
  | "nextpnr-ecp5"
  | "icepack"
  | "ecppack"
  | "icarus"
  | "cxxrtl"
  | "differential"
  | "sby"
  | "eqy";

export type FpgaFamily = "ice40" | "ecp5" | "gowin";

export type Ice40Part = "lp384" | "lp1k" | "lp4k" | "lp8k" | "hx1k" | "hx4k" | "hx8k" | "up3k" | "up5k" | "u1k" | "u2k" | "u4k";
export type Ecp5Part = "12k" | "25k" | "45k" | "85k" | "um-25k" | "um-45k" | "um-85k" | "um5g-25k" | "um5g-45k" | "um5g-85k";

/** A placeable device. Gowin is synthesis-only in this layer (its place and route needs nextpnr-himbaechel). */
export type Device =
  | { family: "ice40"; part: Ice40Part; package: string }
  | { family: "ecp5"; part: Ecp5Part; package: string; speed?: 6 | 7 | 8 };

export interface Diagnostic {
  severity: "error" | "warning";
  message: string;
  file?: string;
  line?: number;
  column?: number;
}

/** Thrown when an engine cannot run at all (missing WebAssembly feature, unsupported option). Tool failures are results, not throws. */
export class EngineUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineUnavailableError";
  }
}
