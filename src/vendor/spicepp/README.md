Vendored, unmodified, from zkortam/spiceplusplus `src/lib` (the SPICE++ simulation engine).
The engine is used by `src/components/demos/SpiceLive.tsx` (in a worker) to run real
simulations in the browser on the SPICE++ project page. Refresh by copying the same files again.
Source commit: 81224b015b4bbb6ca1751852fa8ba4d1e3f95e43 (2026-10-03)

Also vendored from the same commit, for the SPICE++ project page demo (`src/components/demos/SpiceLive.tsx`):
- `schematic/` — `src/lib/schematic/{types,components,digital_parts,digital_netlist,netlist,examples,probe_suggestions}.ts`, unmodified.
- `sim/subckt.ts`, `sim/model_parser.ts` — from `src/lib/sim/`, unmodified (needed by the netlister).
- `styles/tokens.ts` — `src/styles/tokens.ts`, unmodified.
- `waveforms/plot.ts` — `src/components/Waveforms/plot.ts`; only its two `@/` import paths are rewritten to relative ones.
- `canvas/hit.ts` — `src/components/Canvas/hit.ts`; only its `@/` import path is rewritten to a relative one.
