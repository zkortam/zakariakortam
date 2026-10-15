# RTL++

Page: /portfolio/rtl-plus-plus. Live site: https://rtlpp.vercel.app. Year: 2026. Zakaria's role: product, design, and engineering.

## What it is
RTL++ is a browser workbench for digital logic and FPGAs. You write Verilog or SystemVerilog, run every test in two simulators (Icarus Verilog plus a second simulator as a cross-check), and build for iCE40 and ECP5 FPGAs. It is a sibling of SPICE++: the two share an account, a design system, the AI agent harness, and the waveform engine.

The product is organized around five verbs: Write (code with problems shown in place), Prove (tests that pass on two simulators, or a failure with a time), Understand (the line that caused a value), Build (a bitstream with honest timing numbers), and Program (the design running on a real board).

## The "Why" debugger
Hardware tools usually show a waveform when a test fails and leave you to work out why. RTL++ has a deterministic cause chain called Why. When a test fails, Why runs by itself using the expected value from the test: it walks the wrong value back through the waveform, step by step, to the line of code that set it, showing the decisions that led there and when each input changed. Each step links to the code, the waveform, and the schematic. It works without an account and does not need AI; the AI assistant can then be asked about the chain as a second opinion.

## Build and program
Builds use the open FPGA toolchain (Yosys for synthesis, nextpnr for place and route) running in the browser through WebAssembly. Build reports show timing per clock, readable critical paths named by source signals, pins, resources, and warnings, plus provenance (tool versions, seed, bitstream hash) and a command to reproduce the build. Supported boards include iCEBreaker, ULX3S, and OrangeCrab. Tang Nano 9K is listed for synthesis only: Gowin place and route does not run in the browser yet.

## Design rules
Its design spec sets strict rules: one accent button per screen, no clutter or filler copy, every number real and reproducible, everything linked across views, a real phone layout, and light and dark themes treated as equals.

## Measured numbers
50k lines of TypeScript, 2 simulators on every test, 2 FPGA families, 93 commits in two days.
