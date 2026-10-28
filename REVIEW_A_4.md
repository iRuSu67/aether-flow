# REVIEW_A_4.md: Sandbox & Unified Runner Source Code

This document provides the complete, unedited full source code of the unified sandbox implementation and the shared execution runner, as required by Checkpoint A-fix.

---

## packages/core/src/tools/Sandbox.ts

```typescript
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

export interface SandboxExecutionResult {
  success: boolean;
  result?: unknown;
  logs: string[];
  error?: string;
  durationMs: number;
}

export interface SandboxOptions {
  timeoutMs?: number;
  maxMemoryMb?: number;
  maxOutputBytes?: number;
  mode?: 'docker' | 'subprocess';
  unsafeDevMode?: boolean;
}

export interface DockerRunOptions {
  containerName?: string;
  dockerRunnerPath?: string;
  maxMemoryMb?: number;
  network?: string | null;
  readOnly?: boolean;
  user?: string | null;
  securityOpt?: string[];
  cpus?: string;
  pidsLimit?: number | null;
  capDrop?: string[];
  image?: string;
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

  // Parse customArgs: separate Docker CLI flags (e.g. --add-host) from container command
  const cliFlags: string[] = [];
  const containerCmd: string[] = [];

  if (options.customArgs && options.customArgs.length > 0) {
    let seenCommand = false;
    for (const arg of options.customArgs) {
      if (!seenCommand && arg.startsWith('-')) {
        cliFlags.push(arg);
      } else {
        seenCommand = true;
        containerCmd.push(arg);
      }
    }
  }

  if (cliFlags.length > 0) {
    args.push(...cliFlags);
  }

  if (options.dockerRunnerPath) {
    args.push('-v', `${options.dockerRunnerPath}:/sandbox/runner.mjs:ro`);
  }

  args.push(image);

  if (containerCmd.length > 0) {
    args.push(...containerCmd);
  } else {
    args.push('node', '--disallow-code-generation-from-strings', '/sandbox/runner.mjs');
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
   * Check if Docker is installed and reachable
   */
  public static isDockerAvailable(): boolean {
    try {
      const res = spawnSync('docker', ['--version'], { stdio: 'ignore', timeout: 2000 });
      return res.status === 0;
    } catch {
      return false;
    }
  }

  /**
   * Execute raw JS code or an exported function in the isolated sandbox.
   */
  async execute(code: string, args: Record<string, unknown> = {}): Promise<SandboxExecutionResult> {
    if (this.mode === 'docker') {
      if (!Sandbox.isDockerAvailable()) {
        return {
          success: false,
          error:
            'Docker is required for untrusted tool isolation (--network none, --read-only, cgroups), but Docker was not found on this system.',
          logs: [],
          durationMs: 0,
        };
      }
      return this.executeDocker(code, args);
    }

    return this.executeSubprocess(code, args);
  }

  /**
   * Execute inside a hardened Docker container (--network none, --read-only, cgroups)
   */
  private async executeDocker(code: string, args: Record<string, unknown>): Promise<SandboxExecutionResult> {
    const startTime = performance.now();

    // Resolve shared sandbox runner script path
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    let dockerRunnerPath = path.join(currentDir, 'sandbox-runner.js');
    if (!fs.existsSync(dockerRunnerPath)) {
      const srcRunner = path.resolve(currentDir, '../../src/tools/sandbox-runner.ts');
      if (fs.existsSync(srcRunner)) {
        dockerRunnerPath = srcRunner;
      } else {
        const rootRunner = path.resolve(process.cwd(), 'packages/core/src/tools/sandbox-runner.ts');
        if (fs.existsSync(rootRunner)) {
          dockerRunnerPath = rootRunner;
        }
      }
    }

    const containerName = `aether-sandbox-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    this.lastContainerName = containerName;

    return new Promise<SandboxExecutionResult>((resolve) => {
      let stdoutData = '';
      let stderrData = '';
      let timedOut = false;
      let outputExceeded = false;
      let settled = false;
      let stdoutBytes = 0;
      let stderrBytes = 0;

      const dockerArgs = buildDockerArgs({
        containerName,
        dockerRunnerPath,
        maxMemoryMb: this.maxMemoryMb,
      });

      // Asynchronous kill container ONLY called on timeout, output overflow, or spawn error.
      // Normal exits do NOT call this because --rm handles normal exit cleanly with 0ms overhead.
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
        // Only call killContainerAsync on spawn error, and don't await it
        killContainerAsync();
        resolve({
          success: false,
          error: `Docker execution error: ${err.message}`,
          logs: [],
          durationMs: performance.now() - startTime,
        });
      });

      child.on('close', async (codeStatus, signal) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const durationMs = performance.now() - startTime;

        if (outputExceeded) {
          killContainerAsync();
          resolve({
            success: false,
            error: `Output limit exceeded: Maximum stdout/stderr limit (${this.maxOutputBytes} bytes) exceeded`,
            logs: [],
            durationMs,
          });
          return;
        }

        if (timedOut) {
          await killContainerAsync();
          resolve({
            success: false,
            error: `Execution timed out after ${this.timeoutMs}ms (Docker container terminated)`,
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
            // Malformed json
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

      try {
        const payload = JSON.stringify({
          code,
          args,
          timeoutMs: Math.max(100, this.timeoutMs - 150),
          maxOutputBytes: this.maxOutputBytes,
        });
        child.stdin.write(payload);
        child.stdin.end();
      } catch (writeErr) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          killContainerAsync();
          resolve({
            success: false,
            error: `Failed to write payload to Docker stdin: ${String(writeErr)}`,
            logs: [],
            durationMs: performance.now() - startTime,
          });
        }
      }
    });
  }

  /**
   * Execute in decoupled local Node subprocess (Insecure dev mode)
   */
  private async executeSubprocess(code: string, args: Record<string, unknown>): Promise<SandboxExecutionResult> {
    const startTime = performance.now();

    // Resolve shared sandbox runner script path
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    let runnerPath = path.join(currentDir, 'sandbox-runner.js');
    if (!fs.existsSync(runnerPath)) {
      const srcRunner = path.resolve(currentDir, '../../src/tools/sandbox-runner.ts');
      if (fs.existsSync(srcRunner)) {
        runnerPath = srcRunner;
      } else {
        const rootRunner = path.resolve(process.cwd(), 'packages/core/src/tools/sandbox-runner.ts');
        if (fs.existsSync(rootRunner)) {
          runnerPath = rootRunner;
        }
      }
    }

    return new Promise<SandboxExecutionResult>((resolve) => {
      let stdoutData = '';
      let stderrData = '';
      let timedOut = false;
      let outputExceeded = false;
      let settled = false;
      let stdoutBytes = 0;
      let stderrBytes = 0;

      // Spawn decoupled subprocess with stripped environment and strict engine limits
      const child = spawn(
        process.execPath,
        [
          `--max-old-space-size=${this.maxMemoryMb}`,
          '--disallow-code-generation-from-strings',
          '--no-addons',
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
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({
            success: false,
            error: `Subprocess spawn error: ${err.message}`,
            logs: [],
            durationMs: performance.now() - startTime,
          });
        }
      });

      child.on('close', (codeStatus) => {
        if (!settled) {
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
              // Malformed JSON output
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
        }
      });

      try {
        const payload = JSON.stringify({
          code,
          args,
          timeoutMs: Math.max(100, this.timeoutMs - 150),
          maxOutputBytes: this.maxOutputBytes,
        });
        child.stdin.write(payload);
        child.stdin.end();
      } catch (writeErr) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({
            success: false,
            error: `Failed to write payload to subprocess stdin: ${String(writeErr)}`,
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

## packages/core/src/tools/sandbox-runner.ts

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
