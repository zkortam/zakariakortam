/**
 * Structured checks: a testbench that includes rtlpp_check.svh writes each check as
 *
 *   `RTLPP_CHECK(received[0], 8'h4B) $fatal(1, "First byte is %h, expected 4b", received[0]);
 *
 * The macro is an ordinary `if` on `!==` (so x and z count as different), and when it fires it
 * prints one record line first:
 *
 *   @@RTLPP_CHECK <time fs> <width> <got, binary> <expected, binary> <line> <file> <expression>
 *
 * The record carries what a failure message only says in words: which expression, the value it
 * had, the value expected, when, and where. The Tests rail shows it, and Why starts from it
 * without anyone typing the expected value. The header is included inside the testbench module, so
 * its helper function belongs to that module and two testbenches never define it twice.
 *
 * lib/project/templates/include/rtlpp_check.svh holds the same text; test:rtlpp-engines checks
 * the two never drift.
 */

export const CHECK_HEADER = "rtlpp_check.svh";

export const CHECK_SVH = `// rtlpp_check.svh: structured checks for RTL++ testbenches.
//
// Include it inside a testbench module, then write each check as an if statement:
//
//   \`include "rtlpp_check.svh"
//   \`RTLPP_CHECK(received[0], 8'h4B) $fatal(1, "First byte is %h, expected 4b", received[0]);
//
// The statement after the macro runs when the two values differ (!==, so x and z count). RTL++
// records the checked expression, the value it had, the value expected, the time and the line,
// so the failure explains itself and Why starts from the right signal.
\`ifndef RTLPP_CHECK
\`define RTLPP_CHECK(GOT, EXP) if (((GOT) !== (EXP)) && rtlpp_check_note($bits(GOT), (GOT), (EXP), \`__FILE__, \`__LINE__, \`"GOT\`"))
\`endif
function automatic bit rtlpp_check_note(input int width, input logic [1023:0] got, input logic [1023:0] exp, input string file, input int line, input string expr);
  int w;
  string g, e;
  w = width < 1 ? 1 : width > 1024 ? 1024 : width;
  g = $sformatf("%b", got);
  e = $sformatf("%b", exp);
  $display("@@RTLPP_CHECK %0t %0d %s %s %0d %s %s", $realtime, w, g.substr(1024 - w, 1023), e.substr(1024 - w, 1023), line, file, expr);
  return 1'b1;
endfunction
`;

/** One check that did not hold. Values are MSB first, four-state, `width` characters long. */
export interface CheckRecord {
  /** The checked expression as the testbench wrote it: "received[0]", "led". */
  expr: string;
  width: number;
  got: string;
  expected: string;
  /** Femtoseconds. */
  atFs: number;
  file: string;
  line: number;
}

const RECORD = /^@@RTLPP_CHECK (\d+) (\d+) ([01xzXZ]+) ([01xzXZ]+) (\d+) (\S+) (.+)$/;

/** Every check record in the simulator's output, in order. */
export function parseChecks(text: string): CheckRecord[] {
  const out: CheckRecord[] = [];
  for (const raw of text.split("\n")) {
    const m = RECORD.exec(raw.replace(/\r$/, ""));
    if (!m) continue;
    const width = Number(m[2]);
    const fit = (v: string) => v.toLowerCase().slice(-width).padStart(width, "0");
    out.push({ atFs: Number(m[1]), width, got: fit(m[3]), expected: fit(m[4]), line: Number(m[5]), file: m[6], expr: m[7].trim() });
  }
  return out;
}

/** The output without check records and the harness's end line: what the transcript shows. */
export function withoutRecords(text: string): string {
  return text.split("\n").filter((l) => !/^@@RTLPP_(CHECK|END)\b/.test(l)).join("\n");
}

/** Whether a file includes the check header. */
export function includesChecks(text: string): boolean {
  return /`include\s+"rtlpp_check\.svh"/.test(text);
}
