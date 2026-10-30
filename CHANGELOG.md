# Changelog

All notable changes to the AetherFlow project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-30

### Scope
Initial verified sandbox and dynamic tool-synthesis release for Large Language Model (LLM) agents.

### Added
- **Multi-Layer Sandbox Architecture**:
  - Isolated Docker container runner (`docker` mode) with read-only root filesystems, dropped Linux capabilities (`CAP_DROP=ALL`), non-root execution (`uid=1000`), no network access (`--network none`), memory caps (64MB), and strict process limits (`pids-limit=64`).
  - AST containment layer (`ASTVerifier`) blocking prototype constructor evasion, dynamic import, `eval`, `new Function`, template string constructor lookups, and static infinite loops.
  - Fail-closed security contracts: refuses insecure subprocess execution unless explicitly opted into via `unsafeDevMode`.
- **Dynamic Tool-Synthesis Loop**:
  - On-the-fly code synthesis for arbitrary user-specified computational goals.
  - Verification loop with compile/runtime error feedback and self-healing retries.
  - Persistent family-indexed and description-similarity tool library (`ToolLibrary`) for runtime tool reuse.
- **Evaluation Benchmark Suite (`@aether-flow/eval`)**:
  - 15 deterministic benchmark tasks across 5 algorithmic families (Markdown Table parsing, Levenshtein sequence alignment, Dijkstra shortest path with turn penalties, CSV 2D aggregation pivot, and 0/1 Dual Knapsack optimization).
  - 5 domain checker test harnesses validating solution optimality and constraint satisfaction.
  - Evaluation across 5 experimental conditions: Condition A (zero-shot direct generation), Condition B (static 5-tool palette), Condition C0 (single-shot synthesis without feedback), Condition C (synthesis with sandbox/AST feedback loop), and Condition D (dynamic tool synthesis with runtime reuse).
  - Multi-model profile registry with configurable rate limits, per-model daily quota tracking, and automatic request pacing.
  - Quota isolation keyed to Pacific calendar day (America/Los_Angeles) and user-facing Casablanca timezone conversion.
- **Developer Experience & Tooling**:
  - Monorepo structure with explicit build dependency ordering (`@aether-flow/core`, `@aether-flow/cli`, `@aether-flow/eval`).
  - GitHub Actions CI pipeline running on Ubuntu 24.04 LTS matrix (Node 20 and Node 22).
  - Interactive self-healing synthesis demonstration (`npm run demo`).
