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
