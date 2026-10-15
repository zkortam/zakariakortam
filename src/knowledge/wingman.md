# Wingman

Page: /portfolio/wingman. Code: https://github.com/zkortam/wingman. npm package: @zkortam/wingman-sdk. Year: 2026. Built by Zakaria Kortam and Ali Alani as co-creators. Open source under the MIT license; pre-1.0.

## What it is
Wingman does decision review and outcome verification for AI agents that use tools. It sits where an agent calls its tools, catches poorly considered actions before they run, learns from moments when a user pushes back, and only applies a configuration change if it can show the problem fails before the change and passes after it.

AI agents often propose actions that are valid but poorly reasoned: the wrong tool, a dropped user constraint, or repeating something the user already rejected. Tracing records that after it happens. Wingman adds a check before execution and an evidence pipeline after the session.

## How it works
- Tool-call review: before the host runs a proposed tool call, Wingman returns ALLOW, RETHINK, or ESCALATE (ask a human).
- Friction detection: spots retries, restated constraints, abandonment, and mismatched expectations in redacted sessions.
- Verified repair: a candidate fix is only kept if the same check fails before it and passes after it.
- Safe rollout: signed, bounded configuration versions, applied to one user or everyone, with rollback.
- Privacy: user IDs are pseudonymized with HMAC and text is scrubbed inside the agent's host before anything leaves it.

Guarantees: Wingman never executes the host's tools itself; replays are model-only; reviews fail open by default so Wingman cannot take down the host agent (high-risk setups can fail closed), and failures are reported rather than hidden.

It integrates with MCP clients, LangChain, the Vercel AI SDK, and OpenAI Agents through a before-tool hook, and keeps OpenTelemetry trace correlation.

## Measured numbers
537 tests, 25k lines of TypeScript, 0 third-party runtime dependencies in the SDK.
