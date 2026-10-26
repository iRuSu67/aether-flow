#!/usr/bin/env node
import { AetherKernel, CognitiveEvent } from '@aether-flow/core';
import { startRepl } from './repl.js';

// ANSI color helpers
const c = {
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
};

const BANNER = `
${c.cyan('   ___        __  __              _____ _                 ')}
${c.cyan('  / _ \\____  / /_/ /_  ___  _____/ __/ (_)___ _    __     ')}
${c.cyan(' / ___/ __ \\/ __/ __ \\/ _ \\/ ___/ /_ / / __ \\ | /| / /     ')}
${c.cyan('/_/  /_/ /_/\\__/_/ /_/\\___/_/  /_/  /_/\\___/ |/ |/        ')}
${c.dim('Autonomous Multi-Agent Microkernel & Cognitive Engine v1.0.0')}
`;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log(BANNER);

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    printHelp();
    return;
  }

  if (command === 'run') {
    const goal = args.slice(1).join(' ') || 'Autonomous architectural code review and security audit';
    await runGoal(goal);
  } else if (command === 'repl' || command === 'interactive') {
    await startRepl();
  } else if (command === 'synth') {
    const toolName = args[1] || 'statistical_calc';
    const purpose = args.slice(2).join(' ') || 'Calculate statistical distributions';
    await runSynth(toolName, purpose);
  } else if (command === 'serve') {
    const port = Number(args[1]) || 4884;
    await runServe(port);
  } else if (command === 'demo') {
    await runGoal('Deconstruct quantum state matrix and calculate entanglement entropy');
  } else {
    console.log(c.red(`Unknown command: ${command}`));
    printHelp();
  }
}

function printHelp() {
  console.log(`
${c.bold('USAGE:')}
  ${c.cyan('aether')} ${c.yellow('<command>')} [options]

${c.bold('COMMANDS:')}
  ${c.yellow('run <goal>')}              Execute an autonomous multi-agent goal with Hegelian debate
  ${c.yellow('synth <name> <purpose>')}  Directly synthesize and sandbox-verify a dynamic JIT tool
  ${c.yellow('serve [port]')}            Start the real-time WebSocket telemetry engine (default: 4884)
  ${c.yellow('demo')}                    Run end-to-end multi-agent demonstration with mock provider
  ${c.yellow('help')}                    Display this command reference

${c.bold('EXAMPLES:')}
  ${c.dim('$')} aether run "Analyze NASDAQ top 10 tickers and estimate covariance"
  ${c.dim('$')} aether synth monte_carlo "Run 1000 portfolio simulations"
  ${c.dim('$')} aether serve 4884
`);
}

async function runGoal(goal: string) {
  console.log(c.bold(`🎯 Target Goal:`), c.cyan(goal));
  console.log(c.dim('Initializing AetherFlow microkernel...\n'));

  const kernel = new AetherKernel({
    provider: (process.env.PROVIDER as any) || (process.env.GEMINI_API_KEY ? 'gemini' : 'mock'),
    apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY,
    enableJitTools: true,
  });

  kernel.bus.subscribe((event: CognitiveEvent) => {
    const timestamp = c.dim(`[${new Date(event.timestamp).toLocaleTimeString()}]`);
    let agentBadge = c.magenta(`[Kernel]`);
    if (event.agent) agentBadge = c.blue(`[${event.agent}]`);

    let icon = '•';
    if (event.severity === 'success') icon = c.green('✔');
    else if (event.severity === 'warn') icon = c.yellow('▲');
    else if (event.severity === 'error') icon = c.red('✖');

    console.log(`${timestamp} ${icon} ${agentBadge} ${c.bold(event.type)}`);
    if (event.payload && Object.keys(event.payload).length > 0) {
      const summary = JSON.stringify(event.payload);
      console.log(`    ${c.dim(summary.length > 140 ? summary.slice(0, 140) + '...' : summary)}`);
    }
  });

  const res = await kernel.executeGoal(goal);

  console.log('\n' + c.green('✔ Goal Execution Complete'));
  console.log(c.dim('----------------------------------------------------'));
  console.log(`${c.bold('Status:')}             ${c.green('SUCCESS')}`);
  console.log(`${c.bold('Confidence Score:')}   ${c.yellow((res.confidenceScore * 100).toFixed(1) + '%')}`);
  console.log(`${c.bold('Execution Time:')}     ${c.cyan(res.executionTimeMs.toFixed(1) + 'ms')}`);
  console.log(`${c.bold('Synthesized Tools:')} ${res.synthesizedTools.length > 0 ? c.magenta(res.synthesizedTools.join(', ')) : c.dim('None (used standard tools)')}`);
  console.log(`${c.bold('Cognitive Events:')}  ${c.cyan(String(res.traceEventsCount))}`);
  console.log(c.dim('----------------------------------------------------'));

  await kernel.stop();
}

async function runSynth(toolName: string, purpose: string) {
  console.log(c.bold(`🛠️ Synthesizing JIT Tool:`), c.cyan(toolName));
  console.log(c.dim(`Purpose: ${purpose}\n`));

  const kernel = new AetherKernel({ provider: 'mock' });

  const result = await kernel.synthesizeTool({
    toolName,
    purpose,
    inputSpecification: [{ name: 'data', type: 'array', description: 'Input data set' }],
    expectedOutput: 'Calculated analytic output',
  });

  if (result.success && result.tool) {
    console.log(c.green('✔ JIT Tool Synthesized & Verified in Sandbox!'));
    console.log(`Iterations: ${result.iterations}\n`);
    console.log(c.bold('Generated Code:'));
    console.log(c.dim('----------------------------------------------------'));
    console.log(c.cyan(result.code || ''));
    console.log(c.dim('----------------------------------------------------'));
  } else {
    console.log(c.red('✖ Synthesis failed:'), result.error);
  }

  await kernel.stop();
}

async function runServe(port: number) {
  const kernel = new AetherKernel({ provider: 'mock' });
  const activePort = await kernel.startTelemetry(port);
  console.log(c.green(`✔ AetherFlow Telemetry Engine live on ws://localhost:${activePort}`));
  console.log(c.dim('Ready to stream cognitive telemetry events to web canvas or monitor.'));
  console.log(c.dim('Press Ctrl+C to terminate server.'));

  process.on('SIGINT', async () => {
    console.log('\nShutting down server...');
    await kernel.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(c.red('Fatal error:'), err);
  process.exit(1);
});
