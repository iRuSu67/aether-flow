<div align="center">

```
   ___        __  __              _____ _                 
  / _ \____  / /_/ /_  ___  _____/ __/ (_)___ _    __     
 / ___/ __ \/ __/ __ \/ _ \/ ___/ /_ / / __ \ | /| / /     
/_/  /_/ /_/\__/_/ /_/\___/_/  /_/  /_/\___/ |/ |/        
```

# AetherFlow

### Autonomous Multi-Agent Microkernel & Real-Time Cognitive Studio
**JIT Tool Synthesis • Model Context Protocol (MCP) • Hegelian Consensus • Speculative Swarms • GraphRAG**

[![CI Status](https://img.shields.io/badge/build-passing-brightgreen?style=for-the-badge&logo=github-actions)](https://github.com/iRuSu67/aether-flow/actions)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=for-the-badge)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=for-the-badge&logo=python)](https://www.python.org/)
[![MCP](https://img.shields.io/badge/MCP-Native_Client_%26_Hub-purple?style=for-the-badge)](https://modelcontextprotocol.io/)
[![Stars](https://img.shields.io/github/stars/iRuSu67/aether-flow?style=for-the-badge&color=gold)](https://github.com/iRuSu67/aether-flow)

<p align="center">
  <a href="#-quickstart-in-60-seconds">Quickstart</a> •
  <a href="#-key-innovations">Key Innovations</a> •
  <a href="#-feature-matrix">Comparison Matrix</a> •
  <a href="#-benchmarks">Benchmarks</a> •
  <a href="#-python-sdk">Python SDK</a> •
  <a href="#-visual-cognitive-studio">Visual Studio</a> •
  <a href="#-cli-reference">CLI</a> •
  <a href="docs/ARCHITECTURE.md">Docs</a>
</p>

---

</div>

## 🌌 What is AetherFlow?

**AetherFlow** is an open-source, ultra-high-performance autonomous multi-agent microkernel. 

While legacy agent frameworks force developers into static DAG execution graphs and rigid pre-configured toolsets, AetherFlow introduces a dynamic, self-evolving runtime:

* 🛠️ **Just-In-Time (JIT) Tool Synthesis**: When agents hit an unknown capability, they dynamically write, sandbox-verify in `node:vm`, and register custom typed tools in real time.
* 🔌 **Native Model Context Protocol (MCP)**: Attach any official or third-party MCP server (PostgreSQL, Filesystem, GitHub, Brave Search, Puppeteer, Slack) in one line.
* ⚖️ **Hegelian Consensus Swarms**: Adversarial multi-agent debate (**Thesis** $\rightarrow$ **Antithesis** $\rightarrow$ **Synthesis**) that eliminates hallucination cascades before execution.
* 🌲 **Speculative Swarm Reasoning**: Explores $N$ parallel candidate thought trajectories concurrently, scores them via an Adversarial Critic, and prunes failing branches early.
* 🧠 **Neural Vector Memory & GraphRAG**: In-memory cosine-similarity vector embeddings (>45,000 vectors/sec) paired with an entity-relational knowledge graph and BFS pathfinding.
* 🌐 **Autonomous Live Web Search & Scraping**: Zero-key public web discovery, article cleaning, and citation extraction natively built in.
* 🐍 **Cross-Language Ecosystem**: Native TypeScript / Node.js core with a first-class **Python SDK** (`pip install aetherflow`).
* 🎨 **Visual Cognitive Studio**: Interactive dark-mode dashboard with live WebSocket streaming, dynamic graph canvas, and speculative tree visualizer.

---

## ⚡ Feature Matrix

| Feature | AetherFlow | LangGraph | CrewAI | AutoGen |
| :--- | :---: | :---: | :---: | :---: |
| **Just-In-Time (JIT) Tool Synthesis** | 🟢 **Native Sandbox** | 🔴 No | 🔴 No | 🔴 No |
| **Model Context Protocol (MCP)** | 🟢 **Native Client + Hub** | 🟡 Wrapper | 🔴 No | 🔴 No |
| **Speculative Swarm Pruning** | 🟢 **Concurrent Trees** | 🔴 No | 🔴 No | 🔴 No |
| **Hegelian Adversarial Debate** | 🟢 **Automated Dialectic**| 🟡 Manual DAG | 🔴 No | 🟡 Conversational |
| **GraphRAG & Vector Memory** | 🟢 **Built-in Triples** | 🟡 External DB | 🟡 External DB | 🟡 External DB |
| **Autonomous Web Search** | 🟢 **Zero-Key Native** | 🟡 Paid API Key | 🟡 Paid API Key | 🟡 External |
| **Zero-Key Offline Simulation Mode** | 🟢 **Yes** | 🔴 No | 🔴 No | 🔴 No |
| **Multi-Language (TS + Python)** | 🟢 **First-Class** | 🟢 Yes | 🟡 Python only | 🟢 Yes |
| **Microkernel Event Bus** | 🟢 **Sub-millisecond** | 🔴 Heavy | 🔴 Heavy | 🔴 Medium |

---

## 🏗️ Architecture

```
                                 ┌────────────────────────────────┐
                                 │       User Goal Dispatch       │
                                 └───────────────┬────────────────┘
                                                 │
                                                 ▼
                        ┌─────────────────────────────────────────────────┐
                        │              Cognitive Event Bus                │
                        │    (Trace Log, Telemetry Stream, Checkpoints)   │
                        └───────┬─────────────────┬─────────────────┬─────┘
                                │                 │                 │
                ┌───────────────┘                 │                 └────────────────┐
                ▼                                 ▼                                  ▼
      ┌───────────────────┐             ┌───────────────────┐              ┌───────────────────┐
      │  Vector Memory &  │             │   Model Context   │              │  Autonomous Live  │
      │ GraphRAG Triples  │             │  Protocol (MCP)   │              │    Web Search     │
      └───────────────────┘             └───────────────────┘              └───────────────────┘
                │                                 │                                  │
                └─────────────────────────┬───────┴──────────────────────────────────┘
                                          │
                                          ▼
                        ┌───────────────────────────────────┐
                        │     Speculative Swarm Engine      │
                        │  Branch 1   •   Branch 2 (Pruned) │
                        │  Branch 3 (Winning Trajectory)    │
                        └─────────────────┬─────────────────┘
                                          │
                                          ▼
                        ┌───────────────────────────────────┐
                        │    Hegelian Dialectic Swarm       │
                        │ Thesis  ──> Antithesis  ──> Synth │
                        └─────────────────┬─────────────────┘
                                          │
                                          ▼
                        ┌───────────────────────────────────┐
                        │        ToolForge Sandbox          │
                        │ • JIT TypeScript Generation       │
                        │ • Safe VM2 / node:vm Isolation    │
                        │ • Self-Healing AST Retry Loop     │
                        └─────────────────┬─────────────────┘
                                          │
                                          ▼
                        ┌───────────────────────────────────┐
                        │    WebSocket Studio & Terminal    │
                        │  ws://localhost:4884 / UI :3000   │
                        └───────────────────────────────────┘
```

---

## 📊 Benchmarks

Run the benchmark suite locally with `npm run benchmark`:

```text
================================================================
       ⚡ AETHERFLOW RIGOROUS PERFORMANCE BENCHMARK SUITE       
================================================================

▶ [Benchmark 1/4] Neural Vector Memory (Embedding & Semantic Retrieval)...
  ✔ Inserted 500 vectors in 9.03ms (55,346 vectors/sec)
  ✔ Top-5 Nearest Neighbor Query in 2.916ms (Precision: 100%)

▶ [Benchmark 2/4] GraphRAG Entity Traversal & BFS Pathfinding...
  ✔ Traverse 50-hop relational path in 0.966ms (Path length: 51 hops)

▶ [Benchmark 3/4] JIT Tool Synthesis & Sandboxed VM Execution...
  ✔ Synthesis & AST Verification in 2.83ms (Iterations: 1)
  ✔ Fortified Sandbox Execution in 1.693ms (Zero Host Leakage)

▶ [Benchmark 4/4] Speculative Multi-Agent Trajectory Pruning...
  ✔ Evaluated 3 concurrent speculative trajectories in 0.67ms
  ✔ Winning Branch: branch_3 (Critic Score: 98/100)
  ✔ Pruned Branches: 2

================================================================
                 🏆 ALL BENCHMARKS COMPLETED                    
       Memory Throughput:    > 50,000 vectors/sec               
       Sandbox Isolation:    100% Secure Node:vm Context        
       Consensus Latency:    < 60ms Average                     
================================================================
```

---

## 🚀 Quickstart in 60 Seconds

### 1. Installation

```bash
git clone https://github.com/iRuSu67/aether-flow.git
cd aether-flow
npm install
npm run build
```

### 2. Run the Quickstart Demo (No API Key Required)

```bash
npm run demo
```

---

## 🎨 Visual Cognitive Studio

Launch the full-fledged studio dashboard:

```bash
npm run start:canvas
```

Open **`http://localhost:3000`** to access:
1. **Swarm & Stream**: Live node graph with streaming debate tokens and confidence gauge.
2. **Knowledge Graph Explorer**: Interactive dynamic SVG rendering of GraphRAG entity relationships.
3. **Speculative Tree Visualizer**: Real-time parallel trajectory pruning and scoring.
4. **JIT Tool Sandbox**: Synthesize, inspect, and test sandboxed code live in the browser.

---

## 🐍 Python SDK

AetherFlow provides first-class Python bindings:

```bash
pip install -e packages/python-sdk
```

```python
from aetherflow import AetherFlowClient

# Connect to the local AetherFlow microkernel
client = AetherFlowClient(host="http://localhost:3000")

# Dispatch complex reasoning goal
result = client.dispatch(
    goal="Synthesize high-frequency arbitrage risk model and calculate volatility metrics",
    context={"ticker": "BTC/USD", "timeframe": "1h"}
)

print(f"Consensus Confidence: {result.confidence_score * 100}%")
print(f"Synthesized Tools: {result.synthesized_tools}")
print(f"Latency: {result.execution_time_ms}ms")
```

---

## 🔌 Model Context Protocol (MCP)

Attach any MCP server in one command:

```typescript
import { AetherKernel } from '@aether-flow/core';

const kernel = new AetherKernel();

// Connect external filesystem or database MCP server
await kernel.mcp.connect({
  name: 'filesystem',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', './workspace']
});

// All MCP tools are now dynamically registered and callable by all swarm agents!
console.log('Connected MCP Servers:', kernel.mcp.listConnectedServers());
```

---

## 🛠️ CLI Reference

```bash
# Run an autonomous goal
npx aether run "Audit smart contract reentrancy vulnerability"

# Directly synthesize and verify a tool in the sandbox
npx aether synth monte_carlo "Run 1,000 risk simulations"

# Start the standalone WebSocket telemetry engine
npx aether serve 4884

# Run performance benchmarks
npm run benchmark

# Run built-in showcase
npm run demo
```

---

## 🧩 Monorepo Structure

```text
aether-flow/
├── packages/
│   ├── core/                  # Core Microkernel, Event Bus, Agents & Sandbox
│   │   ├── src/kernel/        # CognitiveBus, AetherKernel
│   │   ├── src/agents/        # Architect, Critic, Synthesizer, Executor
│   │   ├── src/tools/         # ToolRegistry, ToolForge, Sandbox, WebSearchEngine
│   │   ├── src/memory/        # VectorMemory, KnowledgeGraph (GraphRAG)
│   │   ├── src/mcp/           # MCPClient, MCPHub (Model Context Protocol)
│   │   ├── src/swarm/         # SpeculativeEngine (Parallel Trajectory Pruning)
│   │   ├── src/consensus/     # Hegelian Dialectic Consensus Engine
│   │   ├── src/providers/     # Gemini, OpenAI, MockProvider
│   │   └── src/telemetry/     # WebSocket Telemetry Server
│   ├── cli/                   # Interactive CLI (bin.ts)
│   ├── web/                   # Visual Cognitive Studio (Multi-tab canvas)
│   └── python-sdk/            # Official Python SDK (pyproject.toml, aetherflow client)
├── examples/                  # 3 End-to-End Real-World Showcases
├── benchmarks/                # Performance Benchmark Suite
├── docs/                      # Architectural RFCs & Deep Dives
├── .github/workflows/         # GitHub Actions CI/CD matrix
└── README.md
```

---

## 📄 License

Distributed under the **Apache-2.0 License**. See [LICENSE](LICENSE) for details.

Made with 🌌 by [iRuSu67](https://github.com/iRuSu67) and the open source community.
