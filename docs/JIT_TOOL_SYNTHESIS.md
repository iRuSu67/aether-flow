# Just-In-Time (JIT) Dynamic Tool Synthesis

In traditional agent systems (LangChain, CrewAI, AutoGen), agents are strictly limited to the tools manually defined by developers prior to execution. If an agent needs a function to calculate a Black-Scholes option price, parse a unique log format, or compute matrix eigenvectors, and that tool was not hardcoded upfront, the agent fails.

AetherFlow solves this fundamental limitation with **JIT Tool Synthesis**.

---

## The Synthesis Lifecycle

```
[Agent Subtask]
       │
       ▼
 [Tool Exists?] ──── YES ───► [Execute in Runtime]
       │
      NO
       ▼
[ToolForge Synthesis] ───► Generates isolated JS/TS handler
       │
       ▼
[Fortified Sandbox]  ───► Runs sample assertions in isolated VM
       │
    Passed?
   ┌───┴───┐
  YES      NO
   │        │
   │        ▼
   │   [Self-Healing Loop] (Feeds stack trace back, retries)
   ▼
[Dynamic Tool Registration]
   │
   ▼
[Execution & Output Capture]
```

---

## Example: On-The-Fly Tool Creation

```typescript
import { AetherKernel } from '@aether-flow/core';

const kernel = new AetherKernel();

// Request dynamic synthesis of a tool not pre-programmed into the system
const synth = await kernel.synthesizeTool({
  toolName: 'correlation_matrix_generator',
  purpose: 'Compute Pearson correlation matrix across N price series',
  inputSpecification: [
    { name: 'seriesA', type: 'array', description: 'First price series' },
    { name: 'seriesB', type: 'array', description: 'Second price series' }
  ],
  expectedOutput: 'Normalized correlation coefficient between -1.0 and 1.0'
});

console.log('Synthesized code:', synth.code);
// Tool is now immediately available in the kernel:
const output = await kernel.executor.runTool('correlation_matrix_generator', {
  seriesA: [10, 11, 12, 13, 14],
  seriesB: [20, 22, 24, 26, 28]
});
```
