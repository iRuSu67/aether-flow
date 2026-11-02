#!/usr/bin/env node
import { AetherKernel, CognitiveEvent } from '@aether-flow/core';
import { startRepl } from './repl.js';

// Automatically load local .env if present
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {}
}

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

const hasKey = Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);
const activeProvider = (process.env.PROVIDER as any) || (process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : 'mock');
const activeModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

const BANNER = `
${c.cyan('   ___        __  __              _____ _                 ')}
${c.cyan('  / _ \\____  / /_/ /_  ___  _____/ __/ (_)___ _    __     ')}
${c.cyan(' / ___/ __ \\/ __/ __ \\/ _ \\/ ___/ /_ / / __ \\ | /| / /     ')}
${c.cyan('/_/  /_/ /_/\\__/_/ /_/\\___/_/  /_/  /_/\\___/ |/ |/        ')}
${c.dim(`Autonomous Multi-Agent Microkernel & JIT Sandbox Engine v0.1.0`)}
${c.dim(`[Mode: ${hasKey ? c.green(`Live ${activeProvider.toUpperCase()} (${activeModel})`) : c.yellow('Offline Simulation Engine')}]`)}
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
    const goal = args.slice(1).join(' ') || 'Calculate statistical distributions';
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
  ${c.cyan('npm run cli --')} ${c.yellow('<command>')} [options]

${c.bold('COMMANDS:')}
  ${c.yellow('repl')}                    Launch the interactive terminal (type any question or goal)
  ${c.yellow('run "<goal>"')}             Execute an autonomous goal, build needed tools, and print the answer
  ${c.yellow('synth <name> [purpose]')}   Synthesize and sandbox-verify a dynamic JIT tool
  ${c.yellow('serve [port]')}             Start the real-time WebSocket telemetry server (default: 4884)
  ${c.yellow('help')}                     Display this command guide

${c.bold('EXAMPLES WHAT TO TYPE:')}
  ${c.dim('# Interactive session (recommended):')}
  ${c.green('npm run cli -- repl')}

  ${c.dim('# Single math / algorithm goals:')}
  ${c.green('npm run cli -- run "Calculate the standard deviation and variance of numbers: 12, 45, 67, 89, 120"')}
  ${c.green('npm run cli -- run "Find all prime numbers between 1 and 1000 and calculate their average"')}
  ${c.green('npm run cli -- run "Parse text and extract all email addresses: contact support@corp.com"')}

  ${c.dim('# Synthesize a specific tool directly:')}
  ${c.green('npm run cli -- synth prime_checker "Checks if a number is prime and lists nearest primes"')}
`);
}

async function runGoal(goal: string) {
  console.log(c.bold(`🎯 Target Goal:`), c.cyan(goal));
  console.log(c.dim('Initializing AetherFlow microkernel...\n'));

  const kernel = new AetherKernel({
    provider: activeProvider,
    apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY,
    modelName: activeModel,
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

  console.log('\n' + c.bold(c.cyan('──────────────── Execution Steps ────────────────')));
  for (const step of res.plan.steps) {
    const icon = step.status === 'completed' ? c.green('✔') : c.red('✖');
    console.log(`${icon} ${c.bold(`[${step.agentRole}]`)} ${step.title}`);
    if (step.output) {
      const outStr = typeof step.output === 'object' ? JSON.stringify(step.output, null, 2) : String(step.output);
      const indented = outStr.split('\n').map((l) => '    ' + l).join('\n');
      console.log(c.dim(indented));
    }
  }

  console.log('\n' + c.green('✔ Goal Execution Complete'));
  console.log(c.dim('----------------------------------------------------'));
  console.log(`${c.bold('Status:')}             ${c.green('SUCCESS')}`);
  console.log(`${c.bold('Confidence Score:')}   ${c.yellow((res.confidenceScore * 100).toFixed(1) + '%')}`);
  console.log(`${c.bold('Execution Time:')}     ${c.cyan(res.executionTimeMs.toFixed(1) + 'ms')}`);
  console.log(`${c.bold('Synthesized Tools:')} ${res.synthesizedTools.length > 0 ? c.magenta(res.synthesizedTools.join(', ')) : c.dim('None (used standard tools)')}`);
  console.log(`${c.bold('Cognitive Events:')}  ${c.cyan(String(res.traceEventsCount))}`);
  console.log(c.dim('----------------------------------------------------'));

  console.log('\n' + c.bold(c.cyan('════════════════════════════════════════════════════════')));
  console.log(c.bold(c.green('💡 FINAL RESULT / ANSWER:')));
  console.log(c.bold(c.cyan('════════════════════════════════════════════════════════')));
  let answerStr = res.finalSynthesis;
  try {
    const parsed = JSON.parse(res.finalSynthesis);
    answerStr = JSON.stringify(parsed, null, 2);
  } catch {}
  console.log(c.bold(answerStr));
  console.log(c.bold(c.cyan('════════════════════════════════════════════════════════\n')));

  await kernel.stop();
}

async function runSynth(toolName: string, purpose: string) {
  console.log(c.bold(`🛠️ Synthesizing JIT Tool:`), c.cyan(toolName));
  console.log(c.dim(`Purpose: ${purpose}\n`));

  const kernel = new AetherKernel({
    provider: activeProvider,
    apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY,
    modelName: activeModel,
  });

  const result = await kernel.synthesizeTool({
    toolName,
    purpose,
    inputSpecification: [{ name: 'input', type: 'object', description: 'Input data' }],
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
