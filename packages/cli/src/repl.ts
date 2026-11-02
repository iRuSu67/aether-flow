import readline from 'node:readline';
import { AetherKernel, CognitiveEvent } from '@aether-flow/core';

// Automatically load local .env if present
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {}
}

function detectActiveProvider(): { provider: any; model: string; displayName: string; isLive: boolean } {
  if (process.env.PROVIDER) {
    return {
      provider: process.env.PROVIDER,
      model: process.env.MODEL || 'default',
      displayName: process.env.PROVIDER.toUpperCase(),
      isLive: true,
    };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: 'anthropic', model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet', displayName: 'Anthropic Claude', isLive: true };
  }
  if (process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
    return { provider: 'openai', model: process.env.OPENAI_MODEL || 'gpt-4o-mini', displayName: 'OpenAI', isLive: true };
  }
  if (process.env.DEEPSEEK_API_KEY) {
    return { provider: 'deepseek', model: 'deepseek-chat', displayName: 'DeepSeek', isLive: true };
  }
  if (process.env.GROQ_API_KEY) {
    return { provider: 'groq', model: 'llama-3.3-70b-versatile', displayName: 'Groq', isLive: true };
  }
  if (process.env.OLLAMA_BASE_URL) {
    return { provider: 'ollama', model: 'llama3.2', displayName: 'Ollama (Local)', isLive: true };
  }
  if (process.env.GEMINI_API_KEY) {
    return { provider: 'gemini', model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite', displayName: 'Google Gemini', isLive: true };
  }
  return { provider: 'mock', model: 'simulation', displayName: 'Offline Simulation Engine', isLive: false };
}
const detected = detectActiveProvider();
const activeProvider = detected.provider;
const activeModel = detected.model;
const hasKey = detected.isLive;

export async function startRepl() {
  const kernel = new AetherKernel({
    provider: activeProvider,
    apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY,
    modelName: activeModel,
    enableJitTools: true,
  });

  const modeBadge = hasKey
    ? `\x1b[32m[Active: Live ${detected.displayName} (${activeModel})]\x1b[0m`
    : `\x1b[33m[Active: Offline Simulation Engine]\x1b[0m`;

  console.log('\x1b[36m\x1b[1m');
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║               🌌 AETHERFLOW INTERACTIVE TERMINAL (REPL)                  ║');
  console.log('║      Type any math, data, or coding problem — or /help for guidance      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');
  console.log('\x1b[0m' + modeBadge + '\n');

  kernel.bus.subscribe((event: CognitiveEvent) => {
    if (event.severity === 'error') {
      console.log(`\x1b[31m[ERROR] [${event.agent || 'Kernel'}] ${event.type}\x1b[0m`);
    } else if (event.type === 'tool:executed') {
      const summary = typeof event.payload?.output === 'object' ? JSON.stringify(event.payload.output) : String(event.payload?.output || '');
      console.log(`\x1b[32m✔ [Tool Executed: ${event.payload?.toolName || 'tool'}]\x1b[0m \x1b[2m${summary.slice(0, 100)}\x1b[0m`);
    } else if (event.type === 'tool:synthesized') {
      console.log(`\x1b[35m🛠️ [Tool Synthesized in Sandbox]\x1b[0m \x1b[1m${event.payload?.toolName}\x1b[0m`);
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

    if (input === '/exit' || input === 'exit' || input === 'quit') {
      console.log('\x1b[33mTerminating AetherFlow session...\x1b[0m');
      await kernel.stop();
      process.exit(0);
    }

    if (input === '/clear' || input === 'clear') {
      console.clear();
      rl.prompt();
      return;
    }

    if (input === '/help' || input === 'help' || input === '?') {
      printReplHelp();
      rl.prompt();
      return;
    }

    if (input === '/tools') {
      const tools = kernel.registry.list();
      console.log(`\x1b[36m\x1b[1mRegistered Tools on the Shelf (${tools.length}):\x1b[0m`);
      tools.forEach((t) => {
        console.log(`  • \x1b[32m\x1b[1m${t.name}\x1b[0m: ${t.description}`);
      });
      console.log(`\x1b[2mTip: You can run any tool directly with: /exec <toolName> {"key": "value"}\x1b[0m\n`);
      rl.prompt();
      return;
    }

    if (input.startsWith('/exec ')) {
      const parts = input.slice(6).trim().split(/\s+(.*)/s);
      const toolName = parts[0];
      const rawArgs = parts[1] || '{}';

      if (!kernel.registry.has(toolName)) {
        console.log(`\x1b[31m✖ Tool "${toolName}" not found. Type /tools to view available tools.\x1b[0m\n`);
        rl.prompt();
        return;
      }

      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(rawArgs);
      } catch {
        args = { input: rawArgs };
      }

      console.log(`\x1b[33mExecuting "${toolName}" with input:\x1b[0m`, args);
      try {
        const output = await kernel.executor.runTool(toolName, args);
        console.log(`\x1b[32m\x1b[1m✔ Output Result:\x1b[0m`);
        console.log(typeof output === 'object' ? JSON.stringify(output, null, 2) : output);
        console.log();
      } catch (err) {
        console.log(`\x1b[31m✖ Execution failed:\x1b[0m`, err instanceof Error ? err.message : err);
      }
      rl.prompt();
      return;
    }

    if (input.startsWith('/synth ')) {
      const raw = input.slice(7).trim();
      const parts = raw.split(/\s+(.*)/s);
      const toolName = parts[0] || 'custom_calculator';
      const purpose = parts[1] || `Data computation and numeric analysis for ${toolName}`;

      console.log(`\x1b[33mSynthesizing JIT tool "${toolName}" in Docker sandbox...\x1b[0m`);
      const result = await kernel.synthesizeTool({
        toolName,
        purpose,
        inputSpecification: [{ name: 'input', type: 'object', description: 'Input data' }],
        expectedOutput: 'Computed numeric or structured analytic result',
      });

      if (result.success && result.tool) {
        console.log(`\x1b[32m✔ JIT Tool "${result.tool.name}" synthesized & verified in sandbox!\x1b[0m`);
        console.log(`\x1b[2mIterations: ${result.iterations} | Status: Ready in registry\x1b[0m\n`);
      } else {
        console.log(`\x1b[31m✖ Synthesis failed: ${result.error}\x1b[0m\n`);
      }
      rl.prompt();
      return;
    }

    if (input.startsWith('/audit ')) {
      const query = input.slice(7);
      const audit = kernel.firewall.auditInput(query);
      console.log(`Allowed: ${audit.allowed ? '\x1b[32mYES\x1b[0m' : '\x1b[31mNO (BLOCKED BY FIREWALL)\x1b[0m'} (Risk Score: ${audit.riskScore})`);
      if (audit.flaggedRules.length > 0) {
        console.log(`Flagged Security Rules: \x1b[33m${audit.flaggedRules.join(', ')}\x1b[0m`);
      }
      console.log();
      rl.prompt();
      return;
    }

    // Default: Dispatch natural language goal to multi-agent kernel
    console.log(`\x1b[33mDispatching goal to multi-agent engine...\x1b[0m`);
    const res = await kernel.executeGoal(input);

    // Print execution steps
    console.log('\n\x1b[1m\x1b[36m──────────────── Execution Steps ────────────────\x1b[0m');
    for (const step of res.plan.steps) {
      const icon = step.status === 'completed' ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✖\x1b[0m';
      console.log(`${icon} \x1b[1m[${step.agentRole}]\x1b[0m ${step.title}`);
      if (step.output) {
        const outStr = typeof step.output === 'object' ? JSON.stringify(step.output, null, 2) : String(step.output);
        const indented = outStr
          .split('\n')
          .map((l) => '    ' + l)
          .join('\n');
        console.log(`\x1b[2m${indented}\x1b[0m`);
      }
    }

    // Print final answer prominently!
    console.log('\n\x1b[1m\x1b[32m══════════════════════════════════════════════════════════════\x1b[0m');
    console.log('\x1b[1m\x1b[32m💡 FINAL RESULT / ANSWER:\x1b[0m');
    console.log('\x1b[1m\x1b[32m══════════════════════════════════════════════════════════════\x1b[0m');
    let answerStr = res.finalSynthesis;
    try {
      const parsed = JSON.parse(res.finalSynthesis);
      answerStr = JSON.stringify(parsed, null, 2);
    } catch {}
    console.log(`\x1b[1m${answerStr}\x1b[0m`);
    console.log('\x1b[1m\x1b[32m══════════════════════════════════════════════════════════════\x1b[0m');
    console.log(`\x1b[2mConsensus Score: ${(res.confidenceScore * 100).toFixed(1)}% | Time: ${res.executionTimeMs.toFixed(1)}ms | Tools: ${res.synthesizedTools.length > 0 ? res.synthesizedTools.join(', ') : 'standard'}\x1b[0m\n`);

    rl.prompt();
  });
}

function printReplHelp() {
  console.log(`
\x1b[1m\x1b[36m====================== AETHERFLOW USER GUIDE ======================\x1b[0m

\x1b[1m💡 HOW TO ASK QUESTIONS (Natural Language):\x1b[0m
  You do NOT need code. Just type your problem or calculation and hit Enter!
  The AI will synthesize any missing code, test it in Docker, and give you the answer.

  \x1b[1mExamples you can copy and paste:\x1b[0m
  • \x1b[33mCalculate the standard deviation and variance of numbers: 12, 45, 67, 89, 120\x1b[0m
  • \x1b[33mFind all prime numbers between 1 and 1000 and calculate their average\x1b[0m
  • \x1b[33mParse this text and extract all email addresses: contact support@corp.com\x1b[0m
  • \x1b[33mCalculate 3-year compound growth: start 50000, end 120000, years 3\x1b[0m

\x1b[1m🛠️ SLASH COMMANDS:\x1b[0m
  • \x1b[32m/tools\x1b[0m                        Show all currently registered tools on the shelf
  • \x1b[32m/synth <name> [purpose]\x1b[0m       Make the AI craft a new tool & test it in Docker
  • \x1b[32m/exec <toolName> [jsonArgs]\x1b[0m   Run any tool directly with your own input data
  • \x1b[32m/audit <text>\x1b[0m                 Test the firewall for prompt injections or secrets
  • \x1b[32m/help\x1b[0m                         Show this guide
  • \x1b[32m/clear\x1b[0m                        Clear the screen
  • \x1b[32m/exit\x1b[0m (or exit)               Quit this terminal

\x1b[1m===================================================================\x1b[0m
`);
}
