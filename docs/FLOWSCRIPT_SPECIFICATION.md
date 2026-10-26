# FlowScript Language Specification (.flow)

FlowScript is the declarative domain-specific orchestration language of AetherFlow. It enables systems engineers and AI researchers to specify multi-agent swarm topologies, model routing, and execution pipelines concisely.

---

## 1. Formal Grammar (EBNF)

```ebnf
Program        ::= "swarm" Identifier "{" Declaration* "}"
Declaration    ::= AgentDecl | PipelineDecl | ChannelDecl

AgentDecl      ::= "agent" Identifier ("role" "=" Identifier)? ("model" "=" String)?
PipelineDecl   ::= "pipeline" "{" Step ("->" Step)* "}"
Step           ::= Identifier ("(" String? ")")?
ChannelDecl    ::= "channel" Identifier ("timeout" "=" Number "ms")?
```

---

## 2. Syntax Example

```flow
swarm AlgorithmicArbitrage {
  # Declare Swarm Members
  agent MarketArchitect role = orchestrator model = "gemini-1.5-pro"
  agent RiskAuditor role = critic model = "claude-3.5-sonnet"
  agent QuantSynthesizer role = synthesizer model = "deepseek-r1"

  # Define Execution Sequence
  pipeline {
    MarketArchitect("Analyze depth book") 
      -> RiskAuditor("Stress-test margin limits") 
      -> QuantSynthesizer("Synthesize high-frequency arbitrage tool")
  }
}
```

---

## 3. Compilation & Execution Pipeline

```text
[FlowScript Source]
        │
        ▼
[FlowScriptLexer]        ──> Tokens (SWARM, AGENT, IDENTIFIER, ARROW...)
        │
        ▼
[FlowScriptParser]       ──> SwarmProgramAST (Strongly Typed AST)
        │
        ▼
[FlowScriptInterpreter]  ──> Dispatches across AetherKernel microkernel agents
```
