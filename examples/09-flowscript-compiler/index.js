import { AetherKernel } from '@aether-flow/core';

async function main() {
  console.log('📜 [Showcase 9]: Declarative FlowScript (.flow) DSL Compilation & Execution\n');

  const kernel = new AetherKernel({ provider: 'mock' });

  const flowScript = `
    swarm AutonomousCyberDefense {
      agent Architect role = orchestrator model = "gemini-1.5-pro"
      agent RedTeamer role = critic model = "claude-3.5-sonnet"
      agent Synthesizer role = synthesizer model = "deepseek-r1"
      pipeline {
        Architect("Map attack surface") -> RedTeamer("Probe vulnerabilities") -> Synthesizer("Deploy zero-day patch")
      }
    }
  `;

  console.log('Compiling FlowScript source:');
  console.log(flowScript);

  const execution = await kernel.compileFlowScript(flowScript, 'Host Target: api.internal.cluster:8443');

  console.log('\n✔ FlowScript Execution Succeeded!');
  console.log(`Swarm Name: ${execution.swarmName}`);
  console.log(`Total Pipeline Steps: ${execution.stepOutputs.length}`);
  console.log(`Execution Time: ${execution.durationMs.toFixed(2)}ms\n`);

  console.log('Step Execution Trace:');
  execution.stepOutputs.forEach((step, i) => {
    console.log(`  [Step ${i + 1}] Agent: ${step.agent} (${step.action || 'Default Action'})`);
    console.log(`     Output: ${step.output.slice(0, 80)}...\n`);
  });
}

main().catch(console.error);
