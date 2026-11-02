# Changelog

All notable changes to the AetherFlow project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-11-02

### Added
- **First-Class Anthropic Claude Provider**:
  - Full native integration for Anthropic models (`AnthropicProvider`), with support for Claude Fable, Claude Mythos, Claude Sonnet (3.5/5.5), and Claude Haiku.
  - Multi-provider auto-detection in `AetherKernel` and CLI across Anthropic, OpenAI, DeepSeek, Groq, local Ollama, and Google Gemini.
- **Dynamic Model Switching**:
  - Microkernel `setModel()` and `setProvider()` runtime API to dynamically hot-swap LLMs and provider clients on the fly without restarting the process.
- **Interactive CLI REPL & Developer Experience**:
  - `/model`: Live status dashboard displaying all supported AI providers, key readiness (`[ONLINE]` vs `[NO KEY]`), and example model identifiers.
  - `/code <tool>`: Live tool inspector to view synthesized JavaScript code executed within the Docker container sandbox.
  - `/exec <tool> [args]`: Direct sandbox invocation command with custom JSON arguments.
  - `/examples`: Curated menu of real-world copy-paste scenarios (Statistics, Financial CAGR, Prime Factorization, Regex Extraction, Security Audits).
  - Tab auto-completion in REPL for all slash commands and tool names.
  - Dynamic prompt badge `aether [model]> ` reflecting the active model.
- **Environment Auto-Loading**:
  - Native `.env` file loading via `process.loadEnvFile()` in CLI binary and interactive terminal.

### Changed
- **CLI Formatting & UI Polish**:
  - Replaced graphical emojis across CLI and REPL with clean, professional text/ASCII markers (`✔`, `✖`, `▲`, `[ONLINE]`, `[NO KEY]`).
  - Simplified and standardized model badges (e.g. `[gemini 3.5 flash]`, `[claude sonnet 5.5]`, `[claude fable 5]`).
  - Deduplicated ASCII banner badges and aligned frame formatting.
  - Prominent `FINAL RESULT / ANSWER:` output container for natural language queries.

### Removed
- Removed 14,500+ lines of redundant/duplicate files:
  - Deleted duplicate 584KB root evaluation dump `eval_results_gemini-3_5-flash-lite.json` in favor of the canonical `eval/results/2026-10-30.json`.
  - Deleted obsolete raw console test dump `docs/verification-raw.txt`.
  - Deleted superseded SVG animation assets `docs/demo.svg` and `scripts/make-demo-svg.js`.
- Updated `.gitignore` to prevent generated evaluation runs (`eval_results_*.json`) from polluting Git status.

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
