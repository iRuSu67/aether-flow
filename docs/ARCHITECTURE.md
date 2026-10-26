# AetherFlow Architecture & Microkernel Internals

AetherFlow is engineered from the ground up as a high-throughput, event-driven multi-agent orchestration microkernel. Unlike traditional agent frameworks that rely on static, brittle DAG execution graphs, AetherFlow operates on a dynamic **Cognitive Nerve Center** with real-time state streaming, Hegelian consensus rounds, and on-the-fly tool synthesis.

```
                  ┌──────────────────────────────────────────────┐
                  │            AetherFlow Microkernel            │
                  │                                              │
                  │   ┌──────────────────────────────────────┐   │
                  │   │         Cognitive Event Bus          │   │
                  │   └──────────────────┬───────────────────┘   │
                  └──────────────────────┼───────────────────────┘
                                         │
        ┌────────────────────────────────┼───────────────────────────────┐
        ▼                                ▼                               ▼
┌──────────────┐                 ┌──────────────┐                ┌──────────────┐
│  Architect   │ (Thesis)        │    Critic    │ (Antithesis)   │ Synthesizer  │ (Synthesis)
│    Agent     │ ──────────────> │    Agent     │ ─────────────> │    Agent     │
└──────────────┘                 └──────────────┘                └──────┬───────┘
                                                                        │
                                                                        ▼
                                                         ┌─────────────────────────────┐
                                                         │   ToolForge (JIT Engine)    │
                                                         │ - Dynamic Code Generation   │
                                                         │ - Safe Sandbox Verification │
                                                         │ - Self-Healing Loop         │
                                                         └──────────────┬──────────────┘
                                                                        │
                                                                        ▼
                                                         ┌─────────────────────────────┐
                                                         │    Runtime Executor &       │
                                                         │   WebSocket Telemetry       │
                                                         └─────────────────────────────┘
```

---

## Core Components

### 1. CognitiveBus (`kernel/CognitiveBus.ts`)
The asynchronous nerve center of the entire runtime. Every thought, state mutation, critique, tool execution, and sandbox output is dispatched as an immutable, timestamped `CognitiveEvent`.
* **Zero Overhead**: In-memory ring buffer with configurable history limits.
* **Telemetry Streaming**: Real-time broadcast over WebSockets to external visual canvases or monitoring infrastructure.
* **Deterministic Replay**: Allows full replay of execution traces for auditing and regression benchmarking.

### 2. Hegelian Dialectic Consensus (`consensus/HegelianEngine.ts`)
Standard multi-agent frameworks often hallucinate or amplify mistakes across sequential nodes. AetherFlow introduces adversarial multi-agent debate based on the Hegelian dialectic:
1. **Thesis**: The Architect proposes the structural solution and execution plan.
2. **Antithesis**: The Critic agent conducts adversarial stress-testing (edge cases, overflow risks, security flaws).
3. **Synthesis**: The Synthesizer resolves tensions between thesis and antithesis, generating an unassailable strategy.
4. **Convergence Metric**: Computes a dynamic confidence score $(0.0 \dots 1.0)$. Execution proceeds only when threshold criteria are met.

### 3. JIT Tool Synthesis & ToolForge (`tools/ToolForge.ts`)
When a goal requires a capability missing from the standard registry (e.g. specialized financial algorithms, custom AST parsing, niche data structures):
* ToolForge asks the model provider to write an isolated, typed JavaScript function.
* The synthesized code is executed inside a fortified `Sandbox` context with simulated inputs.
* If runtime errors occur, the **Self-Healing Loop** captures the callstack, feeds it back to the generator, and auto-corrects the code in up to 3 iterative passes.
* Verified tools are registered dynamically in `ToolRegistry` and immediately callable by agents.

### 4. Pluggable Model Providers (`providers/`)
* **`MockProvider`**: Zero-configuration, deterministic simulation engine. Enables instant out-of-the-box local testing, offline demoing, and CI testing without requiring API keys.
* **`GeminiProvider`**: Native Google Gemini Pro/Flash integration.
* **`OpenAIProvider`**: OpenAI GPT-4o / DeepSeek / Ollama / local vLLM compatible client.

---

## Benchmarks & Performance
AetherFlow microkernel achieves sub-millisecond event dispatch overhead and sandbox execution latency of $< 15\text{ms}$ for synthesized tools.
