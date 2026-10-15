/**
 * Structured errors. Every failure the kernel or the netlist loader can report carries a
 * stable `code` and a plain-data `details` object, so a UI or an agent can act on it without
 * parsing the message.
 */

export type DigitalErrorCode =
  | "delta-overflow"   // a time step needed more delta cycles than allowed: zero-delay loop or oscillation
  | "time-overflow"    // a time beyond Number.MAX_SAFE_INTEGER femtoseconds
  | "past-time"        // something was scheduled before the current time (the kernel never rolls back)
  | "bad-time"         // a time or delay that is not a non-negative integer
  | "unknown-cell"     // a netlist cell type the kernel does not implement
  | "bad-netlist"      // malformed or inconsistent netlist
  | "unknown-signal"   // a name that is not a signal of this design
  | "not-an-input"     // setInput on a signal nothing outside the design may drive
  | "bad-value"        // a value that does not fit the signal
  | "halted";          // the simulator stopped on an earlier error

export class DigitalSimError extends Error {
  readonly code: DigitalErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(code: DigitalErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "DigitalSimError";
    this.code = code;
    this.details = details;
  }
}
