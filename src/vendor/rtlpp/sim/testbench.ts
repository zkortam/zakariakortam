/**
 * Running a self-checking testbench and reading its verdict.
 *
 * A testbench runs as one of two root modules. The other is a small generated harness that dumps
 * every signal under the testbench and prints the end time from a `final` block. The harness file
 * comes last and sets `timescale 1fs/1fs`, which makes femtoseconds the simulation precision: every
 * time Icarus prints ($fatal, $error, the VCD) is then already in femtoseconds, with no rounding of
 * any user delay (user modules keep their own units).
 *
 * Verdict rules, in order:
 *   - compile errors: the test could not run ("error"), with diagnostics for the editor;
 *   - $fatal, $error, a failed immediate assertion, or a run-time error message: failed at the time
 *     Icarus reports, with the message and the source line;
 *   - a line that starts with FAIL or reads "TEST FAILED": failed, without a time;
 *   - a non-zero exit code with none of the above: failed;
 *   - otherwise the simulation ended by $finish, $stop or running out of events: passed.
 */
import type { VcdData } from "./vcd";

export const HARNESS_MODULE = "rtlpp_harness";
export const HARNESS_FILE = "rtlpp_harness.v";
export const VCD_FILE = "rtlpp.vcd";

const IDENT = /^[A-Za-z_][A-Za-z0-9_$]*$/;

/** The harness root for testbench `tb`. */
export function harnessSource(tb: string): string {
  if (!IDENT.test(tb)) throw new Error(`Testbench name must be a plain identifier: ${JSON.stringify(tb)}`);
  return [
    "// RTL++ simulation harness (generated). Dumps the testbench and reports the end time.",
    "`timescale 1fs/1fs",
    `module ${HARNESS_MODULE};`,
    "  initial begin",
    `    $dumpfile("${VCD_FILE}");`,
    `    $dumpvars(0, ${tb});`,
    "  end",
    '  final $display("@@RTLPP_END %0d", $time);',
    "endmodule",
    "",
  ].join("\n");
}

/** The prefix a stamped display line starts with: "@@T<fs>|". */
export const STAMP = /^@@T(\d+)\|/;

/**
 * A testbench's text with every `$display`, `$strobe` and `$monitor` stamped with the simulation
 * time: `$display("x %d", x)` becomes `$display("@@T%0t|", $realtime, "x %d", x)`, so each printed
 * line starts with the time it was printed at, in femtoseconds (the harness's precision). Comments
 * and strings are left alone, and line numbers do not move. The transcript reads the stamps and
 * shows the lines without them.
 */
export function stampDisplays(text: string): string {
  let out = "";
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "/") {
      const e = text.indexOf("\n", i);
      const end = e < 0 ? n : e;
      out += text.slice(i, end);
      i = end;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      const e = text.indexOf("*/", i + 2);
      const end = e < 0 ? n : e + 2;
      out += text.slice(i, end);
      i = end;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      while (j < n && text[j] !== '"' && text[j] !== "\n") j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === "$") {
      const m = /^\$(display|strobe|monitor)\b\s*(\(\s*\)|\()?/.exec(text.slice(i, i + 24));
      if (m && !/[\w$]/.test(text[i - 1] ?? "")) {
        const task = `$${m[1]}`;
        if (!m[2] || /^\(\s*\)$/.test(m[2])) out += `${task}("@@T%0t|", $realtime)`;
        else out += `${task}("@@T%0t|", $realtime, `;
        i += m[0].length;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

/** A printed line without its time stamp, and the stamp in femtoseconds when it had one. */
export function unstamp(line: string): { text: string; atFs?: number } {
  const m = STAMP.exec(line);
  return m ? { text: line.slice(m[0].length), atFs: Number(m[1]) } : { text: line };
}

export interface SourcePoint {
  file: string;
  line: number;
}

export interface TbFailure {
  kind: "fatal" | "error" | "assertion" | "text" | "exit";
  message: string;
  atFs?: number;
  source?: SourcePoint;
}

export interface TbDiagnostic {
  severity: "error" | "warning";
  file: string;
  line: number;
  message: string;
}

export interface IcarusVerdict {
  /** The first failure, or null when the test passed. */
  failure: TbFailure | null;
  failures: TbFailure[];
  /** From the harness's final block: when the simulation ended. */
  endFs: number | null;
  /** Compiler errors and warnings with locations. */
  diagnostics: TbDiagnostic[];
}

const SEVERITY_LINE = /^(FATAL|ERROR|WARNING|INFO): (?:([^:\s][^:]*):(\d+): ?)?(.*)$/;
const TIME_LINE = /^\s+Time: (\d+)\s+Scope: (.*)$/;
const COMPILE_LINE = /^([^:\s][^:]*):(\d+): (error|warning|sorry): (.*)$/;

/** Read Icarus output (compiler and vvp, stdout then stderr) into a verdict. */
export function parseIcarusOutput(text: string, exitCode: number): IcarusVerdict {
  const failures: TbFailure[] = [];
  const diagnostics: TbDiagnostic[] = [];
  let endFs: number | null = null;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, "");
    const end = /^@@RTLPP_END (\d+)$/.exec(line);
    if (end) { endFs = Number(end[1]); continue; }
    const c = COMPILE_LINE.exec(line);
    if (c) {
      diagnostics.push({ severity: c[3] === "warning" ? "warning" : "error", file: c[1], line: Number(c[2]), message: c[3] === "sorry" ? `Not supported by Icarus: ${c[4]}` : c[4] });
      continue;
    }
    const s = SEVERITY_LINE.exec(line);
    if (s) {
      if (s[1] === "WARNING" || s[1] === "INFO") continue;
      const next = TIME_LINE.exec(lines[i + 1] ?? "");
      const source = s[2] ? { file: s[2], line: Number(s[3]) } : undefined;
      const body = s[4].trim();
      const kind: TbFailure["kind"] = s[1] === "FATAL" ? "fatal" : body === "" ? "assertion" : "error";
      failures.push({
        kind,
        message: body || (source ? `Assertion failed at ${source.file}:${source.line}` : "Assertion failed"),
        ...(next ? { atFs: Number(next[1]) } : {}),
        ...(source ? { source } : {}),
      });
      if (next) i++;
      continue;
    }
    if (/^\s*FAIL(ED)?\b/.test(line) || /\bTEST FAILED\b/i.test(line)) failures.push({ kind: "text", message: line.trim() });
  }
  if (failures.length === 0 && exitCode !== 0 && diagnostics.every((d) => d.severity !== "error")) {
    failures.push({ kind: "exit", message: `The simulation exited with code ${exitCode}.` });
  }
  return { failure: failures[0] ?? null, failures, endFs, diagnostics };
}

/** First compile error as one sentence, for a test that could not run. */
export function compileFailureMessage(diags: TbDiagnostic[], fallback: string): string {
  const e = diags.find((d) => d.severity === "error");
  return e ? `${e.file}:${e.line}: ${e.message}` : fallback.trim().split("\n").filter(Boolean).slice(-1)[0] ?? "Icarus could not compile the design.";
}

/**
 * The parameter values an instance ran with, as `read_slang -G` arguments: 32-bit values as signed
 * decimals (how an unsized literal override reads), other widths as sized binary literals.
 * Localparams are included harmlessly: slang ignores -G for names that cannot be overridden.
 */
export function parameterOverrides(vcd: VcdData, instancePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of vcd.parameters) {
    if (p.scope !== instancePath || !IDENT.test(p.name)) continue;
    const v = p.value;
    if (/^[01]+$/.test(v) && v.length === 32) out[p.name] = String(BigInt.asIntN(32, BigInt(`0b${v}`)));
    else if (/^[01]+$/.test(v)) out[p.name] = `${v.length}'b${v}`;
    // Parameters with unknown bits cannot be expressed as an override; leave them at their default.
  }
  return out;
}
