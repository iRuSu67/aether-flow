import readline from 'node:readline';
import { AetherKernel, CognitiveEvent } from '@aether-flow/core';

export async function startRepl() {
  const kernel = new AetherKernel({ provider: 'mock', enableJitTools: true });

  console.log('\x1b[36m\x1b[1m');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       🌌 AETHERFLOW INTERACTIVE COGNITIVE TERMINAL (REPL)      ║');
  console.log('║  Type any objective or slash commands: /mcts, /tools, /eval    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\x1b[0m');

  kernel.bus.subscribe((event: CognitiveEvent) => {
    if (event.severity === 'error') {
      console.log(`\x1b[31m[ERROR] [${event.agent || 'Kernel'}] ${event.type}\x1b[0m`);
    } else if (event.type === 'agent:consensus') {
      console.log(`\x1b[32m✔ [CONSENSUS] Score: ${event.payload.confidenceScore || event.payload.optimalValue || 'N/A'}\x1b[0m`);
    }
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\x1b[35m\x1b[1maether>\x1b[0m ',
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    if (input === '/exit' || input === 'exit') {
      console.log('\x1b[33mTerminating AetherFlow session...\x1b[0m');
      await kernel.stop();
      process.exit(0);
    }

    if (input === '/clear') {
      console.clear();
      rl.prompt();
      return;
    }

    if (input === '/tools') {
      const tools = kernel.registry.list();
      console.log(`\x1b[36mRegistered Tools (${tools.length}):\x1b[0m`);
      tools.forEach((t) => console.log(`  • \x1b[32m${t.name}\x1b[0m: ${t.description}`));
      rl.prompt();
      return;
    }

    if (input === '/eval') {
      console.log('\x1b[33mRunning head-to-head model arena match...\x1b[0m');
      const match = kernel.arena.evaluateMatch(
        'Prove Fermat-Euler Theorem',
        'Google Gemini 1.5 Pro',
        'Step-by-step modular arithmetic proof with inductive closure...',
        120,
        'OpenAI GPT-4o',
        'Direct proof via group theory Lagrange theorem...',
        145
      );
      console.log(`\x1b[32mWinner: ${match.winner}\x1b[0m (Verdict: ${match.verdictExplanation})`);
      rl.prompt();
      return;
    }

    if (input.startsWith('/mcts ')) {
      const goal = input.slice(6);
      console.log(`\x1b[34mExecuting Monte Carlo Tree Search for: "${goal}"...\x1b[0m`);
      const mcts = await kernel.searchMCTS(goal);
      console.log(`\x1b[32m✔ MCTS Completed in ${mcts.searchDurationMs.toFixed(1)}ms (${mcts.totalNodesExplored} nodes explored)\x1b[0m`);
      console.log('\x1b[36mOptimal Trajectory:\x1b[0m');
      mcts.bestTrajectory.forEach((step: string, i: number) => console.log(`  [Step ${i + 1}] ${step}`));
      rl.prompt();
      return;
    }

    if (input.startsWith('/audit ')) {
      const query = input.slice(7);
      const audit = kernel.firewall.auditInput(query);
      console.log(`Allowed: ${audit.allowed ? '\x1b[32mYES\x1b[0m' : '\x1b[31mNO (BLOCKED)\x1b[0m'} (Risk Score: ${audit.riskScore})`);
      if (audit.flaggedRules.length > 0) {
        console.log(`Flagged: ${audit.flaggedRules.join(', ')}`);
      }
      rl.prompt();
      return;
    }

    // Default: Dispatch as multi-agent swarm goal
    console.log(`\x1b[33mDispatching multi-agent swarm goal...\x1b[0m`);
    const res = await kernel.executeGoal(input);
    console.log(`\x1b[32m✔ Completed with ${(res.confidenceScore * 100).toFixed(1)}% consensus in ${res.executionTimeMs.toFixed(1)}ms\x1b[0m`);
    rl.prompt();
  });
}
