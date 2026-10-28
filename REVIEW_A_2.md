# Checkpoint A Verification Report: Part 2 (Full Source)

This document contains the unedited source code of the security core files and the GitHub Actions CI workflow for Checkpoint A.

---

## 1. `packages/core/src/tools/Sandbox.ts`

```typescript
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ExecutionResult } from '../types.js';
import { ASTVerifier } from './ASTVerifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SandboxOptions {
  timeoutMs?: number;
  maxMemoryMb?: number;
  maxOutputBytes?: number;
  mode?: 'docker' | 'subprocess';
  unsafeDevMode?: boolean;
}

export interface DockerRunOptions {
  containerName?: string;
  network?: string | null;
  readOnly?: boolean;
  user?: string | null;
  securityOpt?: string[];
  maxMemoryMb?: number;
  cpus?: string;
  pidsLimit?: number | null;
  capDrop?: string[];
  image?: string;
  dockerRunnerPath?: string;
  customArgs?: string[];
}

export const PINNED_NODE_IMAGE =
  'node:lts-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53';

/**
 * Builds the exact docker run argument list for sandboxed execution.
 */
export function buildDockerArgs(options: DockerRunOptions = {}): string[] {
  const containerName =
    options.containerName || `aether-sandbox-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const maxMemoryMb = options.maxMemoryMb ?? 64;
  const image = options.image ?? PINNED_NODE_IMAGE;

  const args = [
    'run',
    '--name',
    containerName,
    '--rm',
    '-i',
  ];

  if (options.network !== undefined) {
    if (options.network !== null && options.network !== '') {
      args.push('--network', options.network);
    }
  } else {
    args.push('--network', 'none');
  }

  if (options.readOnly !== false) {
    args.push('--read-only');
  }

  if (options.user !== undefined) {
    if (options.user !== null && options.user !== '') {
      args.push('--user', options.user);
    }
  } else {
    args.push('--user', 'node');
  }

  if (options.securityOpt !== undefined) {
    for (const opt of options.securityOpt) {
      args.push('--security-opt', opt);
    }
  } else {
    args.push('--security-opt', 'no-new-privileges');
  }

  args.push(`--memory=${maxMemoryMb}m`);
  args.push(`--memory-swap=${maxMemoryMb}m`);
  args.push(`--cpus=${options.cpus ?? '1.0'}`);

  if (options.pidsLimit !== undefined) {
    if (options.pidsLimit !== null && options.pidsLimit > 0) {
      args.push(`--pids-limit=${options.pidsLimit}`);
    }
  } else {
    args.push('--pids-limit=64');
  }

  if (options.capDrop !== undefined) {
    for (const cap of options.capDrop) {
      args.push(`--cap-drop=${cap}`);
    }
  } else {
    args.push('--cap-drop=ALL');
  }

  if (options.dockerRunnerPath) {
    args.push('-v', `${options.dockerRunnerPath}:/sandbox/runner.cjs:ro`);
  }

  args.push(image);

  if (options.customArgs && options.customArgs.length > 0) {
    args.push(...options.customArgs);
  } else {
    args.push('node', '--disallow-code-generation-from-strings', '/sandbox/runner.cjs');
  }

  return args;
}

/**
 * Execution sandbox for running dynamically synthesized tools.
 *
 * Supported isolation modes:
 * - 'docker' (Fail-closed default for untrusted code in production):
 *   Runs in a hardened container with --network none, --read-only, --memory 64m,
 *   --cpus 1.0, --pids-limit 64, --cap-drop ALL, and non-root user.
 * - 'subprocess' (Insecure development mode; requires unsafeDevMode: true):
 *   Runs in a local Node child process with clean env, memory limits, and disabled string code generation.
 *   NOTICE: Subprocess mode does NOT provide OS-level network isolation!
 */
export class Sandbox {
  public readonly timeoutMs: number;
  public readonly maxMemoryMb: number;
  public readonly maxOutputBytes: number;
  public readonly mode: 'docker' | 'subprocess';
  public readonly unsafeDevMode: boolean;
  public lastContainerName?: string;

  constructor(options?: number | SandboxOptions, maxMemoryMb?: number) {
    if (typeof options === 'number') {
      this.timeoutMs = options;
      this.maxMemoryMb = maxMemoryMb ?? 64;
      this.maxOutputBytes = 1024 * 1024; // 1 MB
      this.mode = 'docker';
      this.unsafeDevMode = false;
    } else {
      this.timeoutMs = options?.timeoutMs ?? 5000;
      this.maxMemoryMb = options?.maxMemoryMb ?? 64;
      this.maxOutputBytes = options?.maxOutputBytes ?? 1024 * 1024;
      this.mode = options?.mode ?? 'docker';
      this.unsafeDevMode = options?.unsafeDevMode ?? false;

      if (this.mode === 'subprocess') {
        if (!this.unsafeDevMode) {
          throw new Error('Subprocess mode requires explicit opt-in: { unsafeDevMode: true }');
        }
        console.warn(
          '[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!'
        );
      }
    }
  }

  /**
   * Execute code in the configured sandbox mode with AST pre-verification
   */
  async execute(code: string, args: Record<string, unknown> = {}): Promise<ExecutionResult> {
    const ast = ASTVerifier.verify(code);
    if (!ast.isSafe) {
      return {
        success: false,
        error: `AST Verification Failed: Prohibited syntax detected [${ast.violations.join(', ')}]`,
        logs: [],
        durationMs: 0,
      };
    }

    if (this.mode === 'docker') {
      return this.executeDocker(code, args);
    }

    return this.executeSubprocess(code, args);
  }

  /**
   * Execute code inside an isolated Docker container with zero network and restricted capabilities
   */
  private async executeDocker(code: string, args: Record<string, unknown>): Promise<ExecutionResult> {
    const startTime = performance.now();
    const containerName = `aether-sandbox-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    this.lastContainerName = containerName;

    return new Promise((resolve) => {
      let settled = false;
      let timedOut = false;
      let outputExceeded = false;
      let stdoutData = '';
      let stderrData = '';
      let stdoutBytes = 0;
      let stderrBytes = 0;

      const dockerRunnerPath = path.resolve(__dirname, 'docker-runner.cjs').replace(/\\/g, '/');

      const dockerArgs = buildDockerArgs({
        containerName,
        maxMemoryMb: this.maxMemoryMb,
        dockerRunnerPath,
      });

      const killContainerAsync = (): Promise<void> => {
        return new Promise((resolveKill) => {
          try {
            const rmChild = spawn('docker', ['rm', '-f', containerName], {
              stdio: 'ignore',
            });
            const rmTimer = setTimeout(() => {
              try {
                rmChild.kill('SIGKILL');
              } catch {}
              resolveKill();
            }, 5000);
            rmChild.on('close', () => {
              clearTimeout(rmTimer);
              resolveKill();
            });
            rmChild.on('error', () => {
              clearTimeout(rmTimer);
              resolveKill();
            });
          } catch {
            resolveKill();
          }
        });
      };

      const child = spawn('docker', dockerArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const timer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill('SIGKILL');
        } catch {}
      }, this.timeoutMs);

      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdoutBytes += Buffer.byteLength(chunk, 'utf8');
        if (stdoutBytes > this.maxOutputBytes) {
          outputExceeded = true;
          try {
            child.kill('SIGKILL');
          } catch {}
          return;
        }
        stdoutData += chunk;
      });

      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => {
        stderrBytes += Buffer.byteLength(chunk, 'utf8');
        if (stderrBytes > this.maxOutputBytes) {
          outputExceeded = true;
          try {
            child.kill('SIGKILL');
          } catch {}
          return;
        }
        stderrData += chunk;
      });

      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const durationMs = performance.now() - startTime;
        killContainerAsync().finally(() => {
          resolve({
            success: false,
            error: `Docker execution failed: ${err.message}. Ensure Docker Desktop or Docker engine is running.`,
            logs: [],
            durationMs,
          });
        });
      });

      child.on('close', (codeStatus, signal) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const durationMs = performance.now() - startTime;

        killContainerAsync().finally(() => {
          if (outputExceeded) {
            resolve({
              success: false,
              error: `Output limit exceeded: Maximum stdout/stderr limit (${this.maxOutputBytes} bytes) exceeded`,
              logs: [],
              durationMs,
            });
            return;
          }

          if (timedOut) {
            resolve({
              success: false,
              error: `Execution timed out after ${this.timeoutMs}ms (Container killed)`,
              logs: [],
              durationMs,
            });
            return;
          }

          if (codeStatus === 137) {
            resolve({
              success: false,
              error: 'Process killed by Docker runtime (OOM kill / memory limit exceeded)',
              logs: [],
              durationMs,
            });
            return;
          }

          if (stdoutData.trim().length > 0) {
            try {
              const parsed = JSON.parse(stdoutData.trim());
              resolve({
                success: Boolean(parsed.success),
                result: parsed.result,
                logs: Array.isArray(parsed.logs) ? parsed.logs : [],
                error: parsed.error,
                durationMs,
              });
              return;
            } catch {
              // Not clean JSON from runner
            }
          }

          const combinedErr = stderrData.trim() || `Container exited with code ${codeStatus}`;
          const isOOM =
            codeStatus === 137 ||
            combinedErr.includes('137') ||
            combinedErr.toLowerCase().includes('out of memory') ||
            combinedErr.toLowerCase().includes('killed');

          resolve({
            success: false,
            error: isOOM ? 'Memory limit exceeded (OOM killed)' : combinedErr,
            logs: [],
            durationMs,
          });
        });
      });

      const payload = JSON.stringify({
        code,
        args,
        timeoutMs: this.timeoutMs,
        maxOutputBytes: this.maxOutputBytes,
      });

      try {
        child.stdin.write(payload);
        child.stdin.end();
      } catch (writeErr) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          killContainerAsync().finally(() => {
            resolve({
              success: false,
              error: `Failed to write payload to Docker stdin: ${String(writeErr)}`,
              logs: [],
              durationMs: performance.now() - startTime,
            });
          });
        }
      }
    });
  }

  /**
   * Execute code inside an isolated Node.js child process (insecure dev mode)
   */
  private async executeSubprocess(code: string, args: Record<string, unknown>): Promise<ExecutionResult> {
    const startTime = performance.now();
    const runnerPath = path.resolve(__dirname, 'subprocess-runner.js');

    return new Promise((resolve) => {
      let settled = false;
      let timedOut = false;
      let outputExceeded = false;
      let stdoutData = '';
      let stderrData = '';
      let stdoutBytes = 0;
      let stderrBytes = 0;

      const child = spawn(
        process.execPath,
        [
          `--max-old-space-size=${this.maxMemoryMb}`,
          '--disallow-code-generation-from-strings',
          runnerPath,
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {}, // Completely stripped environment: no tokens, API keys, or PATH leakage
        }
      );

      const timer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill('SIGKILL');
        } catch {
          // Ignore kill errors if already terminated
        }
      }, this.timeoutMs);

      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdoutBytes += Buffer.byteLength(chunk, 'utf8');
        if (stdoutBytes > this.maxOutputBytes) {
          outputExceeded = true;
          try {
            child.kill('SIGKILL');
          } catch {}
          return;
        }
        stdoutData += chunk;
      });

      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => {
        stderrBytes += Buffer.byteLength(chunk, 'utf8');
        if (stderrBytes > this.maxOutputBytes) {
          outputExceeded = true;
          try {
            child.kill('SIGKILL');
          } catch {}
          return;
        }
        stderrData += chunk;
      });

      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          success: false,
          error: `Subprocess spawn error: ${err.message}`,
          logs: [],
          durationMs: performance.now() - startTime,
        });
      });

      child.on('close', (codeStatus, signal) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const durationMs = performance.now() - startTime;

        if (outputExceeded) {
          resolve({
            success: false,
            error: `Output limit exceeded: Maximum stdout/stderr limit (${this.maxOutputBytes} bytes) exceeded`,
            logs: [],
            durationMs,
          });
          return;
        }

        if (timedOut) {
          resolve({
            success: false,
            error: `Execution timed out after ${this.timeoutMs}ms (Process killed)`,
            logs: [],
            durationMs,
          });
          return;
        }

        if (signal === 'SIGKILL' || signal === 'SIGTERM') {
          resolve({
            success: false,
            error: `Process terminated by signal ${signal}`,
            logs: [],
            durationMs,
          });
          return;
        }

        if (stdoutData.trim().length > 0) {
          try {
            const parsed = JSON.parse(stdoutData.trim());
            resolve({
              success: Boolean(parsed.success),
              result: parsed.result,
              logs: Array.isArray(parsed.logs) ? parsed.logs : [],
              error: parsed.error,
              durationMs,
            });
            return;
          } catch {
            // Stdout could not be parsed as JSON
          }
        }

        const combinedErr = stderrData.trim() || `Process exited with code ${codeStatus}`;
        const isOOM =
          codeStatus === 134 ||
          codeStatus === 137 ||
          combinedErr.toLowerCase().includes('heap out of memory') ||
          combinedErr.toLowerCase().includes('allocation failed');

        resolve({
          success: false,
          error: isOOM ? 'Heap out of memory: Process exceeded allocated memory limit' : combinedErr,
          logs: [],
          durationMs,
        });
      });

      const payload = JSON.stringify({
        code,
        args,
        timeoutMs: this.timeoutMs,
        maxOutputBytes: this.maxOutputBytes,
      });

      try {
        child.stdin.write(payload);
        child.stdin.end();
      } catch (writeErr) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({
            success: false,
            error: `Failed to write payload to child process stdin: ${String(writeErr)}`,
            logs: [],
            durationMs: performance.now() - startTime,
          });
        }
      }
    });
  }
}
```

---

## 2. `packages/core/src/tools/ASTVerifier.ts`

```typescript
import ts from 'typescript';

export interface ASTVerificationResult {
  isSafe: boolean;
  violations: string[];
}

/**
 * ASTVerifier
 * Static pre-execution security verification using the TypeScript Compiler API.
 * Blocks dangerous globals, reflection breakouts, prototype pollution, dynamic code generation,
 * and static infinite loops before code ever reaches a sandboxed runner.
 */
export class ASTVerifier {
  // Prohibited identifier names that must never appear in sandboxed code
  private static readonly BANNED_IDENTIFIERS = new Set([
    'process',
    'require',
    'module',
    'exports',
    'child_process',
    'fs',
    'net',
    'http',
    'https',
    'tls',
    'dgram',
    'cluster',
    'worker_threads',
    'v8',
    'vm',
    'eval',
    'Function',
    'global',
    'globalThis',
    'window',
    'document',
    '__dirname',
    '__filename',
  ]);

  // Prohibited property access keys used in prototype chain breakouts
  private static readonly BANNED_PROPERTIES = new Set([
    '__proto__',
    'constructor',
    'prototype',
  ]);

  public static verify(code: string): ASTVerificationResult {
    const violations: string[] = [];

    const sourceFile = ts.createSourceFile(
      'sandboxed_tool.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );

    function evaluateStringLiteral(node: ts.Node): string | null {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        return node.text;
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const left = evaluateStringLiteral(node.left);
        const right = evaluateStringLiteral(node.right);
        if (left !== null && right !== null) {
          return left + right;
        }
      }
      if (ts.isTemplateExpression(node)) {
        let combined = node.head.text;
        for (const span of node.templateSpans) {
          const evaluated = evaluateStringLiteral(span.expression);
          if (evaluated === null) return null;
          combined += evaluated + span.literal.text;
        }
        return combined;
      }
      return null;
    }

    function checkBannedString(val: string, location: string) {
      if (ASTVerifier.BANNED_PROPERTIES.has(val)) {
        violations.push(`Forbidden prototype traversal property: "${val}" at ${location}`);
      }
      if (ASTVerifier.BANNED_IDENTIFIERS.has(val)) {
        violations.push(`Forbidden identifier reference: "${val}" at ${location}`);
      }
    }

    function visit(node: ts.Node) {
      // 1. Identifier check
      if (ts.isIdentifier(node)) {
        const name = node.text;
        if (ASTVerifier.BANNED_IDENTIFIERS.has(name)) {
          violations.push(`Forbidden identifier: "${name}"`);
        }
      }

      // 2. Property access check: e.g. obj.__proto__, obj.constructor
      if (ts.isPropertyAccessExpression(node)) {
        const propName = node.name.text;
        if (ASTVerifier.BANNED_PROPERTIES.has(propName)) {
          violations.push(`Forbidden property access: ".${propName}"`);
        }
      }

      // 3. Element access check: e.g. obj["__proto__"], obj["con" + "structor"], obj[`${'constructor'}`]
      if (ts.isElementAccessExpression(node)) {
        const arg = node.argumentExpression;
        const evaluated = evaluateStringLiteral(arg);
        if (evaluated !== null) {
          checkBannedString(evaluated, 'element access');
        }
      }

      // 4. Dynamic import() expressions
      if (node.kind === ts.SyntaxKind.ImportKeyword) {
        violations.push('Forbidden dynamic import expression');
      }

      // 5. Static while(true) / for(;;) infinite loops
      if (ts.isWhileStatement(node)) {
        if (node.expression.kind === ts.SyntaxKind.TrueKeyword) {
          violations.push('Static infinite loop detected: while(true)');
        }
      }

      if (ts.isForStatement(node)) {
        if (!node.condition) {
          violations.push('Static infinite loop detected: for(;;)');
        } else if (node.condition.kind === ts.SyntaxKind.TrueKeyword) {
          violations.push('Static infinite loop detected: for(; true; )');
        }
      }

      // 6. Function constructor invocation via new Function(...)
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
        if (node.expression.text === 'Function') {
          violations.push('Forbidden dynamic code evaluation: new Function(...)');
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    const isSafe = violations.length === 0;
    return {
      isSafe,
      violations,
    };
  }
}
```

---

## 3. `packages/core/src/tools/subprocess-runner.ts`

```typescript
import vm from 'node:vm';

interface RunnerPayload {
  code: string;
  args?: Record<string, unknown>;
  timeoutMs?: number;
  maxOutputBytes?: number;
}

interface RunnerResponse {
  success: boolean;
  result?: unknown;
  logs: string[];
  error?: string;
  durationMs: number;
}

// Strip sensitive Node internal bindings from subprocess global immediately
try {
  delete (process as unknown as { mainModule?: unknown }).mainModule;
  delete (process as unknown as { binding?: unknown }).binding;
  delete (process as unknown as { _linkedBinding?: unknown })._linkedBinding;
} catch {
  // Ignore
}

// Global safety fallbacks for uncaught errors
process.on('unhandledRejection', (reason) => {
  const errMessage = reason instanceof Error ? reason.message : String(reason);
  const response: RunnerResponse = {
    success: false,
    error: `Unhandled rejection in sandbox: ${errMessage}`,
    logs: [],
    durationMs: 0,
  };
  try {
    process.stdout.write(JSON.stringify(response));
  } catch {
    // Ignore
  }
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  const response: RunnerResponse = {
    success: false,
    error: `Uncaught exception in sandbox: ${err.message}`,
    logs: [],
    durationMs: 0,
  };
  try {
    process.stdout.write(JSON.stringify(response));
  } catch {
    // Ignore
  }
  process.exit(1);
});

// Buffer stdin payload
let inputData = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', async () => {
  const startTime = performance.now();
  const logs: string[] = [];

  try {
    if (!inputData.trim()) {
      throw new Error('Empty payload received by sandbox runner');
    }

    const payload: RunnerPayload = JSON.parse(inputData);
    const timeoutMs = payload.timeoutMs || 4000;
    const maxOutputBytes = payload.maxOutputBytes || 512 * 1024;
    const maxLogBytes = Math.min(512 * 1024, maxOutputBytes);
    const args = payload.args || {};

    // If probing environment directly from test harness
    if (args.__probeEnv === true) {
      const envKeys = Object.keys(process.env);
      const response: RunnerResponse = {
        success: true,
        result: { envKeys, envCount: envKeys.length },
        logs: [],
        durationMs: performance.now() - startTime,
      };
      process.stdout.write(JSON.stringify(response));
      process.exit(0);
    }

    // Isolated VM context realm: NO host-realm objects are passed into contextGlobals.
    // Object, Array, JSON, Math, Date, Number, String, Boolean, RegExp, ArrayBuffer,
    // typed arrays, and DataView are provided intrinsically by the VM context itself.
    // args are passed as a JSON string primitive and parsed inside the context.
    const contextGlobals: Record<string, unknown> = {
      __rawArgs: JSON.stringify(args),
      __maxLogBytes: maxLogBytes,
    };

    const context = vm.createContext(contextGlobals, {
      codeGeneration: { strings: false, wasm: false },
    });

    // Transform code to extract return value into __result
    let runnableCode = payload.code;
    if (/export\s+default\s+async\s+function/i.test(runnableCode)) {
      runnableCode = runnableCode.replace(
        /export\s+default\s+async\s+function\s*([a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{([\s\S]*)\}/,
        'async function __fn($2) {$3}\n__result = await __fn(args);'
      );
    } else if (/export\s+default\s+function/i.test(runnableCode)) {
      runnableCode = runnableCode.replace(
        /export\s+default\s+function\s*([a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{([\s\S]*)\}/,
        'async function __fn($2) {$3}\n__result = await __fn(args);'
      );
    } else if (/function\s+execute\s*\(/i.test(runnableCode)) {
      runnableCode = `${runnableCode}\n__result = await execute(args);`;
    } else if (!runnableCode.includes('__result')) {
      runnableCode = `__result = await (async () => {\n${runnableCode}\n})();`;
    }

    const contextScript = `
      const __pristineStringify = JSON.stringify;
      const __pristineParse = JSON.parse;
      const __pristineThen = Promise.prototype.then;
      Object.defineProperty(Promise.prototype, 'then', {
        value: __pristineThen,
        writable: false,
        configurable: false,
      });

      const __logs = [];
      let __totalLogBytes = 0;

      function __calcUtf8Bytes(str) {
        let bytes = 0;
        for (let i = 0; i < str.length; i++) {
          const code = str.charCodeAt(i);
          if (code <= 0x7f) bytes += 1;
          else if (code <= 0x7ff) bytes += 2;
          else if (code >= 0xd800 && code <= 0xdbff) { bytes += 4; i++; }
          else bytes += 3;
        }
        return bytes;
      }

      function __appendLog(prefix, items) {
        const msg = prefix + items.map(String).join(' ');
        __totalLogBytes += __calcUtf8Bytes(msg);
        if (__totalLogBytes > __maxLogBytes) {
          throw new Error('Output limit exceeded: console logs exceeded ' + __maxLogBytes + ' bytes limit');
        }
        __logs.push(msg);
      }

      const console = {
        log: (...items) => __appendLog('', items),
        error: (...items) => __appendLog('[ERROR] ', items),
        warn: (...items) => __appendLog('[WARN] ', items),
        info: (...items) => __appendLog('[INFO] ', items),
      };

      const args = __pristineParse(__rawArgs);
      let __result;

      const __execPromise = (async () => {
        ${runnableCode}
      })();

      __pristineThen.call(
        __execPromise,
        () => {
          try {
            __serialized = __pristineStringify({ success: true, result: __result, logs: __logs });
          } catch (serErr) {
            __serialized = __pristineStringify({
              success: false,
              error: 'Failed to serialize return value: ' + (serErr instanceof Error ? serErr.message : String(serErr)),
              logs: __logs,
            });
          }
        },
        (err) => {
          __serialized = __pristineStringify({
            success: false,
            error: err instanceof Error ? err.message : String(err),
            logs: __logs,
          });
        }
      );
    `;

    const script = new vm.Script(contextScript);
    const executionPromise = script.runInContext(context, {
      timeout: timeoutMs,
    });

    if (executionPromise && typeof executionPromise.then === 'function') {
      await executionPromise;
    }

    const rawSerialized = (context as unknown as { __serialized?: string }).__serialized;
    if (typeof rawSerialized !== 'string') {
      throw new Error('Sandbox runner failed to produce serialized output');
    }

    if (Buffer.byteLength(rawSerialized, 'utf8') > maxOutputBytes) {
      throw new Error(
        `Output limit exceeded: Result size exceeds maximum allowed return size (${maxOutputBytes} bytes)`
      );
    }

    const parsedResult = JSON.parse(rawSerialized);
    const durationMs = performance.now() - startTime;
    const response: RunnerResponse = {
      success: Boolean(parsedResult.success),
      result: parsedResult.result,
      logs: Array.isArray(parsedResult.logs) ? parsedResult.logs : [],
      error: parsedResult.error,
      durationMs,
    };

    process.stdout.write(JSON.stringify(response));
    process.exit(0);
  } catch (err) {
    const durationMs = performance.now() - startTime;
    const response: RunnerResponse = {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      logs,
      durationMs,
    };
    process.stdout.write(JSON.stringify(response));
    process.exit(0);
  }
});
```

---

## 4. `packages/core/src/tools/docker-runner.cjs`

```javascript
const vm = require('node:vm');

// Strip sensitive Node internal bindings from subprocess global immediately
try {
  delete process.mainModule;
  delete process.binding;
  delete process._linkedBinding;
} catch {
  // Ignore
}

// Global safety fallbacks for uncaught errors
process.on('unhandledRejection', (reason) => {
  const errMessage = reason instanceof Error ? reason.message : String(reason);
  const response = {
    success: false,
    error: `Unhandled rejection in Docker sandbox: ${errMessage}`,
    logs: [],
    durationMs: 0,
  };
  try {
    process.stdout.write(JSON.stringify(response));
  } catch {
    // Ignore
  }
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  const response = {
    success: false,
    error: `Uncaught exception in Docker sandbox: ${err.message}`,
    logs: [],
    durationMs: 0,
  };
  try {
    process.stdout.write(JSON.stringify(response));
  } catch {
    // Ignore
  }
  process.exit(1);
});

// Buffer stdin payload
let inputData = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', async () => {
  const startTime = performance.now();
  const logs = [];

  try {
    if (!inputData.trim()) {
      throw new Error('Empty payload received by Docker sandbox runner');
    }

    const payload = JSON.parse(inputData);
    const timeoutMs = payload.timeoutMs || 4000;
    const maxOutputBytes = payload.maxOutputBytes || 512 * 1024;
    const maxLogBytes = Math.min(512 * 1024, maxOutputBytes);
    const args = payload.args || {};

    // If probing environment directly from test harness
    if (args.__probeEnv === true) {
      const envKeys = Object.keys(process.env);
      const response = {
        success: true,
        result: { envKeys, envCount: envKeys.length },
        logs: [],
        durationMs: performance.now() - startTime,
      };
      process.stdout.write(JSON.stringify(response));
      process.exit(0);
    }

    // Isolated VM context realm: NO host-realm objects are passed into contextGlobals.
    // Object, Array, JSON, Math, Date, Number, String, Boolean, RegExp, ArrayBuffer,
    // typed arrays, and DataView are provided intrinsically by the VM context itself.
    // args are passed as a JSON string primitive and parsed inside the context.
    const contextGlobals = {
      __rawArgs: JSON.stringify(args),
      __maxLogBytes: maxLogBytes,
    };

    const context = vm.createContext(contextGlobals, {
      codeGeneration: { strings: false, wasm: false },
    });

    // Transform code to extract return value into __result
    let runnableCode = payload.code;
    if (/export\s+default\s+async\s+function/i.test(runnableCode)) {
      runnableCode = runnableCode.replace(
        /export\s+default\s+async\s+function\s*([a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{([\s\S]*)\}/,
        'async function __fn($2) {$3}\n__result = await __fn(args);'
      );
    } else if (/export\s+default\s+function/i.test(runnableCode)) {
      runnableCode = runnableCode.replace(
        /export\s+default\s+function\s*([a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{([\s\S]*)\}/,
        'async function __fn($2) {$3}\n__result = await __fn(args);'
      );
    } else if (/function\s+execute\s*\(/i.test(runnableCode)) {
      runnableCode = `${runnableCode}\n__result = await execute(args);`;
    } else if (!runnableCode.includes('__result')) {
      runnableCode = `__result = await (async () => {\n${runnableCode}\n})();`;
    }

    const contextScript = `
      const __pristineStringify = JSON.stringify;
      const __pristineParse = JSON.parse;
      const __pristineThen = Promise.prototype.then;
      Object.defineProperty(Promise.prototype, 'then', {
        value: __pristineThen,
        writable: false,
        configurable: false,
      });

      const __logs = [];
      let __totalLogBytes = 0;

      function __calcUtf8Bytes(str) {
        let bytes = 0;
        for (let i = 0; i < str.length; i++) {
          const code = str.charCodeAt(i);
          if (code <= 0x7f) bytes += 1;
          else if (code <= 0x7ff) bytes += 2;
          else if (code >= 0xd800 && code <= 0xdbff) { bytes += 4; i++; }
          else bytes += 3;
        }
        return bytes;
      }

      function __appendLog(prefix, items) {
        const msg = prefix + items.map(String).join(' ');
        __totalLogBytes += __calcUtf8Bytes(msg);
        if (__totalLogBytes > __maxLogBytes) {
          throw new Error('Output limit exceeded: console logs exceeded ' + __maxLogBytes + ' bytes limit');
        }
        __logs.push(msg);
      }

      const console = {
        log: (...items) => __appendLog('', items),
        error: (...items) => __appendLog('[ERROR] ', items),
        warn: (...items) => __appendLog('[WARN] ', items),
        info: (...items) => __appendLog('[INFO] ', items),
      };

      const args = __pristineParse(__rawArgs);
      let __result;

      const __execPromise = (async () => {
        ${runnableCode}
      })();

      __pristineThen.call(
        __execPromise,
        () => {
          try {
            __serialized = __pristineStringify({ success: true, result: __result, logs: __logs });
          } catch (serErr) {
            __serialized = __pristineStringify({
              success: false,
              error: 'Failed to serialize return value: ' + (serErr instanceof Error ? serErr.message : String(serErr)),
              logs: __logs,
            });
          }
        },
        (err) => {
          __serialized = __pristineStringify({
            success: false,
            error: err instanceof Error ? err.message : String(err),
            logs: __logs,
          });
        }
      );
    `;

    const script = new vm.Script(contextScript);
    const executionPromise = script.runInContext(context, {
      timeout: timeoutMs,
    });

    if (executionPromise && typeof executionPromise.then === 'function') {
      await executionPromise;
    }

    const rawSerialized = context.__serialized;
    if (typeof rawSerialized !== 'string') {
      throw new Error('Docker sandbox runner failed to produce serialized output');
    }

    if (Buffer.byteLength(rawSerialized, 'utf8') > maxOutputBytes) {
      throw new Error(
        `Output limit exceeded: Result size exceeds maximum allowed return size (${maxOutputBytes} bytes)`
      );
    }

    const parsedResult = JSON.parse(rawSerialized);
    const durationMs = performance.now() - startTime;
    const response = {
      success: Boolean(parsedResult.success),
      result: parsedResult.result,
      logs: Array.isArray(parsedResult.logs) ? parsedResult.logs : [],
      error: parsedResult.error,
      durationMs,
    };

    process.stdout.write(JSON.stringify(response));
    process.exit(0);
  } catch (err) {
    const durationMs = performance.now() - startTime;
    const response = {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      logs,
      durationMs,
    };
    process.stdout.write(JSON.stringify(response));
    process.exit(0);
  }
});
```

---

## 5. `.github/workflows/ci.yml`

```yaml
name: AetherFlow CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  verify:
    name: Verify & Test (Node ${{ matrix.node-version }})
    runs-on: ubuntu-latest

    strategy:
      fail-fast: false
      matrix:
        node-version: [ 20.x, 22.x ]

    env:
      NODE_OPTIONS: "--unhandled-rejections=strict --trace-warnings"

    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Setup Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci || npm install

    - name: Typecheck
      run: npm run typecheck

    - name: Lint
      run: npm run lint

    - name: Security Audit (Fail on High/Critical)
      run: npm audit --audit-level=high

    - name: Build Core & CLI Packages
      run: npm run build

    - name: Pre-pull Pinned Docker Image
      run: docker pull node:lts-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53

    - name: Run Test Suite (Subprocess & Docker Modes)
      run: npm test

    - name: Run Mutation Defense Verification (Subprocess & Docker)
      run: |
        node scripts/verify_mutations.js --mode=docker
        node scripts/verify_mutations.js --mode=subprocess
```
