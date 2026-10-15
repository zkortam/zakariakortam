/**
 * The shared runner under every YoWASP engine (Yosys, nextpnr, the iCE40 and ECP5 packers, clang).
 *
 * YoWASP tools take a nested file tree and a command line, run in a virtual filesystem, and return
 * the tree afterwards. This adapter turns that into the uniform {@link EngineJob} -> {@link EngineResult}
 * contract: bytes in, bytes out, an exit code instead of a throw, and the exact tool version.
 *
 * Nothing here touches Node or the DOM, so the same code runs in tests and in a Web Worker.
 */
import { EngineUnavailableError, type EngineJob, type EngineResult, type FileMap } from "../types";

export type YowaspTree = { [name: string]: YowaspTree | string | Uint8Array };

export interface YowaspRunOptions {
  stdin?: ((byteLength: number) => Uint8Array | null) | null;
  stdout?: ((bytes: Uint8Array | null) => void) | null;
  stderr?: ((bytes: Uint8Array | null) => void) | null;
  decodeASCII?: boolean;
  synchronously?: boolean;
  fetchProgress?: (event: { source: object; totalLength: number; doneLength: number }) => void;
}

export type YowaspCommand = (args?: string[] | null, files?: YowaspTree, options?: YowaspRunOptions) => Promise<YowaspTree> | YowaspTree | undefined;

/** Progress of a one-time resource download (chip databases, the clang sysroot). */
export interface FetchProgress {
  tool: string;
  doneBytes: number;
  totalBytes: number;
}

export interface RunOptions {
  /** Called while a tool downloads its resources the first time it runs. Silent when omitted. */
  onFetchProgress?: (p: FetchProgress) => void;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function toBytes(data: string | Uint8Array): Uint8Array {
  return typeof data === "string" ? encoder.encode(data) : data;
}

export function toText(data: string | Uint8Array | undefined): string {
  if (data === undefined) return "";
  return typeof data === "string" ? data : decoder.decode(data);
}

/** Yosys and nextpnr colour their logs even into a pipe. Results carry plain text. */
export function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

/** Normalize a virtual path: POSIX separators, no leading "./" or "/", no "..". */
export function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/\\/g, "/").split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") throw new Error(`Path escapes the project: ${path}`);
    parts.push(part);
  }
  if (parts.length === 0) throw new Error(`Empty path: "${path}"`);
  return parts.join("/");
}

export function fileMapToTree(files: FileMap): YowaspTree {
  const root: YowaspTree = {};
  for (const [rawPath, data] of Object.entries(files)) {
    const parts = normalizePath(rawPath).split("/");
    let dir = root;
    for (const name of parts.slice(0, -1)) {
      const next = dir[name];
      if (next === undefined) dir = dir[name] = {};
      else if (typeof next === "string" || next instanceof Uint8Array) throw new Error(`"${name}" is both a file and a directory in ${rawPath}`);
      else dir = next;
    }
    dir[parts[parts.length - 1]] = toBytes(data);
  }
  return root;
}

export function treeToFileMap(tree: YowaspTree, prefix = ""): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {};
  for (const [name, node] of Object.entries(tree)) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (typeof node === "string") out[path] = encoder.encode(node);
    else if (node instanceof Uint8Array) out[path] = node;
    else Object.assign(out, treeToFileMap(node, path));
  }
  return out;
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Files the tool created or changed: everything in `after` that is not byte-identical to an input. */
export function changedFiles(inputs: FileMap, after: Record<string, Uint8Array>): Record<string, Uint8Array> {
  const before = new Map(Object.entries(inputs).map(([p, d]) => [normalizePath(p), toBytes(d)]));
  const out: Record<string, Uint8Array> = {};
  for (const [path, data] of Object.entries(after)) {
    const prev = before.get(path);
    if (!prev || !bytesEqual(prev, data)) out[path] = data;
  }
  return out;
}

// A one-function module whose body is `try_table (catch*) end`: valid only with the exnref proposal.
const EXNREF_PROBE = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  0x01, 0x04, 0x01, 0x60, 0x00, 0x00,
  0x03, 0x02, 0x01, 0x00,
  0x0a, 0x08, 0x01, 0x06, 0x00, 0x1f, 0x40, 0x00, 0x0b, 0x0b,
]);

/** True when this runtime supports WebAssembly exception handling with exnref, which YoWASP builds need. */
export function hasWasmExnref(): boolean {
  try {
    return typeof WebAssembly === "object" && WebAssembly.validate(EXNREF_PROBE);
  } catch {
    return false;
  }
}

export function assertWasmExnref(): void {
  if (hasWasmExnref()) return;
  const node = typeof process === "object" && process.versions?.node;
  throw new EngineUnavailableError(
    node
      ? `This runtime lacks WebAssembly exnref (Node ${node}). Run Node with --experimental-wasm-exnref; it cannot be set through NODE_OPTIONS.`
      : "This browser lacks WebAssembly exception handling with exnref, which the synthesis and place-and-route engines need.",
  );
}

interface YowaspExit extends Error {
  code: number;
  files?: YowaspTree;
}

function isExit(e: unknown): e is YowaspExit {
  return e instanceof Error && typeof (e as YowaspExit).code === "number";
}

function collector(): { push: (b: Uint8Array | null) => void; text: () => string } {
  const chunks: Uint8Array[] = [];
  return {
    push: (b) => { if (b && b.length) chunks.push(new Uint8Array(b)); },
    text: () => {
      let n = 0;
      for (const c of chunks) n += c.length;
      const all = new Uint8Array(n);
      let at = 0;
      for (const c of chunks) { all.set(c, at); at += c.length; }
      return decoder.decode(all);
    },
  };
}

/** Exit code reported when the WebAssembly itself traps (out of memory, abort); the trap text goes to stderr. */
export const WASM_TRAP_EXIT = 134;

const prefetched = new WeakMap<YowaspCommand, Promise<void>>();

/**
 * Download and compile a tool's resources ahead of its first run. YoWASP caches them for the life of
 * the worker, so this resolves immediately afterwards.
 */
export function prefetchYowasp(command: YowaspCommand, tool: string, opts: RunOptions = {}): Promise<void> {
  assertWasmExnref();
  let p = prefetched.get(command);
  if (!p) {
    p = Promise.resolve(command(null, {}, {
      fetchProgress: ({ totalLength, doneLength }) => opts.onFetchProgress?.({ tool, doneBytes: doneLength, totalBytes: totalLength }),
    })).then(() => undefined);
    p.catch(() => prefetched.delete(command));
    prefetched.set(command, p);
  }
  return p;
}

/** Run one YoWASP command as a uniform engine job. Tool failures come back as a non-zero exit code. */
export async function runYowasp(command: YowaspCommand, tool: string, toolVersion: string, job: EngineJob, opts: RunOptions = {}): Promise<EngineResult> {
  await prefetchYowasp(command, tool, opts);
  const out = collector();
  const err = collector();
  const t0 = performance.now();
  let exitCode = 0;
  let tree: YowaspTree = {};
  try {
    tree = (await command(job.args, fileMapToTree(job.inputs), { stdout: out.push, stderr: err.push, decodeASCII: false })) ?? {};
  } catch (e) {
    if (isExit(e)) {
      exitCode = e.code;
      tree = e.files ?? {};
    } else {
      exitCode = WASM_TRAP_EXIT;
      err.push(encoder.encode(`\n${tool}: WebAssembly trap: ${(e as Error)?.message ?? String(e)}\n`));
    }
  }
  const durationMs = performance.now() - t0;
  return {
    exitCode,
    stdout: stripAnsi(out.text()),
    stderr: stripAnsi(err.text()),
    files: changedFiles(job.inputs, treeToFileMap(tree)),
    durationMs,
    toolVersion,
  };
}

/** Memoize an async probe (tool version strings are asked for once per worker). */
export function once<T>(fn: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null;
  return () => {
    if (!p) {
      p = fn();
      p.catch(() => { p = null; });
    }
    return p;
  };
}

/** Read an output file as text, or throw naming the job's stderr tail when it is missing. */
export function requireText(result: EngineResult, path: string, what: string): string {
  const data = result.files[path];
  if (!data) throw new Error(`${what}: ${path} was not produced (exit ${result.exitCode}). ${tail(result.stderr || result.stdout)}`);
  return decoder.decode(data);
}

export function tail(s: string, lines = 12): string {
  return s.trimEnd().split("\n").slice(-lines).join("\n");
}
