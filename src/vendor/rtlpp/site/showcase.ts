/**
 * The run the RTL++ home page shows, recorded from the real engines by scripts/rtlpp_site_showcase.ts
 * into showcase.generated.ts. The page reads every number and sentence about the run from here, and
 * scripts/test_rtlpp_site.ts records a fresh run to check the stored one has not drifted.
 */

export interface ShowcaseRun {
  /** The outcome as the Tests rail words it, for example "Failed" or "Passed". */
  outcome: string;
  /** The testbench's own failure message. */
  message?: string;
  atFs?: number;
  /** The netlist replay that ran alongside Icarus. */
  crossCheck: { engine: string; status: string; samples: number; mismatches: number };
}

export interface ShowcaseLane {
  name: string;
  width: number;
  times: number[];
  values: string[];
}

export interface ShowcaseLine {
  line: number;
  text: string;
  note?: string;
  diverges?: boolean;
}

export interface ShowcaseStep {
  signal: string;
  value: string;
  expected?: string;
  diverges: boolean;
  timeFs: number;
  file: string | null;
  lines: ShowcaseLine[];
  inputs: { name: string; value: string }[];
  repeat?: { count: number; fromFs: number; fromValue: string };
}

export interface ShowcaseFsm {
  template: string;
  test: string;
  file: string;
  module: string;
  register: string;
  states: string[];
  /** "FROM>TO", sorted. */
  arcs: string[];
}

export interface ShowcaseBuild {
  template: string;
  board: string;
  device: string;
  seed: number;
  utilization: { resource: string; used: number; capacity: number }[];
  timing: { clock: string; fmaxMHz: number; targetMHz?: number; label: string }[];
  bitstreamName: string;
  bitstreamBytes: number;
  bitstreamSha256: string;
}

export interface Showcase {
  template: { id: string; name: string };
  file: string;
  test: string;
  change: { line: number; before: string; after: string };
  source: string;
  passing: ShowcaseRun;
  failing: ShowcaseRun;
  wave: { endFs: number; lanes: ShowcaseLane[] };
  why: {
    signal: string;
    atFs: number;
    value: string;
    expected: string;
    /** The first step where the value parts from the expected one, or null. */
    divergence: number | null;
    stop: string;
    steps: ShowcaseStep[];
  };
  /** The moment link's fragment for the failure. */
  moment: string;
  fsm: ShowcaseFsm;
  build: ShowcaseBuild;
}
