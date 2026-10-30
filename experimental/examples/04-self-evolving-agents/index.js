import { AetherKernel } from '@aether-flow/core';

async function main() {
  console.log('🧬 [Showcase 4]: DSPy-Style Genetic Prompt Optimization & Self-Evolution\n');

  const kernel = new AetherKernel({ provider: 'mock' });

  const initialPrompt = 'Analyze financial statements and flag solvency risk.';
  const domainObjective = 'High-precision algorithmic credit risk underwriting';

  console.log('Initial Base Prompt:');
  console.log(`"${initialPrompt}"\n`);
  console.log('Running genetic evolution across 3 generations (mutation, crossover, Pareto selection)...');

  const evolution = await kernel.evolution.optimize(initialPrompt, domainObjective);

  console.log('\n✔ Optimization Complete!');
  console.log(`Best Fitness Score: ${evolution.bestCandidate.fitnessScore.toFixed(1)}/100`);
  console.log(`Improvement: +${evolution.improvementPercentage}%\n`);
  console.log('Evolved System Prompt:');
  console.log('----------------------------------------------------');
  console.log(evolution.bestCandidate.prompt);
  console.log('----------------------------------------------------');
}

main().catch(console.error);
