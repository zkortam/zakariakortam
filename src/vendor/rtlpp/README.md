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
