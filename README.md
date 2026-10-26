<div align="center">

```
   ___        __  __              _____ _                 
  / _ \____  / /_/ /_  ___  _____/ __/ (_)___ _    __     
 / ___/ __ \/ __/ __ \/ _ \/ ___/ /_ / / __ \ | /| / /     
/_/  /_/ /_/\__/_/ /_/\___/_/  /_/  /_/\___/ |/ |/        
```

# AetherFlow

### Autonomous Multi-Agent Microkernel & Real-Time Cognitive Canvas
**Dynamic JIT Tool Synthesis • Hegelian Dialectic Consensus • Sandboxed Self-Healing • Multi-Model Swarm**

[![CI Status](https://img.shields.io/badge/build-passing-brightgreen?style=for-the-badge&logo=github-actions)](https://github.com/iRuSu67/aether-flow/actions)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=for-the-badge)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js->=20.0-339933?style=for-the-badge&logo=nodedotjs)](https://nodejs.org/)
[![Stars](https://img.shields.io/github/stars/iRuSu67/aether-flow?style=for-the-badge&color=gold)](https://github.com/iRuSu67/aether-flow)

<p align="center">
  <a href="#-quickstart-in-60-seconds">Quickstart</a> •
  <a href="#-key-innovations">Key Innovations</a> •
  <a href="#-feature-matrix">Comparison Matrix</a> •
  <a href="#-visual-cognitive-canvas">Visual Canvas</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-cli-reference">CLI</a> •
  <a href="docs/ARCHITECTURE.md">Docs</a>
</p>

---

</div>

## 🌌 What is AetherFlow?

**AetherFlow** is an open-source, high-throughput autonomous multi-agent microkernel. 

While legacy agent frameworks force you into static DAG execution graphs and rigid pre-configured toolsets, AetherFlow introduces:
- **Just-In-Time (JIT) Tool Synthesis**: When agents encounter an unknown problem, they dynamically write, sandbox-verify, and register their own tools in real time.
- **Hegelian Consensus Swarms**: Multi-agent adversarial debate (Thesis $\rightarrow$ Antithesis $\rightarrow$ Synthesis) that eradicates hallucination cascades.
- **Self-Healing Execution Sandboxes**: Catches runtime errors in synthesized code, feeds stack traces back to the cognitive bus, and auto-corrects on the fly.
- **Zero-Key Mock Engine**: Instant local testing, demoing, and CI without requiring API keys, alongside native adapters for **Google Gemini**, **OpenAI**, and **Ollama**.
- **Real-Time Visual Cognitive Canvas**: A high-polish dark-mode web dashboard streaming live reasoning traces, DAG mutations, and telemetry via WebSockets.

---

## ⚡ Feature Matrix

| Feature | AetherFlow | LangGraph | CrewAI | AutoGen |
| :--- | :---: | :---: | :---: | :---: |
| **Just-In-Time (JIT) Tool Synthesis** | 🟢 **Native** | 🔴 No | 🔴 No | 🔴 No |
| **Dialectic Adversarial Debate** | 🟢 **Hegelian Kernel** | 🟡 Manual DAG | 🔴 No | 🟡 Conversational |
| **Self-Healing Sandboxed VM** | 🟢 **Built-in** | 🔴 No | 🔴 No | 🟡 Docker only |
| **Real-Time Visual WebSocket Canvas** | 🟢 **Included** | 🟡 Studio (Cloud) | 🔴 No | 🔴 No |
| **Zero-Key Offline Simulation Mode** | 🟢 **Yes** | 🔴 No | 🔴 No | 🔴 No |
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
                        └────────────────────────┬────────────────────────┘
                                                 │
         ┌───────────────────────────────────────┼───────────────────────────────────────┐
         ▼                                       ▼                                       ▼
┌───────────────────┐                   ┌───────────────────┐                   ┌───────────────────┐
│  Architect Agent  │  Thesis Plan      │   Critic Agent    │  Adversarial Audit│ Synthesizer Agent │
│   (Decomposition) │ ────────────────> │(Vulnerability/Bug)│ ────────────────> │ (JIT Tool Maker)  │
└───────────────────┘                   └───────────────────┘                   └─────────┬─────────┘
                                                                                          │
                                                                                          ▼
                                                                           ┌─────────────────────────────┐
                                                                           │      ToolForge Sandbox      │
                                                                           │ • Code Synthesis            │
                                                                           │ • AST / Runtime Verification│
                                                                           │ • Self-Healing Retry Loop   │
                                                                           └──────────────┬──────────────┘
                                                                                          │
                                                                                          ▼
                                                                           ┌─────────────────────────────┐
                                                                           │  Runtime Executor & Canvas  │
                                                                           │ • ws://localhost:4884 Stream│
                                                                           │ • http://localhost:3000 Web │
                                                                           └─────────────────────────────┘
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

Output:
```text
⚡ Initializing AetherFlow Autonomous Microkernel...
[10:14:02 PM] [AetherKernel] (kernel:init): {"provider":"MockSimulationEngine"}
[10:14:02 PM] [Architect] (agent:debate): {"round":1,"phase":"thesis"}
[10:14:02 PM] [Critic] (agent:debate): {"round":1,"phase":"antithesis"}
[10:14:02 PM] [ToolForge] (tool:synthesized): {"toolName":"jit_synthesize_hi","iterations":1}
[10:14:02 PM] [AetherKernel] (goal:completed): {"confidenceScore":0.94,"executionTimeMs":84.2}

================ EXECUTION REPORT ================
🎯 Goal: Synthesize high-frequency arbitrage risk model and calculate volatility metrics
✅ Success: true
📊 Consensus Confidence Score: 94.0%
⏱️ Duration: 84.2ms
🛠️ Synthesized Dynamic Tools: [ 'jit_synthesize_hi' ]
📜 Total Cognitive Events: 7
==================================================
```

---

## 🎨 Visual Cognitive Canvas

AetherFlow comes bundled with a real-time reactive dashboard. Launch it locally:

```bash
npm run start:canvas
```

Open **`http://localhost:3000`** in your browser to view:
* **Hegelian Swarm Mesh**: Watch Architect, Critic, Synthesizer, and Executor node states transition in real time.
* **Live WebSocket Telemetry**: Stream cognitive trace events with severity color tags and duration metrics.
* **Dynamic JIT Tool Registry**: Inspect sandboxed code synthesized on the fly.
* **Interactive Goal Dispatcher**: Submit arbitrary goals or select pre-configured complex reasoning presets.

---

## 💻 Programmatic SDK Usage

```typescript
import { AetherKernel } from '@aether-flow/core';

// Initialize with Gemini, OpenAI, or zero-key Mock simulation
const kernel = new AetherKernel({
  provider: 'gemini', // or 'openai' | 'mock'
  apiKey: process.env.GEMINI_API_KEY,
  enableJitTools: true,
  maxDialecticRounds: 3
});

// Subscribe to real-time events
kernel.bus.subscribe((event) => {
  console.log(`[${event.agent || 'Kernel'}]:`, event.type, event.payload);
});

// Dispatch complex objective
const result = await kernel.executeGoal(
  'Analyze trailing 30-day volatility for Ethereum and compute value-at-risk (VaR)',
  { asset: 'ETH', confidenceInterval: 0.99 }
);

console.log('Result:', result.finalSynthesis);
console.log('Synthesized Tools:', result.synthesizedTools);
```

---

## 🛠️ CLI Reference

AetherFlow provides an interactive CLI:

```bash
# Run an autonomous goal
npx aether run "Audit smart contract reentrancy vulnerability"

# Directly synthesize and verify a tool in the sandbox
npx aether synth monte_carlo "Run 1,000 risk simulations"

# Start the standalone WebSocket telemetry stream
npx aether serve 4884

# Run built-in showcase
npx aether demo
```

---

## 🧩 Monorepo Structure

```text
aether-flow/
├── packages/
│   ├── core/                  # Core Microkernel, Event Bus, Agents & Sandbox
│   │   ├── src/kernel/        # CognitiveBus, AetherKernel
│   │   ├── src/agents/        # Architect, Critic, Synthesizer, Executor
│   │   ├── src/tools/         # ToolRegistry, ToolForge, Sandbox
│   │   ├── src/consensus/     # Hegelian Dialectic Consensus Engine
│   │   ├── src/providers/     # Gemini, OpenAI, MockProvider
│   │   └── src/telemetry/     # WebSocket Telemetry Server
│   ├── cli/                   # Interactive CLI (bin.ts)
│   └── web/                   # Visual Cognitive Canvas & Static Server
├── examples/
│   ├── 01-autonomous-researcher/
│   ├── 02-jit-tool-synthesis/
│   └── 03-financial-forecasting/
├── docs/                      # Deep-dive architecture guides & RFCs
├── .github/workflows/         # GitHub Actions CI/CD matrix
└── README.md
```

---

## 🧪 Running Tests

The test suite runs with Node's native test runner (zero external testing overhead):

```bash
npm test
```

---

## 🗺️ Roadmap

- [x] Autonomous Microkernel with Cognitive Event Bus
- [x] Just-In-Time (JIT) Dynamic Tool Synthesis in Sandboxed VM
- [x] Multi-Agent Hegelian Consensus Swarm
- [x] Zero-Key Offline Simulation Engine + Gemini / OpenAI Providers
- [x] Real-Time Visual WebSocket Canvas Dashboard
- [x] Interactive Command Line Interface
- [ ] Multi-Modal Perception Engine (Audio/Image streaming support)
- [ ] Distributed Swarm Clustering via Redis / NATS transport
- [ ] Python SDK Bindings (`aetherflow-py`)

---

## 📄 License

Distributed under the **Apache-2.0 License**. See [LICENSE](LICENSE) for details.

Made with 🌌 by [iRuSu67](https://github.com/iRuSu67) and the open source community.
