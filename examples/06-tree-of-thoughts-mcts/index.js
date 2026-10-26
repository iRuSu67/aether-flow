import { AetherKernel } from '@aether-flow/core';

async function main() {
  console.log('🌳 [Showcase 6]: Monte Carlo Tree Search (MCTS) & Tree-of-Thoughts Reasoning\n');

  const kernel = new AetherKernel({ provider: 'mock' });

  const complexProblem = 'Derive zero-knowledge polynomial commitment scheme with logarithmic verifier overhead';
  console.log(`Target Challenge: "${complexProblem}"\n`);
  console.log('Running MCTS Search (Selection, Expansion, Rollout, Backpropagation with UCB1 exploration)...');

  const result = await kernel.searchMCTS(complexProblem);

  console.log('\n✔ MCTS Reasoning Convergence Achieved!');
  console.log(`Explored Nodes: ${result.totalNodesExplored}`);
  console.log(`Search Latency: ${result.searchDurationMs.toFixed(2)}ms`);
  console.log(`Average Value: ${(result.averageNodeValue * 100).toFixed(1)}%\n`);

  console.log('Optimal Decision Trajectory:');
  result.bestTrajectory.forEach((thought, i) => {
    console.log(`  [Depth ${i + 1}]: ${thought}`);
  });
}

main().catch(console.error);
