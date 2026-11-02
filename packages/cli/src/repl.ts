import readline from 'node:readline';
import {
  AetherKernel,
  CognitiveEvent,
  AnthropicProvider,
  GeminiProvider,
  OpenAIProvider,
  MockProvider,
} from '@aether-flow/core';

// Automatically load local .env if present
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {}
}

function formatSimpleModelName(model: string): string {
  const m = (model || '').trim().toLowerCase();
  if (m.includes('gemini')) {
    if (m.includes('2.0')) return 'gemini 2.0 flash';
    if (m.includes('1.5-pro')) return 'gemini 1.5 pro';
    if (m.includes('1.5')) return 'gemini 1.5 flash';
    if (m.includes('3.5') || m.includes('flash')) return 'gemini 3.5 flash';
    return 'gemini';
  }
  if (m.includes('claude') || m.includes('fable') || m.includes('mythos') || m.includes('anthropic')) {
    if (m.includes('fable')) return 'claude fable';
    if (m.includes('mythos')) return 'claude mythos';
    if (m.includes('sonnet')) return 'claude sonnet';
    if (m.includes('haiku')) return 'claude haiku';
    if (m.includes('opus')) return 'claude opus';
    return 'claude';
  }
  if (m.includes('gpt') || m.includes('openai') || m.startsWith('o1') || m.startsWith('o3')) {
    if (m.includes('4o-mini')) return 'gpt-4o mini';
    if (m.includes('4o')) return 'gpt-4o';
    if (m.includes('o1-mini')) return 'o1 mini';
    if (m.includes('o1')) return 'o1';
    if (m.includes('o3-mini')) return 'o3 mini';
    if (m.includes('o3')) return 'o3';
    return m.replace(/-/g, ' ');
  }
  if (m.includes('deepseek')) {
    if (m.includes('r1')) return 'deepseek r1';
    if (m.includes('coder')) return 'deepseek coder';
    return 'deepseek';
  }
  if (m.includes('llama')) {
    if (m.includes('3.3')) return 'llama 3.3';
    if (m.includes('3.2')) return 'llama 3.2';
    if (m.includes('3.1')) return 'llama 3.1';
    return 'llama';
  }
  if (m.includes('simulation') || m.includes('mock')) return 'offline simulation';
  return model.replace(/[-_]/g, ' ');
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
    return {
      provider: 'anthropic',
      model: process.env.ANTHROPIC_MODEL || process.env.MODEL || 'claude-fable-5',
      displayName: 'Anthropic Claude',
      isLive: true,
    };
  }
  if (process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
    return {
      provider: 'openai',
      model: process.env.OPENAI_MODEL || process.env.MODEL || 'gpt-4o-mini',
      displayName: 'OpenAI',
      isLive: true,
    };
  }
  if (process.env.DEEPSEEK_API_KEY) {
    return {
      provider: 'deepseek',
      model: process.env.DEEPSEEK_MODEL || process.env.MODEL || 'deepseek-chat',
      displayName: 'DeepSeek',
      isLive: true,
    };
  }
  if (process.env.GROQ_API_KEY) {
    return {
      provider: 'groq',
      model: process.env.GROQ_MODEL || process.env.MODEL || 'llama-3.3-70b-versatile',
      displayName: 'Groq',
      isLive: true,
    };
  }
  if (process.env.OLLAMA_BASE_URL) {
    return {
      provider: 'ollama',
      model: process.env.OLLAMA_MODEL || process.env.MODEL || 'llama3.2',
      displayName: 'Ollama (Local)',
      isLive: true,
    };
  }
  if (process.env.GEMINI_API_KEY) {
    return {
      provider: 'gemini',
      model: process.env.GEMINI_MODEL || process.env.MODEL || 'gemini-3.5-flash-lite',
      displayName: 'Google Gemini',
      isLive: true,
    };
  }
  return {
    provider: 'mock',
    model: 'simulation-engine',
    displayName: 'Offline Simulation Engine',
    isLive: false,
  };
}

const detected = detectActiveProvider();
const activeProvider = detected.provider;
const activeModel = detected.model;
const hasKey = detected.isLive;

export async function startRepl() {
  const kernel = new AetherKernel({
    provider: activeProvider,
    apiKey:
      process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.DEEPSEEK_API_KEY ||
      process.env.GROQ_API_KEY ||
      process.env.GEMINI_API_KEY,
    modelName: activeModel,
    enableJitTools: true,
  });

  const modeBadge = hasKey
    ? `\x1b[32m[${formatSimpleModelName(activeModel)}]\x1b[0m`
    : `\x1b[33m[offline simulation]\x1b[0m`;

  console.log('\x1b[36m\x1b[1m');
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║               AETHERFLOW INTERACTIVE TERMINAL (REPL)                  ║');
  console.log('║      Type any math, data, or coding problem — or /help for guidance      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');
  console.log('\x1b[0m' + modeBadge + '\n');

  kernel.bus.subscribe((event: CognitiveEvent) => {
    if (event.severity === 'error') {
      console.log(`\x1b[31m[ERROR] [${event.agent || 'Kernel'}] ${event.type}\x1b[0m`);
    } else if (event.type === 'tool:executed') {
      const summary =
        typeof event.payload?.output === 'object'
          ? JSON.stringify(event.payload.output)
          : String(event.payload?.output || '');
      console.log(
        `\x1b[32m✔ [Tool Executed: ${event.payload?.toolName || 'tool'}]\x1b[0m \x1b[2m${summary.slice(0, 100)}\x1b[0m`
      );
    } else if (event.type === 'tool:synthesized') {
      console.log(`\x1b[35m[Tool Synthesized in Sandbox]\x1b[0m \x1b[1m${event.payload?.toolName}\x1b[0m`);
    }
  });

  // Tab auto-completion for commands, models, and registered tools
  function completer(line: string): [string[], string] {
    const commands = [
      '/help',
      '/model',
      '/tools',
      '/code',
      '/synth',
      '/exec',
      '/examples',
      '/audit',
      '/clear',
      '/exit',
    ];

    if (line.startsWith('/exec ') || line.startsWith('/code ') || line.startsWith('/inspect ')) {
      const prefix = line.startsWith('/exec ') ? '/exec ' : line.startsWith('/inspect ') ? '/inspect ' : '/code ';
      const sub = line.slice(prefix.length).trim();
      const toolNames = kernel.registry.list().map((t) => t.name);
      const hits = toolNames.filter((n) => n.startsWith(sub)).map((n) => prefix + n);
      return [hits.length ? hits : toolNames.map((n) => prefix + n), line];
    }

    if (line.startsWith('/model ')) {
      const sub = line.slice(7).trim();
      const modelSuggestions = [
        'gemini-3.5-flash-lite',
        'gemini-2.0-flash',
        'claude-fable-5',
        'claude-fable',
        'claude-3-5-sonnet',
        'gpt-4o',
        'gpt-4o-mini',
        'deepseek-chat',
        'deepseek-r1',
        'llama-3.3-70b-versatile',
        'llama3.2',
      ];
      const hits = modelSuggestions.filter((m) => m.startsWith(sub)).map((m) => '/model ' + m);
      return [hits.length ? hits : modelSuggestions.map((m) => '/model ' + m), line];
    }

    const hits = commands.filter((c) => c.startsWith(line));
    return [hits.length ? hits : commands, line];
  }

  function getPromptString(): string {
    return `\x1b[35m\x1b[1maether\x1b[0m \x1b[2m[${formatSimpleModelName(kernel.getModel())}]\x1b[0m\x1b[1m>\x1b[0m `;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer,
    prompt: getPromptString(),
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

    if (input === '/examples' || input === 'examples') {
      printExamples();
      rl.prompt();
      return;
    }

    // Inspect or switch models
    if (input.startsWith('/model')) {
      const targetModel = input.slice(6).trim();
      if (!targetModel) {
        printModelStatus(kernel);
        rl.prompt();
        return;
      }

      // Check which provider this model belongs to:
      const lower = targetModel.toLowerCase();
      let matchedProvider = 'gemini';
      let requiredKey = 'GEMINI_API_KEY';
      let isKeyAvailable = Boolean(process.env.GEMINI_API_KEY);

      if (
        lower.includes('claude') ||
        lower.includes('fable') ||
        lower.includes('mythos') ||
        lower.includes('anthropic')
      ) {
        matchedProvider = 'anthropic';
        requiredKey = 'ANTHROPIC_API_KEY';
        isKeyAvailable = Boolean(process.env.ANTHROPIC_API_KEY);
      } else if (
        lower.includes('gpt') ||
        lower.includes('o1') ||
        lower.includes('o3') ||
        lower.includes('openai') ||
        lower.includes('davinci')
      ) {
        matchedProvider = 'openai';
        requiredKey = 'OPENAI_API_KEY';
        isKeyAvailable = Boolean(process.env.OPENAI_API_KEY);
      } else if (lower.includes('deepseek')) {
        matchedProvider = 'deepseek';
        requiredKey = 'DEEPSEEK_API_KEY';
        isKeyAvailable = Boolean(process.env.DEEPSEEK_API_KEY);
      } else if (lower.includes('groq')) {
        matchedProvider = 'groq';
        requiredKey = 'GROQ_API_KEY';
        isKeyAvailable = Boolean(process.env.GROQ_API_KEY);
      } else if (lower.includes('ollama') || lower.includes('qwen') || lower.includes('mistral')) {
        matchedProvider = 'ollama';
        requiredKey = 'OLLAMA_BASE_URL';
        isKeyAvailable = true;
      } else if (lower.includes('gemini')) {
        matchedProvider = 'gemini';
        requiredKey = 'GEMINI_API_KEY';
        isKeyAvailable = Boolean(process.env.GEMINI_API_KEY);
      }

      // Automatically switch the provider instance to match the model
      if (matchedProvider === 'anthropic') {
        kernel.setProvider(new AnthropicProvider(process.env.ANTHROPIC_API_KEY, targetModel));
      } else if (matchedProvider === 'openai') {
        kernel.setProvider(new OpenAIProvider(process.env.OPENAI_API_KEY, targetModel));
      } else if (matchedProvider === 'deepseek') {
        kernel.setProvider(
          new OpenAIProvider(process.env.DEEPSEEK_API_KEY, targetModel, 'https://api.deepseek.com/v1')
        );
      } else if (matchedProvider === 'groq') {
        kernel.setProvider(
          new OpenAIProvider(process.env.GROQ_API_KEY, targetModel, 'https://api.groq.com/openai/v1')
        );
      } else if (matchedProvider === 'ollama') {
        kernel.setProvider(
          new OpenAIProvider(
            'ollama',
            targetModel,
            process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1'
          )
        );
      } else if (matchedProvider === 'gemini') {
        kernel.setProvider(new GeminiProvider(process.env.GEMINI_API_KEY, targetModel));
      }

      kernel.setModel(targetModel);
      rl.setPrompt(getPromptString());

      if (!isKeyAvailable) {
        console.log(`\n\x1b[33mWarning: ${requiredKey} is not set in your .env file.\x1b[0m`);
        console.log(
          `\x1b[2mSwitched model to "${targetModel}" (${kernel.provider.name}), but live calls require ${requiredKey}.\x1b[0m`
        );
        console.log(`\x1b[2mType /model to see which providers are currently online!\x1b[0m\n`);
      } else {
        console.log(
          `\n\x1b[32m✔ Active model:\x1b[0m \x1b[1m${formatSimpleModelName(targetModel)}\x1b[0m\n`
        );
      }

      rl.prompt();
      return;
    }

    if (input === '/tools') {
      const tools = kernel.registry.list();
      console.log(`\x1b[36m\x1b[1mRegistered Tools on the Shelf (${tools.length}):\x1b[0m`);
      tools.forEach((t) => {
        const badge = t.isSynthesized ? '\x1b[35m[JIT]\x1b[0m' : '\x1b[32m[Core]\x1b[0m';
        console.log(`  • ${badge} \x1b[1m${t.name}\x1b[0m: ${t.description}`);
      });
      console.log(`\x1b[2mTip: Inspect code with /code <toolName>  |  Run with /exec <toolName> {"key": "val"}\x1b[0m\n`);
      rl.prompt();
      return;
    }

    // Inspect the JavaScript code of any tool
    if (input.startsWith('/code ') || input.startsWith('/inspect ')) {
      const toolName = input.replace(/^\/(code|inspect)\s+/, '').trim();
      const tool = kernel.registry.get(toolName);
      if (!tool) {
        console.log(`\x1b[31m✖ Tool "${toolName}" not found. Type /tools to view available tools.\x1b[0m\n`);
        rl.prompt();
        return;
      }
      console.log(`\n\x1b[1m\x1b[36m====================== TOOL INSPECTOR: ${tool.name} ======================\x1b[0m`);
      console.log(`\x1b[1mDescription:\x1b[0m ${tool.description}`);
      console.log(
        `\x1b[1mType:\x1b[0m        ${tool.isSynthesized ? '\x1b[35mDynamic JIT Synthesized Tool\x1b[0m' : '\x1b[32mStandard Built-in Core Tool\x1b[0m'}`
      );
      console.log(`\x1b[1mParameters:\x1b[0m  ${JSON.stringify(tool.parameters)}`);

      if (tool.synthesizedCode) {
        console.log(`\n\x1b[1m\x1b[33mVerified JavaScript Code (Executing in Docker Sandbox):\x1b[0m`);
        console.log('\x1b[2m────────────────────────────────────────────────────────────────────────────────\x1b[0m');
        console.log(`\x1b[36m${tool.synthesizedCode}\x1b[0m`);
        console.log('\x1b[2m────────────────────────────────────────────────────────────────────────────────\x1b[0m\n');
      } else {
        console.log(`\x1b[2m(Native built-in handler compiled in @aether-flow/core)\x1b[0m\n`);
      }

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

      console.log(`\x1b[33mExecuting "${toolName}" in Docker sandbox with input:\x1b[0m`, args);
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
        console.log(`\x1b[2mIterations: ${result.iterations} | Status: Ready in registry\x1b[0m`);
        console.log(`\x1b[2mTip: Inspect the code the AI wrote with: /code ${result.tool.name}\x1b[0m\n`);
      } else {
        console.log(`\x1b[31m✖ Synthesis failed: ${result.error}\x1b[0m\n`);
      }
      rl.prompt();
      return;
    }

    if (input.startsWith('/audit ')) {
      const query = input.slice(7);
      const audit = kernel.firewall.auditInput(query);
      console.log(
        `Allowed: ${audit.allowed ? '\x1b[32mYES\x1b[0m' : '\x1b[31mNO (BLOCKED BY FIREWALL)\x1b[0m'} (Risk Score: ${audit.riskScore})`
      );
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
        const outStr =
          typeof step.output === 'object' ? JSON.stringify(step.output, null, 2) : String(step.output);
        const indented = outStr
          .split('\n')
          .map((l) => '    ' + l)
          .join('\n');
        console.log(`\x1b[2m${indented}\x1b[0m`);
      }
    }

    // Print final answer prominently!
    console.log('\n\x1b[1m\x1b[32m══════════════════════════════════════════════════════════════\x1b[0m');
    console.log('\x1b[1m\x1b[32mFINAL RESULT / ANSWER:\x1b[0m');
    console.log('\x1b[1m\x1b[32m══════════════════════════════════════════════════════════════\x1b[0m');
    let answerStr = res.finalSynthesis;
    try {
      const parsed = JSON.parse(res.finalSynthesis);
      answerStr = JSON.stringify(parsed, null, 2);
    } catch {}
    console.log(`\x1b[1m${answerStr}\x1b[0m`);
    console.log('\x1b[1m\x1b[32m══════════════════════════════════════════════════════════════\x1b[0m');
    console.log(
      `\x1b[2mConsensus Score: ${(res.confidenceScore * 100).toFixed(1)}% | Time: ${res.executionTimeMs.toFixed(1)}ms | Tools: ${res.synthesizedTools.length > 0 ? res.synthesizedTools.join(', ') : 'standard'}\x1b[0m\n`
    );

    rl.prompt();
  });
}

function printModelStatus(kernel: AetherKernel) {
  const currentModel = kernel.getModel();
  const currentProv = kernel.provider.name;

  const providers = [
    {
      name: 'Google Gemini',
      keyEnv: 'GEMINI_API_KEY',
      hasKey: Boolean(process.env.GEMINI_API_KEY),
      models: 'gemini-3.5-flash-lite, gemini-2.0-flash, gemini-1.5-pro',
    },
    {
      name: 'Anthropic Claude',
      keyEnv: 'ANTHROPIC_API_KEY',
      hasKey: Boolean(process.env.ANTHROPIC_API_KEY),
      models: 'claude-fable-5, claude-fable, claude-3-5-sonnet, claude-3-5-haiku',
    },
    {
      name: 'OpenAI',
      keyEnv: 'OPENAI_API_KEY',
      hasKey: Boolean(process.env.OPENAI_API_KEY),
      models: 'gpt-4o, gpt-4o-mini, o1, o3-mini',
    },
    {
      name: 'DeepSeek',
      keyEnv: 'DEEPSEEK_API_KEY',
      hasKey: Boolean(process.env.DEEPSEEK_API_KEY),
      models: 'deepseek-chat, deepseek-r1, deepseek-coder',
    },
    {
      name: 'Groq',
      keyEnv: 'GROQ_API_KEY',
      hasKey: Boolean(process.env.GROQ_API_KEY),
      models: 'llama-3.3-70b-versatile, mixtral-8x7b-32768',
    },
    {
      name: 'Ollama (Local)',
      keyEnv: 'OLLAMA_BASE_URL',
      hasKey: Boolean(process.env.OLLAMA_BASE_URL || true),
      models: 'llama3.2, qwen2.5-coder, mistral, deepseek-r1:8b',
    },
    {
      name: 'Offline Simulator',
      keyEnv: 'None (Built-in)',
      hasKey: true,
      models: 'simulation-engine',
    },
  ];

  console.log('\n\x1b[1m\x1b[36m============================== MODEL & API STATUS ==============================\x1b[0m');
  console.log(`\x1b[1mCURRENT ACTIVE:\x1b[0m \x1b[32m\x1b[1m${currentProv}\x1b[0m -> \x1b[33m\x1b[1m${currentModel}\x1b[0m\n`);

  console.log(
    `\x1b[1m${'PROVIDER'.padEnd(20)} ${'STATUS'.padEnd(16)} ${'AVAILABLE MODELS / EXAMPLES'}\x1b[0m`
  );
  console.log('\x1b[2m────────────────────────────────────────────────────────────────────────────────\x1b[0m');

  for (const p of providers) {
    const isOnline = p.hasKey;
    const statusText = isOnline
      ? `\x1b[32m[ONLINE]\x1b[0m`
      : `\x1b[31m[NO KEY]\x1b[0m \x1b[2m(${p.keyEnv})\x1b[0m`;

    const isActive =
      currentModel &&
      p.models.toLowerCase().includes(currentModel.toLowerCase());
    const marker = isActive ? '\x1b[33m> \x1b[0m' : '   ';

    console.log(
      `${marker}\x1b[1m${p.name.padEnd(17)}\x1b[0m ${statusText.padEnd(28)} \x1b[2m${p.models}\x1b[0m`
    );
  }

  console.log('\x1b[2m────────────────────────────────────────────────────────────────────────────────\x1b[0m');
  console.log(`\x1b[1mTo switch to any model:\x1b[0m \x1b[36m/model <model_name>\x1b[0m`);
  console.log(`\x1b[2mExamples:\x1b[0m`);
  console.log(`  • \x1b[33m/model gemini-3.5-flash-lite\x1b[0m  (Google Gemini)`);
  console.log(`  • \x1b[33m/model claude-fable-5\x1b[0m         (Anthropic Claude Fable)`);
  console.log(`  • \x1b[33m/model gpt-4o\x1b[0m                 (OpenAI)`);
  console.log(`  • \x1b[33m/model deepseek-r1\x1b[0m            (DeepSeek)`);
  console.log('\x1b[1m\x1b[36m================================================================================\x1b[0m\n');
}

function printExamples() {
  console.log(`
\x1b[1m\x1b[36m========================= PRESET EXAMPLES TO TRY =========================\x1b[0m
\x1b[2mCopy and paste any of these directly into the aether> prompt:\x1b[0m

\x1b[1m1. Statistics & Data Variance:\x1b[0m
   \x1b[33mCalculate the standard deviation and variance of numbers: 12, 45, 67, 89, 120\x1b[0m

\x1b[1m2. Financial Portfolio CAGR:\x1b[0m
   \x1b[33mCalculate 3-year compound growth: start 50000, end 120000, years 3\x1b[0m

\x1b[1m3. High-Speed Prime Factorization:\x1b[0m
   \x1b[33mFind all prime numbers between 1 and 1000 and calculate their average\x1b[0m

\x1b[1m4. Regex Pattern Extraction:\x1b[0m
   \x1b[33mParse this text and extract all email addresses: contact support@corp.com or sales@store.org\x1b[0m

\x1b[1m5. Security Injection Firewall Audit:\x1b[0m
   \x1b[33m/audit export API_KEY="AIzaSySecretFakeApiKey12345678901234"\x1b[0m

\x1b[1m6. Inspect Synthesized Code:\x1b[0m
   \x1b[33m/code calculate_rolling_cagr\x1b[0m

\x1b[1m===========================================================================\x1b[0m
`);
}

function printReplHelp() {
  console.log(`
\x1b[1m\x1b[36m====================== AETHERFLOW USER GUIDE ======================\x1b[0m

\x1b[1mHOW TO ASK QUESTIONS (Natural Language):\x1b[0m
  You do NOT need code. Just type your problem or calculation and hit Enter!
  The AI will synthesize any missing code, test it in Docker, and give you the answer.

  \x1b[1mUniversal Model Support:\x1b[0m Works with ANY model (Claude Fable, Mythos, GPT-4o/5, Gemini, DeepSeek, Groq, Ollama).
  \x1b[1mQuick Examples Menu:\x1b[0m Type \x1b[33m/examples\x1b[0m to see 5 ready-to-run scenarios.

\x1b[1mSLASH COMMANDS (Press Tab to auto-complete):\x1b[0m
  • \x1b[32m/model\x1b[0m                        Show all models, providers, and their [ONLINE]/OFFLINE status
  • \x1b[32m/model <name>\x1b[0m                 Switch to ANY model (e.g. /model claude-fable-5, /model gpt-4o)
  • \x1b[32m/tools\x1b[0m                        Show all currently registered tools on the shelf
  • \x1b[32m/code <toolName>\x1b[0m              Inspect the real JavaScript code the AI wrote
  • \x1b[32m/synth <name> [purpose]\x1b[0m       Make the AI craft a new tool & test it in Docker
  • \x1b[32m/exec <toolName> [jsonArgs]\x1b[0m   Run any tool directly with your own input data
  • \x1b[32m/examples\x1b[0m                     Show copy-pasteable example scenarios
  • \x1b[32m/audit <text>\x1b[0m                 Test the firewall for prompt injections or secrets
  • \x1b[32m/help\x1b[0m                         Show this guide
  • \x1b[32m/clear\x1b[0m                        Clear the screen
  • \x1b[32m/exit\x1b[0m (or exit)               Quit this terminal

\x1b[1m===================================================================\x1b[0m
`);
}
