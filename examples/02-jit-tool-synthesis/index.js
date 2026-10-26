import { AetherKernel } from '@aether-flow/core';

async function run() {
  console.log('⚡ [Showcase 2]: Just-In-Time (JIT) Dynamic Tool Synthesis & Sandbox Verification');

  const kernel = new AetherKernel({ provider: 'mock' });

  console.log('\n1. Requesting dynamic synthesis of a custom mathematical variance tool...');
  
  const synthResult = await kernel.synthesizeTool({
    toolName: 'statistical_variance_engine',
    purpose: 'Compute variance and standard deviation for real-time asset pricing arrays',
    inputSpecification: [
      { name: 'numbers', type: 'array', description: 'Array of floating point prices' }
    ],
    expectedOutput: 'Calculated variance and standard deviation metrics'
  });

  if (synthResult.success && synthResult.tool) {
    console.log('✔ Synthesis succeeded in sandbox!');
    console.log('Synthesized code snippet:\n', synthResult.code);

    console.log('\n2. Executing dynamically registered tool with test array [12, 15, 18, 20, 25, 30]...');
    const testExecution = await kernel.executor.runTool('statistical_variance_engine', {
      numbers: [12, 15, 18, 20, 25, 30]
    });

    console.log('Tool execution result:', testExecution);
  } else {
    console.error('Synthesis failed:', synthResult.error);
  }
}

run().catch(console.error);
