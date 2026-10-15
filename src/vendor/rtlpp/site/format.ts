import type { TestOutcome } from "./outcome";

/** "12.3 µs", "840 ns": three significant figures, the unit that keeps the number above 1. */
export function formatTime(fs: number): string {
  const units: [number, string][] = [[1e15, "s"], [1e12, "ms"], [1e9, "µs"], [1e6, "ns"], [1e3, "ps"], [1, "fs"]];
  const [scale, unit] = units.find(([s]) => Math.abs(fs) >= s) ?? units[units.length - 1];
  return `${Number((fs / scale).toPrecision(3))} ${unit}`;
}

/** A test result in words, as the Tests rail shows it. */
export function describeOutcome(o: TestOutcome): string {
  switch (o.status) {
    case "passed": return "Passed";
    case "unconfirmed": return "Passed in Icarus only";
    case "failed": return o.atFs != null ? `Failed at ${formatTime(o.atFs)}` : "Failed";
    case "stopped": return o.reason === "time-limit" ? "Stopped at the time limit" : o.reason === "data-limit" ? "Stopped at the data limit" : "Stopped";
    case "disagree": return "Simulators disagree";
    case "error": return "Could not run";
  }
}

/** "77 MB": decimal megabytes, never shown as 0. */
export function formatMegabytes(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1e6)).toLocaleString("en-US")} MB`;
}
