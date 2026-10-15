# SPICE++

Page: /portfolio/spice-plus-plus. Live site: https://www.spicepp.com. Years: 2025 to now. Zakaria's role: product, design, and engineering.

## What it is
SPICE++ is a browser-based circuit simulator meant as an LTspice or PSpice replacement: schematic capture, a SPICE-class simulation engine, and a waveform viewer, with an optional AI assistant that can build and run circuits. The simulation runs on the user's own machine, in the browser.

## The engine
Zakaria wrote the simulation engine from scratch in TypeScript. It is a Modified Nodal Analysis (MNA) solver with:
- .op operating point, .dc DC sweep, .tran transient (Backward Euler, then Trapezoidal), and .ac small-signal frequency sweep.
- Newton-Raphson iteration with junction limiting and a gmin-stepping fallback for nonlinear devices.
- Elements including resistors, capacitors, inductors, voltage and current sources (DC, AC, SIN, PULSE, PWL, EXP), Shockley diodes, controlled sources, an op-amp model, and Level-1 NMOS and PMOS MOSFETs. 21 device types in total.

## The app
- Schematic editor on an infinite canvas: place parts, draw orthogonal wires with auto-junctions, rotate, mirror, undo and redo, net labels.
- Waveform viewer: transient and DC plots, AC Bode plots (magnitude and phase), an operating-point table.
- A command bar (Cmd+K), an inspector for part values, and built-in examples (voltage divider, RC low-pass, half-wave rectifier, inverting op-amp).
- Import and export: SPICE netlists, LTspice schematics (.asc), KiCad 6+ schematics, its own JSON format, plus SVG and PNG export and structural Verilog export. Round trips are covered by 43 tests.
- Accounts and saved designs on Supabase with row-level security; subscriptions through Stripe, with free and paid plans.

## AI assistant
A chat panel talks to GPT-6 models on Azure OpenAI. Its tool registry maps each tool to an editor action, so the assistant can do anything a user can: place parts, wire them, run simulations, and debug a circuit (15+ circuit tools). Every AI call is metered against the user's monthly allowance: the worst-case cost is reserved before the call and settled to the exact cost after, and a test fails if a pricing change would break that guarantee.

SPICE++ was checked against UC San Diego ECE coursework.

## Measured numbers
195k lines of TypeScript, 21 device types, 5 analysis types, 4 file formats in and out.

## Roadmap (planned, not built yet)
An ngspice WebAssembly engine for full device model coverage, a virtual instrument bench, Monte Carlo and sensitivity analysis, and teaching tools such as symbolic transfer functions.
