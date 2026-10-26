import { AetherKernel } from '../index.js';

async function main() {
  console.log('⚡ Initializing AetherFlow Autonomous Microkernel...');

  const kernel = new AetherKernel({
    provider: 'mock', // Instant zero-key simulation
    enableJitTools: true,
  });

  // Listen to live cognitive event stream
  kernel.bus.subscribe((event) => {
    const time = new Date(event.timestamp).toLocaleTimeString();
    const agentTag = event.agent ? `[${event.agent}]` : '[Kernel]';
    console.log(`[${time}] ${agentTag} (${event.type}):`, JSON.stringify(event.payload));
  });

  console.log('\n🚀 Dispatching Goal: "Synthesize high-frequency arbitrage risk model and calculate volatility metrics"');
  
  const result = await kernel.executeGoal(
    'Synthesize high-frequency arbitrage risk model and calculate volatility metrics',
    { baseTicker: 'BTC/USD', volatilityWindow: 30 }
  );

  console.log('\n================ EXECUTION REPORT ================');
  console.log(`🎯 Goal: ${result.goal}`);
  console.log(`✅ Success: ${result.success}`);
  console.log(`📊 Consensus Confidence Score: ${(result.confidenceScore * 100).toFixed(1)}%`);
  console.log(`⏱️ Duration: ${result.executionTimeMs.toFixed(1)}ms`);
  console.log(`🛠️ Synthesized Dynamic Tools:`, result.synthesizedTools);
  console.log(`📜 Total Cognitive Events:`, result.traceEventsCount);
  console.log('==================================================\n');

  await kernel.stop();
}

main().catch(console.error);
