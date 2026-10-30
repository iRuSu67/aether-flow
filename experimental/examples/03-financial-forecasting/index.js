import { AetherKernel } from '@aether-flow/core';

async function run() {
  console.log('📈 [Showcase 3]: Financial Momentum & Volatility Forecasting Swarm');

  const kernel = new AetherKernel({ provider: 'mock' });

  const execution = await kernel.executeGoal(
    'Analyze trailing prices for NVDA and estimate momentum indicator',
    { ticker: 'NVDA', prices: [135.2, 138.4, 142.1, 140.8, 145.0, 149.2] }
  );

  console.log('\nSwarm Output:');
  console.log('Goal Status:', execution.success ? 'SUCCESS' : 'FAILED');
  console.log('Synthesized Tools:', execution.synthesizedTools);
  console.log('Hegelian Consensus Score:', (execution.confidenceScore * 100) + '%');
}

run().catch(console.error);
