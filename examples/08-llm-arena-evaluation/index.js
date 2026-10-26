import { ArenaJudge } from '@aether-flow/core';

async function main() {
  console.log('⚔️ [Showcase 8]: Automated Multi-Model Arena & Elo Evaluation (LLM-as-a-Judge)\n');

  const arena = new ArenaJudge();

  console.log('Simulating tournament round 1: Complex algorithmic reasoning...');
  const match1 = arena.evaluateMatch(
    'Derive Byzantine Fault Tolerance threshold for asynchronous networks',
    'Google Gemini 1.5 Pro',
    'In an asynchronous system with n nodes, we require n >= 3f + 1 to guarantee safety and liveness...',
    95,
    'Claude 3.5 Sonnet',
    'Let f be faulty nodes. Messages can be delayed arbitrarily. We prove FLP impossibility...',
    110
  );

  console.log(`Match 1 Result: Winner is [${match1.winner}]`);
  console.log(`Verdict: ${match1.verdictExplanation}\n`);

  console.log('Simulating tournament round 2: Code security verification...');
  const match2 = arena.evaluateMatch(
    'Audit memory reentrancy bug in Solidity contract',
    'DeepSeek R1',
    'Checks-Effects-Interactions pattern must be enforced before external call...',
    80,
    'OpenAI GPT-4o',
    'Use ReentrancyGuard mutex modifier on withdraw() function...',
    105
  );

  console.log(`Match 2 Result: Winner is [${match2.winner}]\n`);

  console.log('🏆 Tournament Arena Leaderboard (Live Elo Ratings):');
  console.log('----------------------------------------------------');
  arena.getLeaderboard().forEach((competitor, i) => {
    console.log(`  #${i + 1} ${competitor.name.padEnd(30)} Elo: ${competitor.eloRating}  (W:${competitor.wins} L:${competitor.losses} T:${competitor.ties})`);
  });
  console.log('----------------------------------------------------');
}

main().catch(console.error);
