import { AetherKernel } from '@aether-flow/core';

async function run() {
  console.log('🔬 [Showcase 1]: Autonomous Multi-Agent Academic & Technical Research Swarm');

  const kernel = new AetherKernel({ provider: 'mock' });

  kernel.bus.subscribe((event) => {
    if (event.type === 'agent:debate' || event.type === 'agent:consensus') {
      console.log(`[Dialectic] ${event.agent}:`, event.payload);
    }
  });

  const report = await kernel.executeGoal(
    'Synthesize cross-sectional study on zero-knowledge succinct non-interactive arguments of knowledge (zk-SNARKs)'
  );

  console.log('\n✅ Research Swarm Completed!');
  console.log('Synthesized Confidence:', (report.confidenceScore * 100).toFixed(1) + '%');
  console.log('Generated Steps:', report.plan.steps.length);
}

run().catch(console.error);
