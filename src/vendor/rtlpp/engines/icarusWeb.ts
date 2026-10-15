/**
 * Icarus Verilog in a browser worker (and in Node, for tests), from the Emscripten builds inside
 * @veriflow/iverilog-wasm: ivlpp (preprocessor), ivl (compiler) and vvp (runtime).
 *
 * LICENSE BOUNDARY. Those builds are GPL-2.0-or-later. They are fetched at runtime as separate
 * files (never bundled with our code), run only inside the isolated Icarus worker, and are driven
 * only through command lines and files, like the native tools. This module is ours; load it only with
 * `await import(".../engines/icarusWeb")` from the Icarus worker. Corresponding source:
 * https://github.com/AlexMercer12138/iverilog at revision 75c777c993c2bbc6ffe7f9138f25a76e14db5325.
 *
 * The package's own JavaScript driver is Node-only, and its Emscripten loaders are built for Node
 * (`ENVIRONMENT_IS_NODE=true` is compiled in). The loader text is evaluated here with that one
 * constant set to false, which leaves Emscripten's environment-neutral paths, and the WebAssembly is
 * handed over through the documented `instantiateWasm` hook. Nothing else in the tools changes.
 *
 * Output files can be streamed: a path in `streams` becomes a character device in the virtual
 * filesystem, so the VCD reaches the caller while vvp is still running, and a run that is stopped
 * (time limit, data limit, Stop) still has everything written up to that point.
 */
import { normalizePath, toBytes } from "./runtime";

export type IcarusTool = "ivlpp" | "ivl" | "vvp";

/** Where the Emscripten loaders and WebAssembly come from (asset host in browsers, node_modules in tests). */
export interface IcarusAssets {
  loader(tool: IcarusTool): Promise<string>;
  wasm(tool: IcarusTool): Promise<Uint8Array>;
  /** Evaluate module text and return its namespace. */
  importText(source: string): Promise<{ default: EmscriptenFactory }>;
}

interface EmscriptenFS {
  mkdirTree(path: string): void;
  writeFile(path: string, data: string | Uint8Array): void;
  readFile(path: string): Uint8Array;
  chdir(path: string): void;
  analyzePath(path: string): { exists: boolean };
  makedev(major: number, minor: number): number;
  registerDevice(dev: number, ops: Record<string, unknown>): void;
  mkdev(path: string, dev: number): void;
}

interface EmscriptenModule {
  FS: EmscriptenFS;
  callMain(args: string[]): number;
}

type EmscriptenFactory = (opts: Record<string, unknown>) => Promise<EmscriptenModule>;

export const ICARUS_GENERATIONS = ["2005", "2005-sv", "2009", "2012", "2017", "2023"] as const;
export type IcarusGeneration = (typeof ICARUS_GENERATIONS)[number];

export interface IcarusWebJob {
  /** Project files by relative path (sources, includes, $readmem data). */
  files: Record<string, string | Uint8Array>;
  /** Sources in compile order. */
  sources: string[];
  /** Root modules (iverilog -s). At least one. */
  roots: string[];
  generation?: IcarusGeneration;
  defines?: Record<string, string | boolean>;
  includeDirs?: string[];
  plusargs?: string[];
  /** Files vvp writes (relative to the project) that are streamed to a callback instead of stored. */
  streams?: Record<string, (chunk: Uint8Array) => void>;
  /** Called with each line vvp prints, as it prints it. */
  onLine?: (line: string, stream: "stdout" | "stderr") => void;
  /**
   * Polled whenever the simulator writes output. Returning a reason stops the run there; the
   * result then carries `stopped`. (A run that never writes is stopped by terminating its worker.)
   */
  shouldStop?: () => string | null;
}

export interface IcarusWebResult {
  /** The stage that failed, or "run". */
  stage: "preprocess" | "compile" | "run";
  exitCode: number;
  stdout: string;
  stderr: string;
  /** Why the run was cut short, when it was. */
  stopped?: string;
  timings: { preprocessMs: number; compileMs: number; runMs: number };
}

class StopRun extends Error {
  constructor(readonly reason: string) {
    super(`stopped: ${reason}`);
    this.name = "StopRun";
  }
}

const NODE_FLAG = "var ENVIRONMENT_IS_NODE=true;";

/** The loader text with the compiled-in Node switch turned off. Throws on a build it does not recognise. */
export function patchIcarusLoader(text: string, tool: IcarusTool): string {
  const at = text.indexOf(NODE_FLAG);
  if (at < 0 || text.indexOf(NODE_FLAG, at + 1) >= 0) throw new Error(`Unrecognised Icarus ${tool} loader: expected one "${NODE_FLAG}"`);
  return text.replace(NODE_FLAG, "var ENVIRONMENT_IS_NODE=false;");
}

interface LoadedTool { factory: EmscriptenFactory; module: WebAssembly.Module }

const cache = new WeakMap<IcarusAssets, Map<IcarusTool, Promise<LoadedTool>>>();

function loadTool(assets: IcarusAssets, tool: IcarusTool): Promise<LoadedTool> {
  let m = cache.get(assets);
  if (!m) { m = new Map(); cache.set(assets, m); }
  let p = m.get(tool);
  if (!p) {
    p = (async () => {
      const [text, bytes] = await Promise.all([assets.loader(tool), assets.wasm(tool)]);
      const ns = await assets.importText(patchIcarusLoader(text, tool));
      if (typeof ns.default !== "function") throw new Error(`Icarus ${tool} loader has no default export`);
      return { factory: ns.default, module: await WebAssembly.compile(bytes as Uint8Array<ArrayBuffer>) };
    })();
    p.catch(() => m!.delete(tool));
    m.set(tool, p);
  }
  return p;
}

/** Compile the three tools ahead of the first run. */
export async function prepareIcarus(assets: IcarusAssets): Promise<void> {
  await Promise.all((["ivlpp", "ivl", "vvp"] as const).map((t) => loadTool(assets, t)));
}

interface Output { stdout: string[]; stderr: string[] }

async function instance(assets: IcarusAssets, tool: IcarusTool, out: Output, job: IcarusWebJob): Promise<EmscriptenModule> {
  const { factory, module } = await loadTool(assets, tool);
  const line = (stream: "stdout" | "stderr") => (text: string) => {
    out[stream].push(text);
    job.onLine?.(text, stream);
    const why = job.shouldStop?.();
    if (why) throw new StopRun(why);
  };
  return factory({
    noInitialRun: true,
    print: line("stdout"),
    printErr: line("stderr"),
    instantiateWasm(imports: WebAssembly.Imports, done: (i: WebAssembly.Instance) => void) {
      WebAssembly.instantiate(module, imports).then(done);
      return {};
    },
  });
}

function writeProject(fs: EmscriptenFS, files: Record<string, string | Uint8Array>): void {
  fs.mkdirTree("/work");
  fs.mkdirTree("/.rtlpp");
  for (const [p, data] of Object.entries(files)) {
    const path = `/work/${normalizePath(p)}`;
    fs.mkdirTree(path.slice(0, path.lastIndexOf("/")));
    fs.writeFile(path, toBytes(data));
  }
  fs.chdir("/work");
}

function callMain(m: EmscriptenModule, args: string[]): { code: number; stopped?: string } {
  try {
    return { code: m.callMain(args) ?? 0 };
  } catch (e) {
    if (e instanceof StopRun) return { code: 0, stopped: e.reason };
    const status = (e as { status?: unknown })?.status;
    if (typeof status === "number") return { code: status };
    throw e;
  }
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_$]*$/;

/** The flags file ivlpp reads with -F: defines and include directories, one per line. */
export function preprocessorFlags(job: Pick<IcarusWebJob, "defines" | "includeDirs">): string {
  const lines = ["D:__ICARUS__=1"];
  for (const [k, v] of Object.entries(job.defines ?? {})) {
    if (!IDENT.test(k)) throw new Error(`Define name must be an identifier: ${JSON.stringify(k)}`);
    lines.push(v === true ? `D:${k}` : v === false ? `D:${k}=0` : `D:${k}=${v}`);
  }
  for (const d of job.includeDirs ?? []) lines.push(`I:${normalizePath(d)}`);
  return `${lines.join("\n")}\n`;
}

/** The compiler configuration ivl reads with -C (what the iverilog driver would write). */
export function compilerConfig(job: Pick<IcarusWebJob, "roots" | "generation">, out: string): string {
  const gen = job.generation ?? "2012";
  if (!(ICARUS_GENERATIONS as readonly string[]).includes(gen)) throw new Error(`Unsupported Icarus generation ${gen}`);
  if (job.roots.length === 0) throw new Error("Icarus needs at least one root module");
  for (const r of job.roots) if (!IDENT.test(r)) throw new Error(`Root module must be an identifier: ${JSON.stringify(r)}`);
  const vpi = ["system.vpi"];
  if (gen !== "2005-sv") vpi.push("v2005_math.vpi");
  if (gen !== "2005") vpi.push("v2009.vpi");
  return [
    "basedir:/work",
    ...vpi.map((m) => `module:${m}`),
    "-t:dll",
    "flag:DLL=vvp.tgt",
    `generation:${gen}`,
    "generation:no-specify",
    `out:${out}`,
    "iwidth:32",
    "widthcap:65536",
    "functor:cprop",
    "functor:nodangle",
    ...job.roots.map((r) => `root:${r}`),
    "",
  ].join("\n");
}

/** Preprocess, compile and run. HDL errors come back as a non-zero exit code naming the stage. */
export async function runIcarusWeb(assets: IcarusAssets, job: IcarusWebJob): Promise<IcarusWebResult> {
  const out: Output = { stdout: [], stderr: [] };
  const timings = { preprocessMs: 0, compileMs: 0, runMs: 0 };
  const result = (stage: IcarusWebResult["stage"], exitCode: number, stopped?: string): IcarusWebResult => ({
    stage, exitCode,
    stdout: out.stdout.map((l) => `${l}\n`).join(""),
    stderr: out.stderr.map((l) => `${l}\n`).join(""),
    ...(stopped ? { stopped } : {}),
    timings,
  });
  if (job.sources.length === 0) throw new Error("No Verilog sources to simulate");

  let t0 = performance.now();
  const pp = await instance(assets, "ivlpp", out, job);
  writeProject(pp.FS, job.files);
  pp.FS.writeFile("/.rtlpp/ivlpp.flags", preprocessorFlags(job));
  const ppRun = callMain(pp, ["-F", "/.rtlpp/ivlpp.flags", "-L", "-o", "/.rtlpp/pre.v", ...job.sources.map(normalizePath)]);
  timings.preprocessMs = performance.now() - t0;
  if (ppRun.stopped) return result("preprocess", 0, ppRun.stopped);
  if (ppRun.code !== 0 || !pp.FS.analyzePath("/.rtlpp/pre.v").exists) return result("preprocess", ppRun.code || 1);
  const preprocessed = pp.FS.readFile("/.rtlpp/pre.v");

  t0 = performance.now();
  const cc = await instance(assets, "ivl", out, job);
  cc.FS.mkdirTree("/work");
  cc.FS.mkdirTree("/.rtlpp");
  cc.FS.chdir("/work");
  cc.FS.writeFile("/.rtlpp/pre.v", preprocessed);
  cc.FS.writeFile("/.rtlpp/ivl.conf", compilerConfig(job, "/.rtlpp/a.vvp"));
  const ccRun = callMain(cc, ["-C/.rtlpp/ivl.conf", "--", "/.rtlpp/pre.v"]);
  timings.compileMs = performance.now() - t0;
  if (ccRun.stopped) return result("compile", 0, ccRun.stopped);
  if (ccRun.code !== 0 || !cc.FS.analyzePath("/.rtlpp/a.vvp").exists) return result("compile", ccRun.code || 1);
  const program = cc.FS.readFile("/.rtlpp/a.vvp");

  t0 = performance.now();
  const vm = await instance(assets, "vvp", out, job);
  writeProject(vm.FS, job.files);
  vm.FS.writeFile("/.rtlpp/a.vvp", program);
  let minor = 64;
  for (const [p, sink] of Object.entries(job.streams ?? {})) {
    const dev = vm.FS.makedev(64, minor++);
    vm.FS.registerDevice(dev, {
      open(stream: { seekable?: boolean }) { stream.seekable = false; },
      close() {},
      read() { return 0; },
      write(_stream: unknown, buffer: Uint8Array, offset: number, length: number) {
        sink(buffer.slice(offset, offset + length));
        const why = job.shouldStop?.();
        if (why) throw new StopRun(why);
        return length;
      },
    });
    vm.FS.mkdev(`/work/${normalizePath(p)}`, dev);
  }
  // -n: $stop ends the run instead of opening vvp's interactive prompt.
  const vmRun = callMain(vm, ["-n", "/.rtlpp/a.vvp", ...(job.plusargs ?? []).map((a) => `+${a}`)]);
  timings.runMs = performance.now() - t0;
  return result("run", vmRun.code, vmRun.stopped);
}
