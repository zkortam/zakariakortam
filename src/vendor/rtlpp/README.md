Vendored, unmodified, from zkortam/spiceplusplus `src/lib/rtl` (the RTL++ engine layer).
Source commit: 81224b015b4bbb6ca1751852fa8ba4d1e3f95e43 (2026-10-03)

Files: `types.ts`, `engines/icarusWeb.ts`, `engines/runtime.ts`, `engines/assetManifest.ts`,
`sim/testbench.ts`, `sim/checks.ts`, `sim/vcd.ts`. Refresh by copying the same files again.

Used by `src/components/demos/rtl/icarus.worker.ts` on the RTL++ project page: the visitor's
`counter.sv` is compiled and simulated against the RTL++ `tb_counter` template by Icarus Verilog
(ivlpp, ivl, vvp built for WebAssembly by `@veriflow/iverilog-wasm@0.1.4`, GPL-2.0-or-later).
Those binaries are not bundled here: the worker fetches them at run time from the npm CDN, as RTL++
does, and rejects any file whose SHA-256 differs from `engines/assetManifest.ts`. Corresponding
source: https://github.com/AlexMercer12138/iverilog at revision 75c777c993c2bbc6ffe7f9138f25a76e14db5325.

## site/

The RTL++ home page's recorded run and what draws it, from the same repository at commit
81224b015b4bbb6ca1751852fa8ba4d1e3f95e43, copied as-is (only import paths changed):

- `showcase.ts`, `showcase.generated.ts`: `apps/rtlpp/src/app/(marketing)/_site/`, the run recorded
  from the real engines (Icarus, the netlist simulator and the Yosys-backed Why chain).
- `logicLanes.ts`: `src/components/Waveforms/logicLanes.ts`, the workspace's waveform lane layout.
- `plot.ts`: the three view types logicLanes takes, from `src/components/Waveforms/plot.ts`.
- `lexer.ts`: `apps/rtlpp/src/lib/editor/lexer.ts`, the editor's Verilog lexer.
- `format.ts`: `apps/rtlpp/src/lib/engines/format.ts`; `outcome.ts` holds the `TestOutcome` union
  from `apps/rtlpp/src/lib/engines/types.ts` it words.
- `tokens.ts`: `src/styles/tokens.ts`, the trace palette and inks.

`src/components/demos/rtl/RunView.tsx` and `code.tsx` port `_site/RunView.tsx` and `_site/code.tsx`
(Tailwind classes moved to `src/components/demos/rtl.css`, prefix `rp-`).
