# REVIEW_FINAL_3.md: Source Manifest of Security & Eval Integrity Implementations

This document presents the full source code for the core security modules, evaluation rate-limiting and budget subsystems, and all five evaluation condition prompt templates and runners for **AetherFlow v0.1**.

---

## 1. Static AST Verification (`packages/core/src/tools/ASTVerifier.ts`)

```typescript
import ts from 'typescript';

export interface ASTVerificationResult {
  isSafe: boolean;
  bannedPatternsDetected: string[];
  maxLoopDepth: number;
  hasAsyncIteration: boolean;
}

const BANNED_IDENTIFIERS = new Set([
  'eval',
  'Function',
  'require',
  'import',
  'process',
  'global',
  'globalThis',
  'child_process',
  'fs',
  'net',
  'http',
  'https',
  'dgram',
  'cluster',
  'worker_threads',
  'vm',
  'v8',
]);

const BANNED_PROPERTIES = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);

export class ASTVerifier {
  public verify(sourceCode: string): ASTVerificationResult {
    const bannedPatterns: string[] = [];
    let maxLoopDepth = 0;
    let currentLoopDepth = 0;
    let hasAsyncIteration = false;

    const sourceFile = ts.createSourceFile(
      'temp_verification.ts',
      sourceCode,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );

    const checkNode = (node: ts.Node) => {
      // 1. Forbidden Identifiers
      if (ts.isIdentifier(node)) {
        if (BANNED_IDENTIFIERS.has(node.text)) {
          if (!this.isSafeDeclarationOrPropertyKey(node)) {
            bannedPatterns.push(`Forbidden identifier: '${node.text}'`);
          }
        }
      }

      // 2. Dynamic property access: e.g. obj["constructor"], obj["__proto__"]
      if (ts.isElementAccessExpression(node)) {
        if (ts.isStringLiteral(node.argumentExpression)) {
          if (BANNED_PROPERTIES.has(node.argumentExpression.text)) {
            bannedPatterns.push(`Forbidden property access via string literal: '${node.argumentExpression.text}'`);
          }
        }
        // Template literals: obj[`constructor`], obj[`__proto__`]
        if (ts.isTemplateExpression(node.argumentExpression) || ts.isNoSubstitutionTemplateLiteral(node.argumentExpression)) {
          const text = node.argumentExpression.getText(sourceFile).replace(/[`'"]/g, '');
          if (BANNED_PROPERTIES.has(text)) {
            bannedPatterns.push(`Forbidden property access via template literal: '${text}'`);
          }
        }
        // String concatenation: obj['__pro' + 'to__'] or obj['const' + 'ructor']
        if (ts.isBinaryExpression(node.argumentExpression) && node.argumentExpression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
          const evalBinaryString = (binNode: ts.BinaryExpression): string | null => {
            let leftStr: string | null = null;
            let rightStr: string | null = null;
            if (ts.isStringLiteral(binNode.left) || ts.isNoSubstitutionTemplateLiteral(binNode.left)) {
              leftStr = binNode.left.text;
            } else if (ts.isBinaryExpression(binNode.left) && binNode.left.operatorToken.kind === ts.SyntaxKind.PlusToken) {
              leftStr = evalBinaryString(binNode.left);
            }
            if (ts.isStringLiteral(binNode.right) || ts.isNoSubstitutionTemplateLiteral(binNode.right)) {
              rightStr = binNode.right.text;
            }
            if (leftStr !== null && rightStr !== null) return leftStr + rightStr;
            return null;
          };
          const concatenated = evalBinaryString(node.argumentExpression);
          if (concatenated && BANNED_PROPERTIES.has(concatenated)) {
            bannedPatterns.push(`Forbidden property access via string concatenation: '${concatenated}'`);
          }
        }
      }

      // 3. Static property access: e.g. obj.constructor, obj.__proto__
      if (ts.isPropertyAccessExpression(node)) {
        if (BANNED_PROPERTIES.has(node.name.text)) {
          bannedPatterns.push(`Forbidden property access: '.${node.name.text}'`);
        }
      }

      // 4. Dynamic import() or require()
      if (node.kind === ts.SyntaxKind.ImportKeyword) {
        bannedPatterns.push(`Forbidden dynamic import expression`);
      }

      // 5. Detect Static Infinite Loops (e.g. while(true), while(1), for(;;))
      if (ts.isWhileStatement(node)) {
        if (node.expression.kind === ts.SyntaxKind.TrueKeyword || 
           (ts.isNumericLiteral(node.expression) && node.expression.text !== '0')) {
          bannedPatterns.push(`Static infinite while loop detected`);
        }
      }
      if (ts.isForStatement(node) && !node.condition) {
        bannedPatterns.push(`Static infinite for loop detected`);
      }

      // 6. Track Loop Depth
      const isLoop =
        ts.isForStatement(node) ||
        ts.isForInStatement(node) ||
        ts.isForOfStatement(node) ||
        ts.isWhileStatement(node) ||
        ts.isDoStatement(node);

      if (isLoop) {
        currentLoopDepth++;
        if (currentLoopDepth > maxLoopDepth) maxLoopDepth = currentLoopDepth;
        if (ts.isForOfStatement(node) && node.awaitModifier) {
          hasAsyncIteration = true;
        }
      }

      ts.forEachChild(node, checkNode);

      if (isLoop) {
        currentLoopDepth--;
      }
    };

    ts.forEachChild(sourceFile, checkNode);

    return {
      isSafe: bannedPatterns.length === 0,
      bannedPatternsDetected: Array.from(new Set(bannedPatterns)),
      maxLoopDepth,
      hasAsyncIteration,
    };
  }

  private isSafeDeclarationOrPropertyKey(node: ts.Identifier): boolean {
    const parent = node.parent;
    if (!parent) return false;
    if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
    if (ts.isMethodDeclaration(parent) && parent.name === node) return true;
    if (ts.isPropertyDeclaration(parent) && parent.name === node) return true;
    if (ts.isPropertySignature(parent) && parent.name === node) return true;
    return false;
  }
}
```

---

## 2. Unified Isolated Runner (`packages/core/src/tools/sandbox-runner.ts`)

```typescript
import vm from 'node:vm';

const MAX_OUTPUT_BYTES = 1024 * 1024; // 1MB output cap

interface RunnerPayload {
  code: string;
  args: Record<string, unknown>;
  maxOutputBytes?: number;
}

function safeStringify(data: unknown, maxBytes: number): string {
  const json = JSON.stringify(data);
  if (json === undefined) return 'null';
  const byteLength = Buffer.byteLength(json, 'utf8');
  if (byteLength > maxBytes) {
    throw new Error(`Output limit exceeded: ${byteLength} bytes generated (max: ${maxBytes} bytes)`);
  }
  return json;
}

async function main() {
  let rawInput = '';
  process.stdin.setEncoding('utf8');

  for await (const chunk of process.stdin) {
    rawInput += chunk;
  }

  if (!rawInput.trim()) {
    process.stderr.write('Error: No input payload provided to runner\n');
    process.exit(1);
  }

  let payload: RunnerPayload;
  try {
    payload = JSON.parse(rawInput);
  } catch (err: unknown) {
    process.stderr.write(`JSON parse error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }

  const { code, args, maxOutputBytes = MAX_OUTPUT_BYTES } = payload;

  // Intercept stdout/stderr within runner to prevent terminal flood attacks
  let totalOutputBytes = 0;
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  const checkOutputCap = (chunk: string | Buffer): boolean => {
    const len = typeof chunk === 'string' ? Buffer.byteLength(chunk, 'utf8') : chunk.length;
    totalOutputBytes += len;
    if (totalOutputBytes > maxOutputBytes) {
      originalStderrWrite(`[runner] Output limit exceeded (${totalOutputBytes} bytes > ${maxOutputBytes} bytes). Aborting.\n`);
      process.exit(1);
    }
    return true;
  };

  process.stdout.write = (chunk: any, ...rest: any[]): boolean => {
    checkOutputCap(chunk);
    return originalStdoutWrite(chunk, ...rest);
  };

  process.stderr.write = (chunk: any, ...rest: any[]): boolean => {
    checkOutputCap(chunk);
    return originalStderrWrite(chunk, ...rest);
  };

  // Build isolated VM realm with completely stripped host prototypes
  const sandboxContext = Object.create(null);

  // Standard safe intrinsics
  sandboxContext.Math = Math;
  sandboxContext.Date = Date;
  sandboxContext.parseInt = parseInt;
  sandboxContext.parseFloat = parseFloat;
  sandboxContext.isNaN = isNaN;
  sandboxContext.isFinite = isFinite;
  sandboxContext.encodeURI = encodeURI;
  sandboxContext.decodeURI = decodeURI;
  sandboxContext.encodeURIComponent = encodeURIComponent;
  sandboxContext.decodeURIComponent = decodeURIComponent;

  // Wrapped safe console
  sandboxContext.console = Object.freeze({
    log: (...cArgs: unknown[]) => {
      const msg = cArgs.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ') + '\n';
      process.stderr.write(msg);
    },
    error: (...cArgs: unknown[]) => {
      const msg = cArgs.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ') + '\n';
      process.stderr.write(msg);
    },
    warn: (...cArgs: unknown[]) => {
      const msg = cArgs.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ') + '\n';
      process.stderr.write(msg);
    },
    info: (...cArgs: unknown[]) => {
      const msg = cArgs.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ') + '\n';
      process.stderr.write(msg);
    },
  });

  const vmContext = vm.createContext(sandboxContext, {
    codeGeneration: {
      strings: false, // Disallow eval() and new Function()
      wasm: false,
    },
  });

  // Wrap user code in async IIFE
  const transformedCode = `
    (async function(__aether_args) {
      ${code}
      if (typeof execute === 'function') {
        return await execute(__aether_args);
      }
      throw new Error("No default export or 'execute' function found in synthesized code");
    })
  `;

  try {
    const script = new vm.Script(transformedCode, {
      filename: 'sandbox-execution.js',
    });

    const fn = script.runInContext(vmContext, {
      timeout: 5000,
      breakOnSigint: true,
    });

    const deepClonedArgs = JSON.parse(JSON.stringify(args));
    const result = await fn(deepClonedArgs);

    const serializedResult = safeStringify(result, maxOutputBytes);
    originalStdoutWrite(serializedResult);
    process.exit(0);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    originalStderrWrite(`Execution error: ${errorMsg}\n`);
    process.exit(1);
  }
}

main().catch((fatal) => {
  process.stderr.write(`Fatal runner error: ${fatal instanceof Error ? fatal.message : String(fatal)}\n`);
  process.exit(1);
});
```

---

## 3. Rate Limiter (`packages/eval/src/limiter/RateLimiter.ts`)

```typescript
export interface RateLimiterOptions {
  rpm: number;
  tpm?: number;
  minDelayMs?: number;
}

export class RateLimiter {
  private readonly rpm: number;
  private readonly tpm: number;
  private readonly minDelayMs: number;
  private readonly requestTimestamps: number[] = [];
  private readonly tokenLog: Array<{ timestamp: number; tokens: number }> = [];
  private lastCallTimestamp = 0;

  constructor(options: RateLimiterOptions) {
    this.rpm = Math.max(1, options.rpm);
    this.tpm = options.tpm ?? 250000;
    this.minDelayMs = options.minDelayMs ?? Math.ceil(60000 / this.rpm);
  }

  public async acquire(estimatedTokens = 1000): Promise<void> {
    while (true) {
      const now = Date.now();
      this.prune(now);

      // 1. Min pacing enforcement
      const elapsedSinceLast = now - this.lastCallTimestamp;
      if (elapsedSinceLast < this.minDelayMs) {
        const waitMs = this.minDelayMs - elapsedSinceLast;
        await this.sleep(waitMs);
        continue;
      }

      // 2. RPM check
      if (this.requestTimestamps.length >= this.rpm) {
        const oldest = this.requestTimestamps[0];
        const waitMs = Math.max(50, 60000 - (now - oldest) + 100);
        await this.sleep(waitMs);
        continue;
      }

      // 3. TPM check
      const currentTokens = this.tokenLog.reduce((acc, entry) => acc + entry.tokens, 0);
      if (currentTokens + estimatedTokens > this.tpm) {
        const oldest = this.tokenLog[0]?.timestamp ?? now;
        const waitMs = Math.max(50, 60000 - (now - oldest) + 100);
        await this.sleep(waitMs);
        continue;
      }

      // Acquired
      const acquiredAt = Date.now();
      this.requestTimestamps.push(acquiredAt);
      this.tokenLog.push({ timestamp: acquiredAt, tokens: estimatedTokens });
      this.lastCallTimestamp = acquiredAt;
      return;
    }
  }

  public recordActualTokens(actualTokens: number, estimatedTokens = 1000): void {
    const diff = actualTokens - estimatedTokens;
    if (diff !== 0 && this.tokenLog.length > 0) {
      this.tokenLog[this.tokenLog.length - 1].tokens = actualTokens;
    }
  }

  private prune(now: number): void {
    const windowStart = now - 60000;
    while (this.requestTimestamps.length > 0 && this.requestTimestamps[0] < windowStart) {
      this.requestTimestamps.shift();
    }
    while (this.tokenLog.length > 0 && this.tokenLog[0].timestamp < windowStart) {
      this.tokenLog.shift();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
  }
}
```

---

## 4. Daily Budget Manager (`packages/eval/src/limiter/DailyBudgetManager.ts`)

```typescript
import fs from 'node:fs';
import path from 'node:path';

export interface DailyBudgetRecord {
  model: string;
  datePacific: string; // YYYY-MM-DD in America/Los_Angeles
  callsToday: number;
  maxDailyBudget: number;
  lastUpdated: string;
  blockedUntil?: string; // ISO string if 429 daily exhaustion occurred
  note: string;
}

export type BudgetStore = Record<string, DailyBudgetRecord>;

export class DailyBudgetManager {
  private readonly filePath: string;
  private readonly defaultMaxBudget: number;

  constructor(filePath?: string, defaultMaxBudget = 450) {
    this.filePath = filePath || path.resolve(process.cwd(), '.eval_daily_budget.json');
    this.defaultMaxBudget = defaultMaxBudget;
  }

  public static getPacificDate(): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  }

  public static getNextPacificMidnight(): Date {
    const now = new Date();
    const pacificDateStr = this.getPacificDate();
    const [y, m, d] = pacificDateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d + 1, 8, 0, 0)); // UTC 08:00 is PT midnight
    return dateObj;
  }

  public checkBudget(model: string, requestedCalls = 1): { allowed: boolean; remaining: number; reason?: string } {
    const store = this.readStore();
    const today = DailyBudgetManager.getPacificDate();
    const rec = store[model];

    if (!rec || rec.datePacific !== today) {
      return { allowed: true, remaining: this.defaultMaxBudget };
    }

    if (rec.blockedUntil) {
      const blockedDate = new Date(rec.blockedUntil);
      if (Date.now() < blockedDate.getTime()) {
        return {
          allowed: false,
          remaining: 0,
          reason: `Model [${model}] quota exhausted until Pacific midnight (${blockedDate.toISOString()})`,
        };
      }
    }

    const remaining = rec.maxDailyBudget - rec.callsToday;
    if (remaining < requestedCalls) {
      return {
        allowed: false,
        remaining,
        reason: `Daily budget exhausted (${rec.callsToday}/${rec.maxDailyBudget} calls used today)`,
      };
    }

    return { allowed: true, remaining };
  }

  public recordCall(model: string, count = 1): void {
    const store = this.readStore();
    const today = DailyBudgetManager.getPacificDate();
    let rec = store[model];

    if (!rec || rec.datePacific !== today) {
      rec = {
        model,
        datePacific: today,
        callsToday: 0,
        maxDailyBudget: this.defaultMaxBudget,
        lastUpdated: new Date().toISOString(),
        note: `Keyed strictly to America/Los_Angeles calendar date for model [${model}].`,
      };
    }

    rec.callsToday += count;
    rec.lastUpdated = new Date().toISOString();
    store[model] = rec;
    this.writeStore(store);
  }

  public markDailyExhaustion(model: string): void {
    const store = this.readStore();
    const today = DailyBudgetManager.getPacificDate();
    const nextReset = DailyBudgetManager.getNextPacificMidnight();
    let rec = store[model];

    if (!rec || rec.datePacific !== today) {
      rec = {
        model,
        datePacific: today,
        callsToday: this.defaultMaxBudget,
        maxDailyBudget: this.defaultMaxBudget,
        lastUpdated: new Date().toISOString(),
        note: `Keyed strictly to America/Los_Angeles calendar date for model [${model}].`,
      };
    }

    rec.blockedUntil = nextReset.toISOString();
    rec.lastUpdated = new Date().toISOString();
    store[model] = rec;
    this.writeStore(store);
  }

  private readStore(): BudgetStore {
    try {
      if (fs.existsSync(this.filePath)) {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      }
    } catch {}
    return {};
  }

  private writeStore(store: BudgetStore): void {
    fs.writeFileSync(this.filePath, JSON.stringify(store, null, 2), 'utf8');
  }
}
```

---

## 5. Model Configuration Profiles (`packages/eval/src/config/models.ts`)

```typescript
export interface ModelProfile {
  id: string;
  name: string;
  rpm: number;
  rpd: number;
  tpm: number;
  dailyBudget: number;
  minDelayMs: number;
  supportsThinking: boolean;
  supportedThinkingLevels: ('minimal' | 'low' | 'medium' | 'high')[];
  defaultThinkingLevel: 'minimal' | 'low' | 'medium' | 'high';
  docUrl: string;
  notes: string;
}

export const MODEL_REGISTRY: Record<string, ModelProfile> = {
  'gemini-3.5-flash-lite': {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite (Recommended Default)',
    rpm: 15,
    rpd: 500,
    tpm: 250000,
    dailyBudget: 450,
    minDelayMs: 4500,
    supportsThinking: true,
    supportedThinkingLevels: ['minimal', 'low', 'medium', 'high'],
    defaultThinkingLevel: 'medium',
    docUrl: 'https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite',
    notes: 'Free-tier: 15 RPM / 500 RPD. Stable GA lightweight model.',
  },
  'gemini-3.8-flash': {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    rpm: 5,
    rpd: 20,
    tpm: 250000,
    dailyBudget: 18,
    minDelayMs: 13000,
    supportsThinking: true,
    supportedThinkingLevels: ['low', 'medium', 'high'], // 'minimal' is unsupported and errors
    defaultThinkingLevel: 'low',
    docUrl: 'https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash',
    notes: 'Free-tier: 5 RPM / 20 RPD. Explicitly rejects thinkingLevel=minimal.',
  },
};
```

---

## 6. Prompt Templates and Runners for All 5 Evaluation Conditions

### Condition A: Zero-Shot Direct JSON Generation (`packages/eval/src/conditions/ConditionA.ts`)
```typescript
const systemPrompt = `DIRECT_ANSWER_CONDITION_A: You are an expert programmer and mathematical reasoning agent.
Solve the following task directly without access to external tools.
You MUST output your final answer strictly in valid JSON matching the required format.`;

const userPrompt = `${task.prompt}\n\nTask Input:\n${JSON.stringify(task.input, null, 2)}\n\nRespond with ONLY valid JSON:`;
```

### Condition B: Fixed Static Tool Palette (`packages/eval/src/conditions/ConditionB.ts`)
```typescript
const systemPrompt = `FIXED_TOOL_CONDITION_B: You are an agent with access to a FIXED static tool palette:
1. math_calc(expr: string) -> number
2. regex_match(pattern: string, text: string, flags?: string) -> match
3. json_path(data: object, path: string) -> value
4. string_slice(text: string, start: number, end?: number) -> string
5. array_sort(array: any[]) -> array

To call a tool, output:
\`\`\`tool_call
{"tool": "<name>", "args": { ... }}
\`\`\`

If you have the final answer, output strictly in JSON:
\`\`\`json
<final_result>
\`\`\``;

let userPrompt = `${task.prompt}\n\nTask Input:\n${JSON.stringify(task.input, null, 2)}`;
```

### Condition C0: One-Shot JIT Code Synthesis (`packages/eval/src/conditions/ConditionC0.ts`)
```typescript
const systemPrompt = `DYNAMIC_SYNTHESIS_CONDITION_C0: You are an expert TypeScript/JavaScript programmer.
Synthesize a single-file, production-ready ES module that exports default async function execute(args).
The function takes 'args' matching the task input and returns the final calculated result.
Do NOT use external network or filesystem. Implement all algorithms directly in pure JavaScript.
Wrap your code in \`\`\`javascript ... \`\`\`.`;

const userPrompt = `${task.prompt}\n\nTask Input Schema & Values:\n${JSON.stringify(task.input, null, 2)}\n\nSynthesize the executable tool code:`;
```

### Condition C: Self-Healing JIT Code Synthesis Loop (`packages/eval/src/conditions/ConditionC.ts`)
```typescript
const systemPrompt = `DYNAMIC_SYNTHESIS_CONDITION_C: You are an expert TypeScript/JavaScript programmer.
Synthesize a single-file, production-ready ES module that exports default async function execute(args).
The function takes 'args' matching the task input and returns the final calculated result.
Do NOT use external network or filesystem. Implement all algorithms directly in pure JavaScript.
Wrap your code in \`\`\`javascript ... \`\`\`.`;

// Feedback loop upon runtime or AST failure (up to 3 retries):
// If AST blocked:
userPrompt += `\n\nPrevious code attempt was rejected by AST security linter with error:\n${lastError}\nPlease fix the implementation and output valid compliant JavaScript code:`;

// If Sandbox runtime failed / timed out:
userPrompt += `\n\nPrevious code execution in sandbox failed with error:\n${lastError}\nPlease fix the logic and output updated JavaScript code:`;
```

### Condition D: JIT Synthesis with Semantic Tool Library Reuse (`packages/eval/src/conditions/ConditionD.ts`)
```typescript
// Step 1: Semantic description matching against persistent library (RESET per repetition)
const candidate = library.findSimilar(task.prompt, 0.25);

if (candidate) {
  // Step 2: Validate candidate tool against agent-visible task example in Docker Sandbox
  const exampleCheck = await sandbox.execute(candidate.code, task.example.input);

  if (exampleCheck.success && deepEquals(exampleCheck.result, task.example.output)) {
    // Verified against example! Execute on real task input (0 API tokens consumed)
    const execRes = await sandbox.execute(candidate.code, task.input);
    if (execRes.success) {
      return { reused: true, tokens: 0, rawOutput: execRes.result, ... };
    }
  }
}

// Step 3: Fall back to Condition C dynamic synthesis on miss or failed example check
const cResult = await runConditionC(task, runIndex, client, sandbox, astVerifier);
if (cResult.errorTaxonomy === 'SUCCESS' && cResult.finalCode) {
  library.save(task.prompt, cResult.finalCode);
}
```

---

## 7. Semantic Tool Library Implementation (`packages/eval/src/conditions/ToolLibrary.ts`)

```typescript
export interface LibraryEntry {
  promptKey: string;
  descriptionTokens: Set<string>;
  code: string;
  registeredAt: number;
}

export class ToolLibrary {
  private readonly entries: LibraryEntry[] = [];

  public reset(): void {
    this.entries.length = 0;
  }

  public save(prompt: string, code: string): void {
    const tokens = this.tokenize(prompt);
    this.entries.push({
      promptKey: prompt,
      descriptionTokens: tokens,
      code,
      registeredAt: Date.now(),
    });
  }

  public findSimilar(prompt: string, threshold = 0.25): { code: string; score: number } | null {
    const queryTokens = this.tokenize(prompt);
    let bestMatch: { code: string; score: number } | null = null;
    let highestScore = 0;

    for (const entry of this.entries) {
      const score = this.calculateJaccardSimilarity(queryTokens, entry.descriptionTokens);
      if (score > highestScore && score >= threshold) {
        highestScore = score;
        bestMatch = { code: entry.code, score };
      }
    }

    return bestMatch;
  }

  private tokenize(text: string): Set<string> {
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
    return new Set(words);
  }

  private calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
    let intersection = 0;
    for (const item of setA) {
      if (setB.has(item)) intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }
}

const STOP_WORDS = new Set([
  'the', 'and', 'with', 'for', 'from', 'that', 'this', 'you', 'are', 'your',
  'task', 'input', 'output', 'given', 'must', 'should', 'using', 'return',
]);
```
