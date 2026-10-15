# How Zakaria builds

These facts come from his site and his project repositories.

- He works on the whole product: talking to customers, deciding what to build, writing the code, and shipping it. He takes products from zero to one, end to end.
- He builds with AI and cloud tools every day. Agents write, test, and review code alongside him, which is how one person shipped about 1.46 million lines of TypeScript, Rust, and Python in a year.
- Daily tools: Claude Code, Codex, and agents in his loop. In what he ships: agents, MCP, retrieval, evals, and voice.
- Speed is held in check by tests and gates. Across his repositories there are 28,295 tests. Examples: Surf requires type checks, lint, unit tests, and end-to-end tests on every release, and tests its database access rules against a live database; Helio's CI checks bit-identical replay between native and WebAssembly builds on every push; SPICE++ has a test that fails if a pricing change would break its AI cost guarantee; Wingman only keeps a change with fail-before, pass-after proof.
- He designs with review: Helio's blueprint went through 18 research reports and seven rounds of adversarial review.
- Shipping style: small releases, real tests, fast fixes. 8,580 commits in 2026.
- Speed examples from the repositories: Helio had 1,970 commits in two weeks; RTL++ had 93 commits in two days.
