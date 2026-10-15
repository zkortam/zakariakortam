/**
 * TestOutcome from apps/rtlpp/src/lib/engines/types.ts (zkortam/spiceplusplus), the union
 * format.ts words. The detail types it points at (SourceRange, Check, DisagreementCause) are
 * kept opaque here, since nothing on this site reads them.
 */
type SourceRange = unknown;
type Check = unknown;
type DisagreementCause = unknown;

export type TestOutcome =
  /** Icarus passed it and the netlist simulator agreed on every sample (rule 2). */
  | { status: "passed" }
  /**
   * Icarus passed it but the second engine could not check the run; `message` says why. Never
   * counted as a pass or as evidence.
   */
  | { status: "unconfirmed"; message: string }
  /** `checks`: the structured checks (rtlpp_check.svh) that did not hold, first first. */
  | { status: "failed"; atFs?: number; message: string; source?: SourceRange; checks?: Check[] }
  | { status: "stopped"; reason: "time-limit" | "data-limit" | "user"; atFs?: number }
  /** The two simulators disagree; never shown as a pass. */
  | { status: "disagree"; signal: string; atFs: number; message: string; cause?: DisagreementCause }
  | { status: "error"; message: string };
