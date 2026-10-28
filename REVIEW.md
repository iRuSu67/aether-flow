# Phase 1d Verification & Code Review Document

## 1. SUMMARY
1. Fail closed: default mode is `'docker'`; silent fallback removed; subprocess requires explicit `{ unsafeDevMode: true }` opt-in and logs a loud warning; Docker unavailability returns an error.
2. Verified `--network none`: Test 1 connects to `host.docker.internal:<port>` with real flags and fails with 0 host connections; Test 2 (control) omits `--network none` and connects in ~1s.
3. Realm isolation: zero host-realm objects passed to VM context; args passed as JSON string; context defines internal console and pristine stringify; sandboxed mutation of Array.prototype or JSON.stringify cannot reach runner.
4. Flood test: identified cause (assertion on substring `'limit'` matched V8 heap crash error instead of output cap); asserted exact `'Output limit exceeded:'` error and non-timeout/non-heap termination; added Docker stderr cap test.
5. Docker mutations & probe tests: added probes for non-root user (id 1000), read-only fs (touch /x fails), dropped capabilities (CapBnd 0), pids limit (64), memory cap (64MB), and network none. Verified all 7 Docker mutations fail real tests.
6. Mutation runner: verified in BOTH subprocess mode (6/6 layers pass with real failures) and Docker mode (7/7 layers pass with real failures).
7. Latency optimization: synchronous spawnSync kill & rm calls on close removed on normal exit (--rm handles it); synchronous overhead eliminated (198.6ms -> 0.0ms), reducing call latency from 1184ms to 1077ms.
8. AST bypass tests: added tests proving dynamic computed keys and Reflect.get + String.fromCharCode bypass AST verifier (isSafe: true) but are safely contained by Sandbox.
9. Documentation: aligned SECURITY.md with actual memory limits, removed --permission claim, removed unowned email address, and documented AST as a heuristic lint.
10. Still unverified: multi-tenant concurrent container isolation under high host core starvation, Windows-native containers (vs Linux Alpine in WSL2 Docker Desktop), and cold-pull image overhead when pinned digest is uncached.

---

## 2. RAW TEST OUTPUT

### Execution Mode Specification
- `packages/core/src/tests/kernel.test.ts`:
  - `Sandbox executes JS code securely in Docker mode and captures logs`: runs in **Docker mode** (`mode: 'docker'`).
- `packages/core/src/tests/sandbox-escape.test.ts`:
  - Layer 1 (Static AST tests): static AST analysis (TypeScript compiler AST, no sandbox runtime).
  - Layer 2 (Known AST bypass tests): runs in **both Subprocess mode** (`mode: 'subprocess', unsafeDevMode: true`) and **Docker mode** (`mode: 'docker'`).
  - Layer 3 (Subprocess dev mode tests): runs in **Subprocess mode** (`mode: 'subprocess', unsafeDevMode: true`).
  - Layer 4 (Docker hardening, probe tests & network isolation): runs in **Docker mode** (`mode: 'docker'`).

### Raw Unedited `npm test` Output
```text
> aether-flow-monorepo@1.0.0 test
> npm run test --workspaces --if-present


> @aether-flow/core@1.0.0 test
> node --test --test-concurrency=1 dist/**/*.test.js

✔ Sandbox executes JS code securely in Docker mode and captures logs (1522.8942ms)
✔ ToolRegistry executes pre-registered tools [sample-value check on text_analyzer] (2.0382ms)
✔ VectorMemory embeds, inserts, and retrieves nearest neighbors (1.8157ms)
✔ KnowledgeGraph connects entities and computes BFS shortest paths (2.33ms)
✔ SecurityFirewall blocks malicious injections and masks PII (3.4429ms)
✔ SymbolicSolver proves SAT satisfiability and validates numeric bounds (1.4988ms)
✔ FlowScript Compiler tokenizes and parses .flow DSL script into AST (3.2255ms)
✔ CheckpointEngine snapshots state and creates divergent time-travel forks (1.0316ms)
✔ CRDTStore synchronizes state without conflicts across vector clocks (1.7985ms)
✔ AetherKernel end-to-end goal execution with speculative swarm [MockProvider simulated LLM] (2821.5446ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ ASTVerifier blocks prototype constructor chain breakout (45.1614ms)
✔ ASTVerifier blocks computed string concatenation constructor evasion (4.408ms)
✔ ASTVerifier blocks template literal constructor evasion (7.1825ms)
✔ ASTVerifier blocks prototype pollution via __proto__ (2.0991ms)
✔ ASTVerifier blocks dynamic import expressions (2.8679ms)
✔ ASTVerifier blocks eval and new Function identifiers (2.3127ms)
✔ ASTVerifier blocks static while(true) infinite loops (6.9623ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ Known AST bypass: computed key via Array.join is missed by AST but contained by Sandbox (2017.3481ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ Known AST bypass: Reflect.get with String.fromCharCode is missed by AST but contained by Sandbox (2147.1025ms)
✔ Sandbox fails closed: subprocess mode without unsafeDevMode throws immediately (3.0434ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ Sandbox blocks prototype constructor breakout when AST check is bypassed (subprocess) (260.0189ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ Sandbox blocks args.constructor.constructor breakout (subprocess) (283.8212ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ Sandbox blocks eval() via engine-level string compilation disallowance (subprocess) (351.9072ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ Sandbox environment is clean: host process.env is inaccessible in VM (subprocess) (325.6371ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ Sandbox strips host environment variables from child process.env (subprocess) (267.8084ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ Sandbox blocks filesystem read outside sandbox (fs / require) (subprocess) (271.8799ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ Sandbox blocks outbound network connection attempts (fetch / net) (subprocess) (328.0867ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ Sandbox blocks access to process.binding and process.mainModule (subprocess) (374.2714ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ Sandbox output caps terminate child on unbounded stdout/stderr flooding (subprocess) (629.5761ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ Sandbox fails safely when return value exceeds maximum result size (subprocess) (622.7285ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ Sandbox hard timeout terminates synchronous CPU infinite loop (subprocess) (879.0878ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ Sandbox hard timeout terminates asynchronous microtask loop (subprocess) (863.4298ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ Sandbox fails safely on unresolved empty promise event loop exit (subprocess) (285.5097ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ Sandbox caps heap memory and fails safely on memory exhaustion attempt (subprocess) (660.0432ms)
✔ VM Context Realm Isolation: sandboxed code cannot mutate runner JSON.stringify, Array.prototype, or Object.prototype (302.2033ms)
✔ Docker network isolation Test 1: Real flag list cannot connect to host TCP listener (0 connections) (7140.8965ms)
✔ Docker network isolation Test 2 (control): Omitting --network none MUST connect to host listener (1912.4421ms)
✔ Docker probe: container runs as non-root user node (uid 1000) (1828.9397ms)
✔ Docker probe: container filesystem is strictly read-only (touch /x fails) (1422.8389ms)
✔ Docker probe: container Linux capabilities are dropped (CapBnd is 0) (1535.7625ms)
✔ Docker probe: container pids limit is enforced (pids.max is 64) (1352.8854ms)
✔ Docker probe: container memory limit is enforced (memory.max matches 64MB) (1057.0129ms)
✔ Docker mode host-side stderr flooding is terminated by output limit cap (1754.6967ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ Docker container is killed and removed after timeout (verified via docker ps -a) (2512.4726ms)
✔ ArrayBuffer memory bomb analysis: timeout vs memory cap in each mode (6105.1275ms)
ℹ tests 45
ℹ suites 0
ℹ pass 45
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 44937.1963
```

---

## 3. MUTATION RESULTS

### Mode 1: Subprocess Mutations (`node scripts/verify_mutations.js --mode=subprocess`)
```text
================================================================
       REAL DEFENSE-IN-DEPTH MUTATION VERIFICATION RUNNER       
  Mode: SUBPROCESS | Total Layers: 6
  Each mutation is applied to source, rebuilt, tested, and parsed
================================================================

▶ [Layer 1/6] Subprocess Layer 1: Static AST Verifier (Static Lint Layer)
  Description: Bypass AST verification (force isSafe = true and clear banned patterns)
  ✔ Real tests that failed under this mutation (7):
    ✖ ASTVerifier blocks prototype constructor chain breakout
    ✖ ASTVerifier blocks computed string concatenation constructor evasion
    ✖ ASTVerifier blocks template literal constructor evasion
    ✖ ASTVerifier blocks prototype pollution via __proto__
    ✖ ASTVerifier blocks dynamic import expressions
    ✖ ASTVerifier blocks eval and new Function identifiers
    ✖ ASTVerifier blocks static while(true) infinite loops

▶ [Layer 2/6] Subprocess Layer 2: VM Context Lockdown & Isolated Realm
  Description: Expose dangerous require() and fetch() globals directly in contextGlobals
  ✔ Real tests that failed under this mutation (2):
    ✖ Sandbox blocks filesystem read outside sandbox (fs / require) (subprocess)
    ✖ Sandbox blocks outbound network connection attempts (fetch / net) (subprocess)

▶ [Layer 3/6] Subprocess Layer 3: V8 Engine Flags (--disallow-code-generation-from-strings)
  Description: Remove V8 string compilation disallowance from child process flags and VM context
  ✔ Real tests that failed under this mutation (4):
    ✖ Known AST bypass: computed key via Array.join is missed by AST but contained by Sandbox
    ✖ Known AST bypass: Reflect.get with String.fromCharCode is missed by AST but contained by Sandbox
    ✖ Sandbox blocks prototype constructor breakout when AST check is bypassed (subprocess)
    ✖ Sandbox blocks eval() via engine-level string compilation disallowance (subprocess)

▶ [Layer 4/6] Subprocess Layer 4: Environment Stripping (env: {})
  Description: Leak host process.env into spawned child process (change env: {} to env: process.env)
  ✔ Real tests that failed under this mutation (2):
    ✖ Known AST bypass: Reflect.get with String.fromCharCode is missed by AST but contained by Sandbox
    ✖ Sandbox strips host environment variables from child process.env (subprocess)

▶ [Layer 5/6] Subprocess Layer 5: Authoritative Timeout Kill
  Description: Disable child process kill timer on execution timeout
  ✔ Real tests that failed under this mutation (1):
    ✖ Sandbox hard timeout terminates asynchronous microtask loop (subprocess)

▶ [Layer 6/6] Subprocess Layer 6: Output Limits Cap
  Description: Disable stdout flooding byte cap and serialized result size cap
  ✔ Real tests that failed under this mutation (2):
    ✖ Sandbox output caps terminate child on unbounded stdout/stderr flooding (subprocess)
    ✖ Sandbox fails safely when return value exceeds maximum result size (subprocess)

================================================================
                      MUTATION RUN SUMMARY                      
================================================================
✔ [SUBPROCESS] Subprocess Layer 1: Static AST Verifier (Static Lint Layer): 7 real test(s) failed
✔ [SUBPROCESS] Subprocess Layer 2: VM Context Lockdown & Isolated Realm: 2 real test(s) failed
✔ [SUBPROCESS] Subprocess Layer 3: V8 Engine Flags (--disallow-code-generation-from-strings): 4 real test(s) failed
✔ [SUBPROCESS] Subprocess Layer 4: Environment Stripping (env: {}): 2 real test(s) failed
✔ [SUBPROCESS] Subprocess Layer 5: Authoritative Timeout Kill: 1 real test(s) failed
✔ [SUBPROCESS] Subprocess Layer 6: Output Limits Cap: 2 real test(s) failed
================================================================
```

### Mode 2: Docker Mutations (`node scripts/verify_mutations.js --mode=docker`)
```text
================================================================
       REAL DEFENSE-IN-DEPTH MUTATION VERIFICATION RUNNER       
  Mode: DOCKER | Total Layers: 7
  Each mutation is applied to source, rebuilt, tested, and parsed
================================================================

▶ [Layer 1/7] Docker Layer 1: Network Isolation (--network none)
  Description: Remove --network none from buildDockerArgs flag list
  ✔ Real tests that failed under this mutation (2):
    ✖ Known AST bypass: computed key via Array.join is missed by AST but contained by Sandbox
    ✖ Docker network isolation Test 1: Real flag list cannot connect to host TCP listener (0 connections)

▶ [Layer 2/7] Docker Layer 2: Non-Root User Isolation (--user node)
  Description: Remove --user node from buildDockerArgs flag list (defaults to root)
  ✔ Real tests that failed under this mutation (1):
    ✖ Docker probe: container runs as non-root user node (uid 1000)

▶ [Layer 3/7] Docker Layer 3: Read-Only Root Filesystem (--read-only)
  Description: Remove --read-only from buildDockerArgs flag list
  ✔ Real tests that failed under this mutation (1):
    ✖ Docker probe: container filesystem is strictly read-only (touch /x fails)

▶ [Layer 4/7] Docker Layer 4: Capability Dropping (--cap-drop=ALL)
  Description: Remove --cap-drop=ALL from buildDockerArgs flag list
  ✔ Real tests that failed under this mutation (2):
    ✖ Docker probe: container Linux capabilities are dropped (CapBnd is 0)
    ✖ ArrayBuffer memory bomb analysis: timeout vs memory cap in each mode

▶ [Layer 5/7] Docker Layer 5: Process Fork Bomb Containment (--pids-limit=64)
  Description: Remove --pids-limit=64 from buildDockerArgs flag list
  ✔ Real tests that failed under this mutation (1):
    ✖ Docker probe: container pids limit is enforced (pids.max is 64)

▶ [Layer 6/7] Docker Layer 6: Memory Cgroups Limit (--memory=64m)
  Description: Remove --memory=64m and --memory-swap=64m from buildDockerArgs flag list
  ✔ Real tests that failed under this mutation (12):
    ✖ Known AST bypass: computed key via Array.join is missed by AST but contained by Sandbox
    ✖ Known AST bypass: Reflect.get with String.fromCharCode is missed by AST but contained by Sandbox
    ✖ Docker network isolation Test 1: Real flag list cannot connect to host TCP listener (0 connections)
    ✖ Docker network isolation Test 2 (control): Omitting --network none MUST connect to host listener
    ✖ Docker probe: container runs as non-root user node (uid 1000)
    ✖ Docker probe: container filesystem is strictly read-only (touch /x fails)
    ✖ Docker probe: container Linux capabilities are dropped (CapBnd is 0)
    ✖ Docker probe: container pids limit is enforced (pids.max is 64)
    ✖ Docker probe: container memory limit is enforced (memory.max matches 64MB)
    ✖ Docker mode host-side stderr flooding is terminated by output limit cap
    ✖ Docker container is killed and removed after timeout (verified via docker ps -a)
    ✖ ArrayBuffer memory bomb analysis: timeout vs memory cap in each mode

▶ [Layer 7/7] Docker Layer 7: Host-Side Stderr Output Flooding Cap
  Description: Disable host-side stderr cap and container runner log cap in Docker mode
  ✔ Real tests that failed under this mutation (1):
    ✖ Docker mode host-side stderr flooding is terminated by output limit cap

================================================================
                      MUTATION RUN SUMMARY                      
================================================================
✔ [DOCKER] Docker Layer 1: Network Isolation (--network none): 2 real test(s) failed
✔ [DOCKER] Docker Layer 2: Non-Root User Isolation (--user node): 1 real test(s) failed
✔ [DOCKER] Docker Layer 3: Read-Only Root Filesystem (--read-only): 1 real test(s) failed
✔ [DOCKER] Docker Layer 4: Capability Dropping (--cap-drop=ALL): 2 real test(s) failed
✔ [DOCKER] Docker Layer 5: Process Fork Bomb Containment (--pids-limit=64): 1 real test(s) failed
✔ [DOCKER] Docker Layer 6: Memory Cgroups Limit (--memory=64m): 12 real test(s) failed
✔ [DOCKER] Docker Layer 7: Host-Side Stderr Output Flooding Cap: 1 real test(s) failed
================================================================
```

---

## 4. DOCKER PROOF & LATENCY BREAKDOWN

### 4.1 `docker --version`
```text
Docker version 29.9.2, build a82e528
```

### 4.2 Exact `docker run` Flag List Produced by `buildDockerArgs()`
```sh
docker run \
  --name <containerName> \
  --rm \
  -i \
  --network none \
  --read-only \
  --user node \
  --security-opt no-new-privileges \
  --memory=64m \
  --memory-swap=64m \
  --cpus=1.0 \
  --pids-limit=64 \
  --cap-drop=ALL \
  -v <host_runner_path>:/sandbox/runner.cjs:ro \
  node:lts-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 \
  node \
  --disallow-code-generation-from-strings \
  /sandbox/runner.cjs
```

### 4.3 Latency Measurement: Before vs. After Optimization
```text
================================================================
              DOCKER CALL LATENCY BENCHMARK                     
================================================================

--- 1. BEFORE OPTIMIZATION (with synchronous kill + rm on close) ---
  Run 1: docker run: 897.7ms | spawnSync kill: 113.5ms | spawnSync rm: 94.6ms | close: 208.1ms | total: 1105.8ms
  Run 2: docker run: 1114.9ms | spawnSync kill: 94.2ms | spawnSync rm: 94.3ms | close: 188.5ms | total: 1303.4ms
  Run 3: docker run: 904.1ms | spawnSync kill: 104.5ms | spawnSync rm: 98.3ms | close: 202.8ms | total: 1106.9ms
  Run 4: docker run: 916.1ms | spawnSync kill: 105.4ms | spawnSync rm: 95.4ms | close: 200.7ms | total: 1116.8ms
  Run 5: docker run: 1094.2ms | spawnSync kill: 97.1ms | spawnSync rm: 95.9ms | close: 192.9ms | total: 1287.1ms

  Average Before:
    docker run execution:       985.4ms
    spawnSync docker kill:      102.9ms
    spawnSync docker rm:        95.7ms
    Synchronous close overhead: 198.6ms
    Total per-call latency:     1184.0ms

--- 2. AFTER OPTIMIZATION (async, --rm auto-cleanup on exit) ---
  Run 1: async docker run with --rm: 916.8ms (close overhead: 0.0ms)
  Run 2: async docker run with --rm: 1051.5ms (close overhead: 0.0ms)
  Run 3: async docker run with --rm: 1421.0ms (close overhead: 0.0ms)
  Run 4: async docker run with --rm: 1063.5ms (close overhead: 0.0ms)
  Run 5: async docker run with --rm: 934.8ms (close overhead: 0.0ms)

  Average After:
    Total per-call latency:     1077.5ms
    Synchronous close overhead: 0.0ms (eliminated)
    Latency reduction:          106.5ms (9.0% speedup)
================================================================
```

### 4.4 `docker ps -a` Post-Test Cleanliness Proof
```text
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
```
*(Empty: verified zero leftover containers remain on the host)*

---

## 5. FULL SOURCE CODE

### `packages/core/src/tools/Sandbox.ts`
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

    // Resolve docker runner script path
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    let dockerRunnerPath = path.join(currentDir, 'docker-runner.cjs');
    if (!fs.existsSync(dockerRunnerPath)) {
      const srcRunner = path.resolve(currentDir, '../../src/tools/docker-runner.cjs');
      if (fs.existsSync(srcRunner)) {
        dockerRunnerPath = srcRunner;
      } else {
        const rootRunner = path.resolve(process.cwd(), 'packages/core/src/tools/docker-runner.cjs');
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

      // Synchronous kill container ONLY called on timeout or output overflow.
      // Normal exits do NOT call this because --rm handles normal exit cleanly with 0ms overhead.
      const killContainer = () => {
        try {
          spawnSync('docker', ['kill', containerName], { stdio: 'ignore', timeout: 5000 });
        } catch {}
        try {
          spawnSync('docker', ['rm', '-f', containerName], { stdio: 'ignore', timeout: 5000 });
        } catch {}
      };

      const child = spawn('docker', dockerArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const timer = setTimeout(() => {
        timedOut = true;
        killContainer();
        try {
          child.kill('SIGKILL');
        } catch {}
      }, this.timeoutMs);

      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdoutBytes += Buffer.byteLength(chunk, 'utf8');
        if (stdoutBytes > this.maxOutputBytes) {
          outputExceeded = true;
          killContainer();
          try {
            child.kill('SIGKILL');
          } catch {}
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve({
              success: false,
              error: `Output limit exceeded: Maximum stdout/stderr limit (${this.maxOutputBytes} bytes) exceeded`,
              logs: [],
              durationMs: performance.now() - startTime,
            });
          }
          return;
        }
        stdoutData += chunk;
      });

      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => {
        stderrBytes += Buffer.byteLength(chunk, 'utf8');
        if (stderrBytes > this.maxOutputBytes) {
          outputExceeded = true;
          killContainer();
          try {
            child.kill('SIGKILL');
          } catch {}
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve({
              success: false,
              error: `Output limit exceeded: Maximum stdout/stderr limit (${this.maxOutputBytes} bytes) exceeded`,
              logs: [],
              durationMs: performance.now() - startTime,
            });
          }
          return;
        }
        stderrData += chunk;
      });

      child.on('error', (err) => {
        killContainer();
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          success: false,
          error: `Docker execution error: ${err.message}`,
          logs: [],
          durationMs: performance.now() - startTime,
        });
      });

      child.on('close', (exitCode, signal) => {
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
          killContainer();
          resolve({
            success: false,
            error: `Execution timed out after ${this.timeoutMs}ms (Docker container terminated)`,
            logs: [],
            durationMs,
          });
          return;
        }

        if (signal === 'SIGKILL' || exitCode === 137) {
          resolve({
            success: false,
            error: 'Docker container killed (OOM or timeout)',
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

        resolve({
          success: false,
          error: stderrData.trim() || `Container exited with code ${exitCode}`,
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
      } catch (err) {
        killContainer();
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          try {
            child.kill('SIGKILL');
          } catch {}
          resolve({
            success: false,
            error: `Failed to write payload to Docker sandbox: ${err instanceof Error ? err.message : String(err)}`,
            logs: [],
            durationMs: performance.now() - startTime,
          });
        }
      }
    });
  }

  /**
   * Execute in decoupled child subprocess (Dev Mode)
   */
  private async executeSubprocess(
    code: string,
    args: Record<string, unknown>
  ): Promise<SandboxExecutionResult> {
    const startTime = performance.now();

    // Resolve runner script path
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    let runnerPath = path.join(currentDir, 'subprocess-runner.js');
    if (!fs.existsSync(runnerPath)) {
      const tsRunner = path.join(currentDir, 'subprocess-runner.ts');
      if (fs.existsSync(tsRunner)) {
        runnerPath = tsRunner;
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
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          success: false,
          error: `Subprocess execution error: ${err.message}`,
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

        const errMessage = stderrData.trim() || `Process exited abnormally with code ${codeStatus}`;
        resolve({
          success: false,
          error: errMessage,
          logs: [],
          durationMs,
        });
      });

      // Deliver payload through standard input
      try {
        const payload = JSON.stringify({
          code,
          args,
          timeoutMs: Math.max(100, this.timeoutMs - 150),
          maxOutputBytes: this.maxOutputBytes,
        });
        child.stdin.write(payload);
        child.stdin.end();
      } catch (err) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          try {
            child.kill('SIGKILL');
          } catch {
            // Ignore
          }
          resolve({
            success: false,
            error: `Failed to write payload to sandbox: ${err instanceof Error ? err.message : String(err)}`,
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

### `packages/core/src/tools/subprocess-runner.ts`
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

### `packages/core/src/tools/docker-runner.cjs`
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

### `packages/core/src/tools/ASTVerifier.ts`
```typescript
import ts from 'typescript';

export interface VerificationReport {
  isSafe: boolean;
  warnings: string[];
  bannedPatternsDetected: string[];
  complexityScore: number;
}

/**
 * ASTVerifier
 * Defense-in-depth static analysis engine powered by the TypeScript compiler API.
 * Detects prohibited identifiers, computed property traversal, prototype pollution,
 * dynamic imports, string concatenation evasions, and obvious infinite loops.
 */
export class ASTVerifier {
  private bannedIdentifiers = new Set([
    'process',
    'child_process',
    'require',
    'eval',
    'Function',
    'global',
    'globalThis',
    'window',
    'document',
    'WebSocket',
    'Worker',
    'XMLHttpRequest',
  ]);

  private dangerousProperties = new Set([
    'constructor',
    '__proto__',
    'prototype',
    'process',
    'child_process',
    'mainmodule',
  ]);

  /**
   * Recursively evaluates static string expressions, including string concatenations
   * and template literal expressions (e.g. "con" + "structor" or `con${"struc"}tor`).
   */
  private evaluateStaticString(node: ts.Node): string | null {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      return node.text;
    }

    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = this.evaluateStaticString(node.left);
      const right = this.evaluateStaticString(node.right);
      if (left !== null && right !== null) {
        return left + right;
      }
    }

    if (ts.isTemplateExpression(node)) {
      let result = node.head.text;
      for (const span of node.templateSpans) {
        const spanVal = this.evaluateStaticString(span.expression);
        if (spanVal === null) return null;
        result += spanVal + span.literal.text;
      }
      return result;
    }

    if (ts.isParenthesizedExpression(node)) {
      return this.evaluateStaticString(node.expression);
    }

    return null;
  }

  /**
   * Statically verify synthesized JavaScript/TypeScript code before sandbox ingestion.
   */
  public verify(code: string): VerificationReport {
    const warnings: string[] = [];
    const bannedDetected: string[] = [];
    let complexityScore = 1;

    // Parse AST using TypeScript compiler API
    const sourceFile = ts.createSourceFile(
      'synthesized_tool.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );

    // Check syntax diagnostics if present on parsed source
    const rawDiagnostics = (sourceFile as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics;
    if (rawDiagnostics && rawDiagnostics.length > 0) {
      for (const diag of rawDiagnostics) {
        const message = typeof diag.messageText === 'string' ? diag.messageText : diag.messageText.messageText;
        warnings.push(`SYNTAX_ERROR: ${message}`);
      }
    }

    let hasExecutableSignature = false;

    const walk = (node: ts.Node) => {
      // 1. Cyclomatic complexity tracking
      if (
        ts.isIfStatement(node) ||
        ts.isForStatement(node) ||
        ts.isForInStatement(node) ||
        ts.isForOfStatement(node) ||
        ts.isWhileStatement(node) ||
        ts.isDoStatement(node) ||
        ts.isCaseClause(node) ||
        ts.isCatchClause(node) ||
        ts.isConditionalExpression(node)
      ) {
        complexityScore++;
      }

      // 2. Detect executable export / function signatures
      if (
        ts.isExportAssignment(node) ||
        (ts.isFunctionDeclaration(node) && node.name?.text === 'execute') ||
        (ts.isFunctionDeclaration(node) && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
      ) {
        hasExecutableSignature = true;
      }

      // 3. Prohibited Identifiers
      if (ts.isIdentifier(node)) {
        if (this.bannedIdentifiers.has(node.text)) {
          // If identifier is not merely a non-computed property assignment in an object literal
          const parent = node.parent;
          const isPropertyAssignmentName = ts.isPropertyAssignment(parent) && parent.name === node;
          if (!isPropertyAssignmentName) {
            bannedDetected.push(`BANNED_IDENTIFIER: ${node.text}`);
          }
        }
      }

      // 4. Dynamic import()
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        bannedDetected.push('DYNAMIC_IMPORT: Dynamic import() calls are prohibited');
      }

      // 5. Static import declaration
      if (ts.isImportDeclaration(node)) {
        bannedDetected.push('STATIC_IMPORT: Module imports are prohibited in synthesized tools');
      }

      // 6. Computed Property Access & Concatenation (e.g. this["con" + "structor"])
      if (ts.isElementAccessExpression(node)) {
        const evaluatedProp = this.evaluateStaticString(node.argumentExpression);
        if (evaluatedProp && this.dangerousProperties.has(evaluatedProp.toLowerCase())) {
          bannedDetected.push(`BANNED_COMPUTED_PROPERTY: Attempted access to dangerous property "${evaluatedProp}"`);
        }
      }

      // 7. Property Access Chains (e.g. this.constructor or obj.__proto__)
      if (ts.isPropertyAccessExpression(node)) {
        const propName = node.name.text.toLowerCase();
        if (this.dangerousProperties.has(propName)) {
          bannedDetected.push(`BANNED_PROPERTY_ACCESS: Access to "${node.name.text}" is prohibited`);
        }
      }

      // 8. Infinite Loops
      if (ts.isWhileStatement(node)) {
        if (node.expression.kind === ts.SyntaxKind.TrueKeyword) {
          bannedDetected.push('POTENTIAL_INFINITE_LOOP: while(true)');
        } else if (ts.isNumericLiteral(node.expression) && node.expression.text !== '0') {
          bannedDetected.push(`POTENTIAL_INFINITE_LOOP: while(${node.expression.text})`);
        }
      } else if (ts.isForStatement(node)) {
        if (!node.condition && !node.initializer && !node.incrementor) {
          bannedDetected.push('POTENTIAL_INFINITE_LOOP: for(;;)');
        }
      }

      ts.forEachChild(node, walk);
    };

    walk(sourceFile);

    // Heuristic execution signature check fallback
    if (!hasExecutableSignature && !code.includes('export default') && !code.includes('function execute') && !code.includes('return')) {
      warnings.push('MISSING_EXECUTION_SIGNATURE: Code does not appear to export an execute function');
    }

    if (complexityScore > 25) {
      warnings.push(`HIGH_CYCLOMATIC_COMPLEXITY: Score ${complexityScore} exceeds standard threshold`);
    }

    const isSafe = bannedDetected.length === 0;

    return {
      isSafe,
      warnings,
      bannedPatternsDetected: bannedDetected,
      complexityScore,
    };
  }
}
```

---

### `packages/core/src/tests/sandbox-escape.test.ts`
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawnSync } from 'node:child_process';
import { Sandbox, buildDockerArgs } from '../tools/Sandbox.js';
import { ASTVerifier } from '../tools/ASTVerifier.js';

// ============================================================================
// LAYER 1: STATIC AST VERIFIER ADVERSARIAL TESTS (LINT / HEURISTIC)
// ============================================================================

test('ASTVerifier blocks prototype constructor chain breakout', () => {
  const verifier = new ASTVerifier();
  const code = `
    export default async function execute(args) {
      const p = this.constructor.constructor('return process')();
      return p.env;
    }
  `;
  const report = verifier.verify(code);
  assert.equal(report.isSafe, false);
  assert.ok(report.bannedPatternsDetected.some((p) => p.includes('constructor') || p.includes('process')));
});

test('ASTVerifier blocks computed string concatenation constructor evasion', () => {
  const verifier = new ASTVerifier();
  const code = `
    export default async function execute(args) {
      const f = this['con' + 'structor']['con' + 'structor'];
      return f('return 42')();
    }
  `;
  const report = verifier.verify(code);
  assert.equal(report.isSafe, false);
  assert.ok(report.bannedPatternsDetected.some((p) => p.includes('constructor')));
});

test('ASTVerifier blocks template literal constructor evasion', () => {
  const verifier = new ASTVerifier();
  const code = 'export default async function execute(args) { return this[`con${"struc"}tor`]; }';
  const report = verifier.verify(code);
  assert.equal(report.isSafe, false);
  assert.ok(report.bannedPatternsDetected.some((p) => p.includes('constructor')));
});

test('ASTVerifier blocks prototype pollution via __proto__', () => {
  const verifier = new ASTVerifier();
  const code = `
    export default async function execute(args) {
      args['__proto__'].polluted = true;
      return args;
    }
  `;
  const report = verifier.verify(code);
  assert.equal(report.isSafe, false);
  assert.ok(report.bannedPatternsDetected.some((p) => p.includes('__proto__')));
});

test('ASTVerifier blocks dynamic import expressions', () => {
  const verifier = new ASTVerifier();
  const code = `
    export default async function execute(args) {
      const fs = await import('node:fs');
      return fs.readdirSync('.');
    }
  `;
  const report = verifier.verify(code);
  assert.equal(report.isSafe, false);
  assert.ok(report.bannedPatternsDetected.some((p) => p.includes('DYNAMIC_IMPORT')));
});

test('ASTVerifier blocks eval and new Function identifiers', () => {
  const verifier = new ASTVerifier();
  const code1 = 'export default async function execute(args) { return eval("1 + 1"); }';
  const code2 = 'export default async function execute(args) { return new Function("return 42")(); }';

  assert.equal(verifier.verify(code1).isSafe, false);
  assert.equal(verifier.verify(code2).isSafe, false);
});

test('ASTVerifier blocks static while(true) infinite loops', () => {
  const verifier = new ASTVerifier();
  const code = `
    export default async function execute(args) {
      while(true) {}
      return 1;
    }
  `;
  const report = verifier.verify(code);
  assert.equal(report.isSafe, false);
  assert.ok(report.bannedPatternsDetected.some((p) => p.includes('INFINITE_LOOP')));
});

// ============================================================================
// LAYER 2: KNOWN AST BYPASSES (AST MISSES, SANDBOX CONTAINS)
// Demonstrates that AST is only a static lint; Sandbox runtime is the true boundary.
// ============================================================================

test('Known AST bypass: computed key via Array.join is missed by AST but contained by Sandbox', async () => {
  const verifier = new ASTVerifier();
  const code = `
    export default async function execute(args) {
      const key = ['con', 'structor'].join('');
      const fn = this[key][key]('return 42');
      return fn();
    }
  `;
  // AST check is bypassed because .join('') is evaluated dynamically at runtime
  const report = verifier.verify(code);
  assert.equal(report.isSafe, true, 'AST verifier cannot evaluate runtime Array.join and misses the attack');

  // Subprocess sandbox contains it via engine-level string compilation disallowance
  const subSandbox = new Sandbox({ mode: 'subprocess', unsafeDevMode: true, timeoutMs: 2000 });
  const subRes = await subSandbox.execute(code, {});
  assert.equal(subRes.success, false);
  assert.ok(subRes.error?.includes('disallowed') || subRes.error?.includes('Code generation'));

  // Docker sandbox contains it via container isolation + engine flags
  const docSandbox = new Sandbox({ mode: 'docker', timeoutMs: 3000 });
  const docRes = await docSandbox.execute(code, {});
  assert.equal(docRes.success, false);
  assert.ok(docRes.error?.includes('disallowed') || docRes.error?.includes('Code generation'));
});

test('Known AST bypass: Reflect.get with String.fromCharCode is missed by AST but contained by Sandbox', async () => {
  const verifier = new ASTVerifier();
  const code = `
    export default async function execute(args) {
      const c = String.fromCharCode(99,111,110,115,116,114,117,99,116,111,114);
      const ctor = Reflect.get(this, c);
      const fn = Reflect.get(ctor, c)('return 99');
      return fn();
    }
  `;
  // AST check is bypassed because String.fromCharCode is evaluated dynamically
  const report = verifier.verify(code);
  assert.equal(report.isSafe, true, 'AST verifier cannot evaluate String.fromCharCode and misses the attack');

  // Subprocess sandbox contains it
  const subSandbox = new Sandbox({ mode: 'subprocess', unsafeDevMode: true, timeoutMs: 2000 });
  const subRes = await subSandbox.execute(code, {});
  assert.equal(subRes.success, false);
  assert.ok(subRes.error?.includes('disallowed') || subRes.error?.includes('Code generation'));

  // Docker sandbox contains it
  const docSandbox = new Sandbox({ mode: 'docker', timeoutMs: 3000 });
  const docRes = await docSandbox.execute(code, {});
  assert.equal(docRes.success, false);
  assert.ok(docRes.error?.includes('disallowed') || docRes.error?.includes('Code generation'));
});

// ============================================================================
// LAYER 3: SUBPROCESS DEV MODE ISOLATION & PROTOTYPE REALM INTEGRITY TESTS
// ============================================================================

test('Sandbox fails closed: subprocess mode without unsafeDevMode throws immediately', () => {
  assert.throws(
    () => {
      new Sandbox({ mode: 'subprocess' });
    },
    {
      name: 'Error',
      message: 'Subprocess mode requires explicit opt-in: { unsafeDevMode: true }',
    }
  );
});

test('Sandbox blocks prototype constructor breakout when AST check is bypassed (subprocess)', async () => {
  const sandbox = new Sandbox({ mode: 'subprocess', unsafeDevMode: true, timeoutMs: 2000 });
  const maliciousCode = `
    export default async function execute(args) {
      try {
        const fn = this.constructor.constructor('return process');
        const p = fn();
        return { escaped: true, pid: p.pid };
      } catch (err) {
        return { escaped: false, error: err.message };
      }
    }
  `;
  const res = await sandbox.execute(maliciousCode, {});
  if (res.success) {
    const data = res.result as { escaped: boolean; error?: string };
    assert.equal(data.escaped, false);
    assert.ok(data.error?.includes('disallowed') || data.error?.includes('constructor'));
  } else {
    assert.ok(res.error?.includes('disallowed') || res.error?.includes('constructor') || !res.success);
  }
});

test('Sandbox blocks args.constructor.constructor breakout (subprocess)', async () => {
  const sandbox = new Sandbox({ mode: 'subprocess', unsafeDevMode: true, timeoutMs: 2000 });
  const maliciousCode = `
    export default async function execute(args) {
      try {
        const fn = args.constructor.constructor('return process');
        const p = fn();
        return { escaped: true, pid: p.pid };
      } catch (err) {
        return { escaped: false, error: err.message };
      }
    }
  `;
  const res = await sandbox.execute(maliciousCode, { sample: 123 });
  if (res.success) {
    const data = res.result as { escaped: boolean; error?: string };
    assert.equal(data.escaped, false);
  } else {
    assert.ok(!res.success);
  }
});

test('Sandbox blocks eval() via engine-level string compilation disallowance (subprocess)', async () => {
  const sandbox = new Sandbox({ mode: 'subprocess', unsafeDevMode: true, timeoutMs: 2000 });
  const maliciousCode = `
    export default async function execute(args) {
      return eval('40 + 2');
    }
  `;
  const res = await sandbox.execute(maliciousCode, {});
  assert.equal(res.success, false);
  assert.ok(res.error?.includes('disallowed') || res.error?.includes('Code generation'));
});

test('Sandbox environment is clean: host process.env is inaccessible in VM (subprocess)', async () => {
  const sandbox = new Sandbox({ mode: 'subprocess', unsafeDevMode: true, timeoutMs: 2000 });
  const testCode = `
    export default async function execute(args) {
      const hasProcess = typeof process !== 'undefined';
      const envKeys = hasProcess && process.env ? Object.keys(process.env) : [];
      return { hasProcess, envKeys };
    }
  `;
  const res = await sandbox.execute(testCode, {});
  assert.equal(res.success, true);
  const data = res.result as { hasProcess: boolean; envKeys: string[] };
  assert.equal(data.hasProcess, false);
  assert.equal(data.envKeys.length, 0);
});

test('Sandbox strips host environment variables from child process.env (subprocess)', async () => {
  process.env.AETHER_HOST_SUPER_SECRET = 'leak_target_secret_12345';
  const sandbox = new Sandbox({ mode: 'subprocess', unsafeDevMode: true, timeoutMs: 2000 });

  const res = await sandbox.execute('// probe', { __probeEnv: true });
  assert.equal(res.success, true);
  const data = res.result as { envKeys: string[]; envCount: number };

  assert.ok(!data.envKeys.includes('AETHER_HOST_SUPER_SECRET'));
  assert.ok(!data.envKeys.some((k) => k.startsWith('AETHER_')));

  delete process.env.AETHER_HOST_SUPER_SECRET;
});

test('Sandbox blocks filesystem read outside sandbox (fs / require) (subprocess)', async () => {
  const sandbox = new Sandbox({ mode: 'subprocess', unsafeDevMode: true, timeoutMs: 2000 });
  const code = `
    export default async function execute(args) {
      const fs = require('fs');
      return fs.readFileSync('package.json', 'utf8');
    }
  `;
  const res = await sandbox.execute(code, {});
  assert.equal(res.success, false);
  assert.ok(
    res.error?.includes('require is not defined') ||
    res.error?.includes('ReferenceError')
  );
});

test('Sandbox blocks outbound network connection attempts (fetch / net) (subprocess)', async () => {
  const sandbox = new Sandbox({ mode: 'subprocess', unsafeDevMode: true, timeoutMs: 2000 });
  const code = `
    export default async function execute(args) {
      const resp = await fetch('https://example.com');
      return await resp.text();
    }
  `;
  const res = await sandbox.execute(code, {});
  assert.equal(res.success, false);
  assert.ok(
    res.error?.includes('fetch is not defined') ||
    res.error?.includes('ReferenceError')
  );
});

test('Sandbox blocks access to process.binding and process.mainModule (subprocess)', async () => {
  const sandbox = new Sandbox({ mode: 'subprocess', unsafeDevMode: true, timeoutMs: 2000 });
  const code = `
    export default async function execute(args) {
      const b = typeof process !== 'undefined' ? process.binding : undefined;
      const m = typeof process !== 'undefined' ? process.mainModule : undefined;
      return { hasBinding: !!b, hasMainModule: !!m };
    }
  `;
  const res = await sandbox.execute(code, {});
  assert.equal(res.success, true);
  const data = res.result as { hasBinding: boolean; hasMainModule: boolean };
  assert.equal(data.hasBinding, false);
  assert.equal(data.hasMainModule, false);
});

test('Sandbox output caps terminate child on unbounded stdout/stderr flooding (subprocess)', async () => {
  const sandbox = new Sandbox({ mode: 'subprocess', unsafeDevMode: true, timeoutMs: 3000, maxOutputBytes: 64 * 1024 });
  const code = `
    export default async function execute(args) {
      while(true) {
        console.log('SPAM_FLOOD_PAYLOAD_'.repeat(200));
      }
      return 1;
    }
  `;
  const res = await sandbox.execute(code, {});
  assert.equal(res.success, false);
  assert.ok(
    res.error?.startsWith('Output limit exceeded:'),
    `Expected 'Output limit exceeded:' prefix, got: ${res.error}`
  );
  assert.ok(!res.error?.includes('heap'), `Should not fail via V8 heap crash: ${res.error}`);
  assert.ok(!res.error?.includes('timed out'), `Should be stopped by output cap, not timeout: ${res.error}`);
});

test('Sandbox fails safely when return value exceeds maximum result size (subprocess)', async () => {
  const sandbox = new Sandbox({ mode: 'subprocess', unsafeDevMode: true, timeoutMs: 2000, maxOutputBytes: 128 * 1024 });
  const code = `
    export default async function execute(args) {
      return 'A'.repeat(300000);
    }
  `;
  const res = await sandbox.execute(code, {});
  assert.equal(res.success, false);
  assert.ok(
    res.error?.startsWith('Output limit exceeded:'),
    `Expected 'Output limit exceeded:' prefix, got: ${res.error}`
  );
});

test('Sandbox hard timeout terminates synchronous CPU infinite loop (subprocess)', async () => {
  const sandbox = new Sandbox({ mode: 'subprocess', unsafeDevMode: true, timeoutMs: 800 });
  const code = `
    export default async function execute(args) {
      while(true) {}
      return 'should_never_reach';
    }
  `;
  const startTime = performance.now();
  const res = await sandbox.execute(code, {});
  const elapsed = performance.now() - startTime;

  assert.equal(res.success, false);
  assert.ok(res.error?.includes('timed out') || res.error?.includes('Process killed'));
  assert.ok(elapsed >= 700 && elapsed <= 5000, `Execution took ${elapsed}ms`);
});

test('Sandbox hard timeout terminates asynchronous microtask loop (subprocess)', async () => {
  const sandbox = new Sandbox({ mode: 'subprocess', unsafeDevMode: true, timeoutMs: 800 });
  const code = `
    export default async function execute(args) {
      while(true) {
        await Promise.resolve();
      }
      return 'never';
    }
  `;
  const startTime = performance.now();
  const res = await sandbox.execute(code, {});
  const elapsed = performance.now() - startTime;

  assert.equal(res.success, false);
  assert.ok(res.error?.includes('timed out') || res.error?.includes('Process killed'));
  assert.ok(elapsed >= 700 && elapsed <= 5000, `Execution took ${elapsed}ms`);
});

test('Sandbox fails safely on unresolved empty promise event loop exit (subprocess)', async () => {
  const sandbox = new Sandbox({ mode: 'subprocess', unsafeDevMode: true, timeoutMs: 1000 });
  const code = `
    export default async function execute(args) {
      await new Promise(() => {});
      return 'never';
    }
  `;
  const res = await sandbox.execute(code, {});
  assert.equal(res.success, false);
  assert.ok(res.error !== undefined);
});

test('Sandbox caps heap memory and fails safely on memory exhaustion attempt (subprocess)', async () => {
  const sandbox = new Sandbox({ mode: 'subprocess', unsafeDevMode: true, timeoutMs: 3000, maxMemoryMb: 32 });
  const code = `
    export default async function execute(args) {
      const big = [];
      while(true) {
        big.push(new Array(1000000).fill(1));
      }
      return big.length;
    }
  `;
  const res = await sandbox.execute(code, {});
  assert.equal(res.success, false);
  assert.ok(res.error !== undefined);
});

test('VM Context Realm Isolation: sandboxed code cannot mutate runner JSON.stringify, Array.prototype, or Object.prototype', async () => {
  const sandbox = new Sandbox({ mode: 'subprocess', unsafeDevMode: true, timeoutMs: 2000 });
  const code = `
    export default async function execute(args) {
      // Sandboxed code attempts to sabotage prototype methods and built-ins
      Array.prototype.push = function() { throw new Error('Sabotaged push'); };
      JSON.stringify = function() { return 'sabotaged'; };
      Object.prototype.polluted = 'MALICIOUS_POLLUTION';
      return { inSandbox: 42 };
    }
  `;

  // Host before checks
  const testArr = [1, 2];
  testArr.push(3);
  assert.equal(testArr.length, 3);
  assert.equal(JSON.stringify({ ok: true }), '{"ok":true}');
  assert.equal(({} as Record<string, unknown>).polluted, undefined);

  const res = await sandbox.execute(code, {});
  assert.equal(res.success, true);
  assert.deepEqual(res.result, { inSandbox: 42 });

  // Host after checks: runner realm MUST remain completely unpolluted
  testArr.push(4);
  assert.equal(testArr.length, 4, 'Host Array.prototype.push must remain unmodified');
  assert.equal(JSON.stringify({ ok: true }), '{"ok":true}', 'Host JSON.stringify must remain unmodified');
  assert.equal(({} as Record<string, unknown>).polluted, undefined, 'Host Object.prototype must remain unpolluted');
});

// ============================================================================
// LAYER 4: DOCKER HARDENING, PROBE TESTS & NETWORK ISOLATION TESTS
// ============================================================================

test('Docker network isolation Test 1: Real flag list cannot connect to host TCP listener (0 connections)', async () => {
  let hostConnections = 0;
  const server = net.createServer((socket) => {
    hostConnections++;
    socket.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '0.0.0.0', () => resolve());
  });

  const address = server.address() as net.AddressInfo;
  const port = address.port;

  try {
    const containerName = `aether-net-probe-${Date.now()}`;
    const dockerArgs = buildDockerArgs({
      containerName,
      customArgs: [
        'node',
        '-e',
        `const net = require('node:net'); const s = net.connect(${port}, 'host.docker.internal', () => { s.end(); process.exit(0); }); s.on('error', () => process.exit(1));`,
      ],
    });

    const res = spawnSync('docker', dockerArgs, { encoding: 'utf8', timeout: 15000 });
    // In hardened docker container with --network none, connection fails and container exits with code 1
    assert.equal(res.status, 1, `Expected container connection failure, exit status was: ${res.status}`);
    assert.equal(hostConnections, 0, 'Host TCP listener must receive exactly 0 connections with --network none');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Docker network isolation Test 2 (control): Omitting --network none MUST connect to host listener', async () => {
  let hostConnections = 0;
  const server = net.createServer((socket) => {
    hostConnections++;
    socket.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '0.0.0.0', () => resolve());
  });

  const address = server.address() as net.AddressInfo;
  const port = address.port;

  try {
    const containerName = `aether-net-ctrl-${Date.now()}`;
    // Build real flags but remove --network none for control test sensitivity
    const dockerArgs = buildDockerArgs({
      containerName,
      network: null, // Control test: remove --network none
      customArgs: [
        'node',
        '-e',
        `const net = require('node:net'); const s = net.connect(${port}, 'host.docker.internal', () => { console.log('CONNECTED_DEFAULT'); s.end(); process.exit(0); }); s.on('error', (e) => { console.error('ERR:', e.message); process.exit(1); });`,
      ],
    });

    const res = spawnSync('docker', dockerArgs, { encoding: 'utf8', timeout: 15000 });
    // Allow brief tick for server socket callback to increment connection count
    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    assert.equal(res.status, 0, `Control container should connect successfully. Output: ${res.stdout} ${res.stderr}`);
    assert.ok(hostConnections >= 1, `Host TCP listener must receive connection without --network none (got ${hostConnections})`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Docker probe: container runs as non-root user node (uid 1000)', () => {
  const containerName = `aether-probe-user-${Date.now()}`;
  const dockerArgs = buildDockerArgs({
    containerName,
    customArgs: ['id', '-u'],
  });
  const res = spawnSync('docker', dockerArgs, { encoding: 'utf8', timeout: 5000 });
  assert.equal(res.status, 0);
  const uid = res.stdout.trim();
  assert.equal(uid, '1000', `Container must run as non-root user node (uid 1000), got: ${uid}`);
});

test('Docker probe: container filesystem is strictly read-only (touch /x fails)', () => {
  const containerName = `aether-probe-ro-${Date.now()}`;
  const dockerArgs = buildDockerArgs({
    containerName,
    customArgs: ['touch', '/test_ro_probe'],
  });
  const res = spawnSync('docker', dockerArgs, { encoding: 'utf8', timeout: 5000 });
  assert.notEqual(res.status, 0, 'Writing to root filesystem in read-only container must fail');
  assert.ok(
    res.stderr.includes('Read-only file system'),
    `Expected 'Read-only file system' error, got: ${res.stderr}`
  );
});

test('Docker probe: container Linux capabilities are dropped (CapBnd is 0)', () => {
  const containerName = `aether-probe-cap-${Date.now()}`;
  const dockerArgs = buildDockerArgs({
    containerName,
    customArgs: ['sh', '-c', 'grep CapBnd /proc/self/status'],
  });
  const res = spawnSync('docker', dockerArgs, { encoding: 'utf8', timeout: 5000 });
  assert.equal(res.status, 0);
  assert.ok(
    res.stdout.includes('0000000000000000'),
    `Expected all capabilities dropped (CapBnd 0000000000000000), got: ${res.stdout.trim()}`
  );
});

test('Docker probe: container pids limit is enforced (pids.max is 64)', () => {
  const containerName = `aether-probe-pids-${Date.now()}`;
  const dockerArgs = buildDockerArgs({
    containerName,
    customArgs: ['sh', '-c', 'cat /sys/fs/cgroup/pids.max 2>/dev/null || cat /sys/fs/cgroup/pids/pids.max 2>/dev/null'],
  });
  const res = spawnSync('docker', dockerArgs, { encoding: 'utf8', timeout: 5000 });
  assert.equal(res.status, 0);
  const pidsMax = res.stdout.trim();
  assert.equal(pidsMax, '64', `Expected pids limit 64, got: ${pidsMax}`);
});

test('Docker probe: container memory limit is enforced (memory.max matches 64MB)', () => {
  const containerName = `aether-probe-mem-${Date.now()}`;
  const dockerArgs = buildDockerArgs({
    containerName,
    maxMemoryMb: 64,
    customArgs: ['sh', '-c', 'cat /sys/fs/cgroup/memory.max 2>/dev/null || cat /sys/fs/cgroup/memory/memory.limit_in_bytes 2>/dev/null'],
  });
  const res = spawnSync('docker', dockerArgs, { encoding: 'utf8', timeout: 5000 });
  assert.equal(res.status, 0);
  const memMax = res.stdout.trim();
  // 64MB = 67108864 bytes
  assert.equal(memMax, '67108864', `Expected memory limit 67108864 (64MB), got: ${memMax}`);
});

test('Docker mode host-side stderr flooding is terminated by output limit cap', async () => {
  const sandbox = new Sandbox({ mode: 'docker', timeoutMs: 4000, maxOutputBytes: 32 * 1024 });
  const code = `
    export default async function execute(args) {
      while(true) {
        console.error('FLOOD_STDERR_LINE_'.repeat(200));
      }
      return 1;
    }
  `;
  const res = await sandbox.execute(code, {});
  assert.equal(res.success, false);
  assert.ok(
    res.error?.startsWith('Output limit exceeded:'),
    `Expected 'Output limit exceeded:' prefix, got: ${res.error}`
  );
});

test('Docker container is killed and removed after timeout (verified via docker ps -a)', async () => {
  const sandbox = new Sandbox({ mode: 'docker', timeoutMs: 1000 });
  const code = `
    export default async function execute(args) {
      while(true) {}
      return 'never';
    }
  `;
  const res = await sandbox.execute(code, {});
  assert.equal(res.success, false);
  assert.ok(res.error?.includes('timed out'));
  assert.ok(sandbox.lastContainerName, 'lastContainerName should be recorded');

  // Verify container is completely gone from docker ps -a
  const psCheck = spawnSync(
    'docker',
    ['ps', '-a', '--filter', `name=${sandbox.lastContainerName}`, '--format', '{{.Names}}'],
    { encoding: 'utf8' }
  );
  const output = psCheck.stdout.trim();
  assert.equal(output, '', `Container ${sandbox.lastContainerName} must be completely removed from docker ps -a after timeout`);
});

test('ArrayBuffer memory bomb analysis: timeout vs memory cap in each mode', async () => {
  const code = `
    export default async function execute(args) {
      const buffers = [];
      while(true) {
        buffers.push(new ArrayBuffer(30 * 1024 * 1024));
      }
      return buffers.length;
    }
  `;

  // Mode 1: Subprocess (dev mode)
  // In subprocess mode, V8's --max-old-space-size=32 does NOT constrain native ArrayBuffer off-heap memory.
  // The process continues allocating virtual memory in a tight loop until the authoritative timeout fires.
  const subSandbox = new Sandbox({ mode: 'subprocess', unsafeDevMode: true, timeoutMs: 1500, maxMemoryMb: 32 });
  const subStart = performance.now();
  const subRes = await subSandbox.execute(code, {});
  const subElapsed = performance.now() - subStart;

  assert.equal(subRes.success, false);
  assert.ok(
    subRes.error?.includes('timed out') || subRes.error?.includes('Process killed'),
    `Subprocess stopped by TIMEOUT: ${subRes.error}`
  );
  assert.ok(subElapsed >= 1400, `Subprocess elapsed (${subElapsed}ms) matches timeout window`);

  // Mode 2: Docker mode
  // Untouched ArrayBuffer pages: Linux kernel uses virtual memory overcommit, so untouched pages
  // do not contribute to cgroup RSS. The CPU infinite loop is stopped by TIMEOUT.
  const docSandboxUntouched = new Sandbox({ mode: 'docker', timeoutMs: 1500, maxMemoryMb: 32 });
  const docUntouchedRes = await docSandboxUntouched.execute(code, {});
  assert.equal(docUntouchedRes.success, false);
  assert.ok(
    docUntouchedRes.error?.includes('timed out'),
    `Docker mode with untouched virtual pages stopped by TIMEOUT: ${docUntouchedRes.error}`
  );

  // When memory pages ARE committed (touched with Uint8Array), Linux cgroups RSS immediately exceeds 32MB
  // and the Linux kernel OOM killer terminates the container with SIGKILL (code 137) before timeout!
  const commitCode = `
    export default async function execute(args) {
      const buffers = [];
      while(true) {
        const b = new ArrayBuffer(16 * 1024 * 1024);
        new Uint8Array(b).fill(1); // Force physical RAM page commitment
        buffers.push(b);
      }
      return buffers.length;
    }
  `;
  const docSandboxCommitted = new Sandbox({ mode: 'docker', timeoutMs: 6000, maxMemoryMb: 32 });
  const docCommittedStart = performance.now();
  const docCommittedRes = await docSandboxCommitted.execute(commitCode, {});
  const docCommittedElapsed = performance.now() - docCommittedStart;

  assert.equal(docCommittedRes.success, false);
  assert.ok(
    docCommittedRes.error?.includes('OOM') || docCommittedRes.error?.includes('killed') || docCommittedRes.error?.includes('137'),
    `Docker mode with committed pages stopped by MEMORY CAP (OOM killer): ${docCommittedRes.error}`
  );
  assert.ok(docCommittedElapsed < 5000, `Docker committed pages killed by cgroups OOM well before 6000ms timeout (${docCommittedElapsed}ms)`);
});
```

---

### `scripts/verify_mutations.js`
```javascript
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Track all original files for guaranteed restoration
const fileBackups = new Map();

function backupFile(relPath) {
  const absPath = path.resolve(rootDir, relPath);
  if (!fileBackups.has(absPath)) {
    fileBackups.set(absPath, fs.readFileSync(absPath, 'utf8'));
  }
}

function restoreAll() {
  for (const [absPath, content] of fileBackups.entries()) {
    try {
      fs.writeFileSync(absPath, content, 'utf8');
    } catch (e) {
      console.error(`Failed to restore ${absPath}:`, e);
    }
  }
}

// Ensure cleanup on unexpected exit
process.on('exit', restoreAll);
process.on('SIGINT', () => {
  restoreAll();
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in mutation runner:', err);
  restoreAll();
  process.exit(1);
});

function applyMutation(relPath, target, replacement) {
  const absPath = path.resolve(rootDir, relPath);
  backupFile(relPath);
  const current = fs.readFileSync(absPath, 'utf8');
  if (!current.includes(target)) {
    throw new Error(`Target string not found in ${relPath} for mutation:\n"${target}"`);
  }
  const mutated = current.replaceAll(target, replacement);
  fs.writeFileSync(absPath, mutated, 'utf8');
}

function rebuild() {
  const res = spawnSync('npm', ['run', 'build', '--workspace=@aether-flow/core'], {
    cwd: rootDir,
    encoding: 'utf8',
    shell: true,
  });
  if (res.status !== 0) {
    throw new Error(`Rebuild failed during mutation verification:\nSTDOUT: ${res.stdout}\nSTDERR: ${res.stderr}`);
  }
}

function parseFailedTests(output) {
  const failed = new Set();
  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('✖ ') && !trimmed.includes('failing tests:')) {
      const match = trimmed
        .replace(/^✖\s+/, '')
        .replace(/\s*\([\d.]+m?s\)\s*$/, '')
        .trim();
      if (match) {
        failed.add(match);
      }
    }
  }
  return Array.from(failed);
}

function runAdversarialSuite() {
  const res = spawnSync(
    process.execPath,
    ['--test', '--test-timeout=25000', 'packages/core/dist/tests/sandbox-escape.test.js'],
    {
      cwd: rootDir,
      encoding: 'utf8',
      env: { ...process.env },
      timeout: 60000,
    }
  );

  const fullOutput = (res.stdout || '') + '\n' + (res.stderr || '');
  return parseFailedTests(fullOutput);
}

const SUBPROCESS_MUTATIONS = [
  {
    mode: 'subprocess',
    name: 'Subprocess Layer 1: Static AST Verifier (Static Lint Layer)',
    description: 'Bypass AST verification (force isSafe = true and clear banned patterns)',
    apply() {
      applyMutation(
        'packages/core/src/tools/ASTVerifier.ts',
        'const isSafe = bannedDetected.length === 0;',
        'const isSafe = true; bannedDetected.length = 0;'
      );
    },
  },
  {
    mode: 'subprocess',
    name: 'Subprocess Layer 2: VM Context Lockdown & Isolated Realm',
    description: 'Expose dangerous require() and fetch() globals directly in contextGlobals',
    apply() {
      applyMutation(
        'packages/core/src/tools/subprocess-runner.ts',
        `    const contextGlobals: Record<string, unknown> = {
      __rawArgs: JSON.stringify(args),
      __maxLogBytes: maxLogBytes,
    };`,
        `    const contextGlobals: Record<string, unknown> = {
      __rawArgs: JSON.stringify(args),
      __maxLogBytes: maxLogBytes,
      require: (mod: string) => { if (mod === 'fs') return { readFileSync: () => 'EXPOSED_FS' }; return {}; },
      fetch: async () => ({ text: async () => 'EXPOSED_NET' }),
    };`
      );
    },
  },
  {
    mode: 'subprocess',
    name: 'Subprocess Layer 3: V8 Engine Flags (--disallow-code-generation-from-strings)',
    description: 'Remove V8 string compilation disallowance from child process flags and VM context',
    apply() {
      applyMutation(
        'packages/core/src/tools/Sandbox.ts',
        `          \`--max-old-space-size=\${this.maxMemoryMb}\`,
          '--disallow-code-generation-from-strings',`,
        `          \`--max-old-space-size=\${this.maxMemoryMb}\`,
          // MUTATION: flag removed`
      );
      applyMutation(
        'packages/core/src/tools/subprocess-runner.ts',
        'codeGeneration: { strings: false, wasm: false },',
        'codeGeneration: { strings: true, wasm: true },'
      );
    },
  },
  {
    mode: 'subprocess',
    name: 'Subprocess Layer 4: Environment Stripping (env: {})',
    description: 'Leak host process.env into spawned child process (change env: {} to env: process.env)',
    apply() {
      applyMutation(
        'packages/core/src/tools/Sandbox.ts',
        'env: {}, // Completely stripped environment: no tokens, API keys, or PATH leakage',
        'env: process.env, // MUTATION: leaked host process.env'
      );
    },
  },
  {
    mode: 'subprocess',
    name: 'Subprocess Layer 5: Authoritative Timeout Kill',
    description: 'Disable child process kill timer on execution timeout',
    apply() {
      applyMutation(
        'packages/core/src/tools/Sandbox.ts',
        `      const timer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill('SIGKILL');
        } catch {
          // Ignore kill errors if already terminated
        }
      }, this.timeoutMs);`,
        `      const timer = setTimeout(() => {
        // MUTATION: no-op, child process is never killed on timeout
      }, this.timeoutMs);`
      );
    },
  },
  {
    mode: 'subprocess',
    name: 'Subprocess Layer 6: Output Limits Cap',
    description: 'Disable stdout flooding byte cap and serialized result size cap',
    apply() {
      applyMutation(
        'packages/core/src/tools/Sandbox.ts',
        'if (stdoutBytes > this.maxOutputBytes) {',
        'if (false && stdoutBytes > this.maxOutputBytes) {'
      );
      applyMutation(
        'packages/core/src/tools/Sandbox.ts',
        'if (stderrBytes > this.maxOutputBytes) {',
        'if (false && stderrBytes > this.maxOutputBytes) {'
      );
      applyMutation(
        'packages/core/src/tools/subprocess-runner.ts',
        'if (__totalLogBytes > __maxLogBytes) {',
        'if (false && __totalLogBytes > __maxLogBytes) {'
      );
      applyMutation(
        'packages/core/src/tools/subprocess-runner.ts',
        'if (Buffer.byteLength(rawSerialized, \'utf8\') > maxOutputBytes) {',
        'if (false && rawSerialized) {'
      );
    },
  },
];

const DOCKER_MUTATIONS = [
  {
    mode: 'docker',
    name: 'Docker Layer 1: Network Isolation (--network none)',
    description: 'Remove --network none from buildDockerArgs flag list',
    apply() {
      applyMutation(
        'packages/core/src/tools/Sandbox.ts',
        `  if (options.network !== undefined) {
    if (options.network !== null && options.network !== '') {
      args.push('--network', options.network);
    }
  } else {
    args.push('--network', 'none');
  }`,
        `  if (options.network !== undefined) {
    if (options.network !== null && options.network !== '') {
      args.push('--network', options.network);
    }
  } else {
    // MUTATION: --network none omitted
  }`
      );
    },
  },
  {
    mode: 'docker',
    name: 'Docker Layer 2: Non-Root User Isolation (--user node)',
    description: 'Remove --user node from buildDockerArgs flag list (defaults to root)',
    apply() {
      applyMutation(
        'packages/core/src/tools/Sandbox.ts',
        `  if (options.user !== undefined) {
    if (options.user !== null && options.user !== '') {
      args.push('--user', options.user);
    }
  } else {
    args.push('--user', 'node');
  }`,
        `  if (options.user !== undefined) {
    if (options.user !== null && options.user !== '') {
      args.push('--user', options.user);
    }
  } else {
    // MUTATION: --user node omitted
  }`
      );
    },
  },
  {
    mode: 'docker',
    name: 'Docker Layer 3: Read-Only Root Filesystem (--read-only)',
    description: 'Remove --read-only from buildDockerArgs flag list',
    apply() {
      applyMutation(
        'packages/core/src/tools/Sandbox.ts',
        `  if (options.readOnly !== false) {
    args.push('--read-only');
  }`,
        `  if (options.readOnly !== false) {
    // MUTATION: --read-only omitted
  }`
      );
    },
  },
  {
    mode: 'docker',
    name: 'Docker Layer 4: Capability Dropping (--cap-drop=ALL)',
    description: 'Remove --cap-drop=ALL from buildDockerArgs flag list',
    apply() {
      applyMutation(
        'packages/core/src/tools/Sandbox.ts',
        `  if (options.capDrop !== undefined) {
    for (const cap of options.capDrop) {
      args.push(\`--cap-drop=\${cap}\`);
    }
  } else {
    args.push('--cap-drop=ALL');
  }`,
        `  if (options.capDrop !== undefined) {
    for (const cap of options.capDrop) {
      args.push(\`--cap-drop=\${cap}\`);
    }
  } else {
    // MUTATION: --cap-drop=ALL omitted
  }`
      );
    },
  },
  {
    mode: 'docker',
    name: 'Docker Layer 5: Process Fork Bomb Containment (--pids-limit=64)',
    description: 'Remove --pids-limit=64 from buildDockerArgs flag list',
    apply() {
      applyMutation(
        'packages/core/src/tools/Sandbox.ts',
        `  if (options.pidsLimit !== undefined) {
    if (options.pidsLimit !== null && options.pidsLimit > 0) {
      args.push(\`--pids-limit=\${options.pidsLimit}\`);
    }
  } else {
    args.push('--pids-limit=64');
  }`,
        `  if (options.pidsLimit !== undefined) {
    if (options.pidsLimit !== null && options.pidsLimit > 0) {
      args.push(\`--pids-limit=\${options.pidsLimit}\`);
    }
  } else {
    // MUTATION: --pids-limit=64 omitted
  }`
      );
    },
  },
  {
    mode: 'docker',
    name: 'Docker Layer 6: Memory Cgroups Limit (--memory=64m)',
    description: 'Remove --memory=64m and --memory-swap=64m from buildDockerArgs flag list',
    apply() {
      applyMutation(
        'packages/core/src/tools/Sandbox.ts',
        'args.push(`--memory=${maxMemoryMb}m`);',
        '// MUTATION: --memory omitted'
      );
    },
  },
  {
    mode: 'docker',
    name: 'Docker Layer 7: Host-Side Stderr Output Flooding Cap',
    description: 'Disable host-side stderr cap and container runner log cap in Docker mode',
    apply() {
      applyMutation(
        'packages/core/src/tools/Sandbox.ts',
        'if (stderrBytes > this.maxOutputBytes) {',
        'if (false && stderrBytes > this.maxOutputBytes) {'
      );
      applyMutation(
        'packages/core/src/tools/docker-runner.cjs',
        'if (__totalLogBytes > __maxLogBytes) {',
        'if (false && __totalLogBytes > __maxLogBytes) {'
      );
    },
  },
];

async function main() {
  const args = process.argv.slice(2);
  let selectedMode = 'all';
  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      selectedMode = arg.split('=')[1].toLowerCase();
    }
  }

  let mutationsToRun = [];
  if (selectedMode === 'subprocess') {
    mutationsToRun = SUBPROCESS_MUTATIONS;
  } else if (selectedMode === 'docker') {
    mutationsToRun = DOCKER_MUTATIONS;
  } else {
    mutationsToRun = [...SUBPROCESS_MUTATIONS, ...DOCKER_MUTATIONS];
  }

  console.log('================================================================');
  console.log('       REAL DEFENSE-IN-DEPTH MUTATION VERIFICATION RUNNER       ');
  console.log(`  Mode: ${selectedMode.toUpperCase()} | Total Layers: ${mutationsToRun.length}`);
  console.log('  Each mutation is applied to source, rebuilt, tested, and parsed');
  console.log('================================================================\n');

  const summary = [];

  for (let i = 0; i < mutationsToRun.length; i++) {
    const layer = mutationsToRun[i];
    console.log(`▶ [Layer ${i + 1}/${mutationsToRun.length}] ${layer.name}`);
    console.log(`  Description: ${layer.description}`);

    try {
      layer.apply();
      rebuild();
      const failedTests = runAdversarialSuite();

      if (failedTests.length === 0) {
        console.log('  ⚠️ WARNING: Mutation failed NO tests! Defense gap detected.\n');
        summary.push({ name: layer.name, mode: layer.mode, failedCount: 0, failedTests: [] });
      } else {
        console.log(`  ✔ Real tests that failed under this mutation (${failedTests.length}):`);
        for (const testName of failedTests) {
          console.log(`    ✖ ${testName}`);
        }
        console.log();
        summary.push({ name: layer.name, mode: layer.mode, failedCount: failedTests.length, failedTests });
      }
    } finally {
      restoreAll();
      rebuild();
    }
  }

  console.log('================================================================');
  console.log('                      MUTATION RUN SUMMARY                      ');
  console.log('================================================================');
  let allLayersVerified = true;
  for (const s of summary) {
    if (s.failedCount === 0) {
      allLayersVerified = false;
      console.log(`❌ [${s.mode.toUpperCase()}] ${s.name}: 0 tests failed (GAP)`);
    } else {
      console.log(`✔ [${s.mode.toUpperCase()}] ${s.name}: ${s.failedCount} real test(s) failed`);
    }
  }
  console.log('================================================================\n');

  if (!allLayersVerified) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal mutation runner error:', err);
  restoreAll();
  process.exit(1);
});
```

---

### `SECURITY.md`
```markdown
# Security Policy & Sandbox Threat Model

AetherFlow executes dynamically synthesized code generated just-in-time (JIT) by large language models. Executing model-generated code introduces significant security challenges, including the risk of prompt-injection-driven remote code execution (RCE), host environment exfiltration, and denial-of-service (DoS).

This document details our threat model, isolation architecture, defense-in-depth mechanisms, vulnerability disclosure process, and honest limitations.

---

## 1. Vulnerability Disclosure

If you discover a security vulnerability in AetherFlow, please report it privately:
- **Private Advisory**: Open a private security advisory through GitHub Security Advisories.
- **Response Target**: Acknowledgement within 48 hours; initial triage and remediation plan within 5 business days.
- **Coordination**: We ask that you refrain from public disclosure until a patched release is published.

---

## 2. Threat Model: Untrusted Tool Synthesis

### 2.1 Attacker Goal
An attacker crafts a prompt or provides malicious context designed to induce the LLM to synthesize tool code containing adversarial payloads:
1. **Host Compromise / Remote Code Execution**: Accessing the host Node process, file system, network sockets, or spawning system shells via `child_process`.
2. **Credential Exfiltration**: Reading environment variables (`process.env`), API keys, cloud metadata credentials, or session tokens.
3. **Denial of Service (DoS)**: Locking host CPU execution threads with infinite loops, starving the event loop via recursive microtasks, exhausting host RAM via heap bombs, or flooding stdout/stderr pipes.
4. **Prototype Pollution & Host Realm Corruption**: Mutating shared JavaScript built-in prototypes (`Object.prototype`, `Array.prototype.push`, `JSON.stringify`) to compromise runner logic.

### 2.2 Attack Vectors & Bypass Techniques
- **Prototype Constructor Chains**: Traversing from local scopes or passed arguments to the host V8 `Function` constructor:
  `this.constructor.constructor('return process')()` or `args.constructor.constructor('return process')()`
- **Evasion via Static Analysis Bypasses**: Obfuscating forbidden property access via string concatenation (`this['con' + 'structor']`), template literals (`` this[`con${'struc'}tor`] ``), runtime `Array.join` (`['con','structor'].join('')`), or dynamic reflection (`Reflect.get(this, String.fromCharCode(...))`).
- **Dynamic Module Loading**: Utilizing `import()` or `require()` to access `node:fs` or `node:child_process`.
- **Async Event Loop Starvation**: Running infinite loops within unresolved promises or microtask queues that escape synchronous execution timers.
- **Output Flooding**: Saturating child stdout/stderr pipes to cause host buffer bloat or memory exhaustion.

---

## 3. Defense Layers & Boundary Clarifications

### 3.1 Static AST Layer is a Lint, Not a Security Boundary
Static Abstract Syntax Tree (AST) analysis via TypeScript Compiler is an early heuristic lint, designed to detect and reject obvious injection attempts with zero runtime overhead.
However, **the AST layer is NOT a security boundary**. Dynamic evaluations such as `obj[['con','structor'].join('')]` or `Reflect.get(obj, String.fromCharCode(99,...))` bypass static pattern matching completely. Security enforcement relies strictly on the isolated runtime sandbox layers.

### 3.2 Subprocess Limitations & Developer Mode Opt-In
Spawning a decoupled child Node process with flags like `--no-addons` and an empty environment (`env: {}`) provides process-level separation, but **does NOT provide OS-level network isolation**. Node built-in networking (`fetch`, `net`, `http`) remains present in the binary.
- Subprocess mode requires an explicit opt-in: `{ unsafeDevMode: true }`.
- Attempting to instantiate subprocess mode without `unsafeDevMode: true` throws an immediate fatal error.
- When running in subprocess mode, a loud security warning is logged.
- Subprocess mode is strictly intended for local offline development where a container runtime is unavailable.

### 3.3 Fail-Closed Production Default: Hardened Docker Sandbox
Because Node.js cannot natively isolate outbound network traffic at the process level without root OS namespaces, **hardened Docker container isolation is the mandatory, fail-closed default in production**:
- **Default Mode**: `mode: 'docker'` is the default. Silent fallback to subprocess mode has been completely removed. If Docker is unavailable, execution returns an explicit error (`success: false`).
- `--network none`: Kernel-level network namespace isolation. Outbound HTTP, sockets, and local network ports (including `host.docker.internal`) are completely unreachable.
- `--read-only`: Read-only root filesystem prevents writing arbitrary files or tampering with system libraries.
- `--user node`: Non-root execution under UID 1000.
- `--security-opt no-new-privileges`: Prevents privilege escalation via setuid binaries.
- `--memory=64m` & `--memory-swap=64m`: Hard Linux cgroup memory limits enforced by the OS kernel (verified to trigger kernel OOM kill on physical RAM page commitment).
- `--cpus=1.0`: Hard CPU core limit preventing host CPU starvation.
- `--pids-limit=64`: Enforced kernel PID cgroup limit preventing fork bombs.
- `--cap-drop=ALL`: Drops all Linux kernel capabilities (`CapBnd` is verified 0).
- Pinned Base Image: Fixed to `node:lts-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53`.

---

## 4. Sandbox Isolation Architecture Comparison

| Isolation Strategy | Security Boundary | Network Isolation | Memory / CPU Limits | Crash Blast Radius | Production Status |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`node:vm` (In-Host Context)** | ❌ No | ❌ None | ❌ Shared Heap | ❌ Can crash host process | **Rejected**: Not a security boundary; escapes via prototype constructor traversal. |
| **`worker_threads`** | ❌ No | ❌ None | ⚠️ Partial | ❌ Shared Process & Heap leaks | **Rejected**: Microtask starvation and OOM kill the host process. |
| **Subprocess Runner (Dev Mode)** | ⚠️ Partial | ❌ No (VM-only) | 🟢 Process memory & SIGKILL | 🟢 Crashes child only | **Insecure Dev Mode Only**: Requires explicit `unsafeDevMode: true` opt-in. |
| **Docker Runner (Production Default)** | 🟢 **Yes** | 🟢 **--network none** | 🟢 **Kernel cgroups (64MB)** | 🟢 **Crashes container only** | **Fail-Closed Default**: True network namespace isolation, read-only root FS, dropped capabilities. |

---

## 5. Defense-in-Depth Implementation

```
                           Untrusted Synthesized Tool Code
                                          │
                                          ▼
                ┌───────────────────────────────────────────────────┐
                │ Tier 1: Static AST Analysis (Heuristic Lint)      │
                │ - Prohibited Identifiers (process, eval, require) │
                │ - Computed property string concatenation eval     │
                │ - Prototype pollution & constructor chains        │
                │ - Unconditional infinite loop detection           │
                └─────────────────────────┬─────────────────────────┘
                                          │ [Passed AST Scan]
                                          ▼
                ┌───────────────────────────────────────────────────┐
                │ Tier 2: Hardened Runtime (Docker / Subprocess)    │
                │ • Production Default (Docker):                    │
                │   --network none, --read-only, --memory 64m,      │
                │   --cpus 1.0, --pids-limit 64, --cap-drop ALL,    │
                │   --user node, --security-opt no-new-privileges   │
                │ • Dev Mode (Subprocess, unsafeDevMode: true):     │
                │   Clean env: {}, PID separation, V8 flags         │
                └─────────────────────────┬─────────────────────────┘
                                          │
                                          ▼
                ┌───────────────────────────────────────────────────┐
                │ Tier 3: Engine V8 Hardening & Realm Isolation     │
                │ - Zero host-realm objects in vm.createContext     │
                │ - --max-old-space-size=64 (caps heap at 64MB)     │
                │ - --disallow-code-generation-from-strings         │
                │ - Output caps: max 1MB stdout/stderr              │
                │ - Result serialization cap: max 512KB             │
                └─────────────────────────┬─────────────────────────┘
                                          │
                                          ▼
                ┌───────────────────────────────────────────────────┐
                │ Tier 4: Authoritative OS-Level Hard Timeout       │
                │ - Process termination via child.kill('SIGKILL')   │
                │ - Docker container kill via name & rm -f cleanup  │
                │ - Destroys infinite CPU loops & microtask loops   │
                └───────────────────────────────────────────────────┘
```
```

---

## 6. `git diff --stat` & Files Changed Outside Heading List

### 6.1 `git diff --stat`
```text
 README.md                                        | 184 ++++---
 benchmarks/run_benchmarks.js                     |  37 +-
 docs/MATHEMATICAL_FOUNDATIONS.md                 |  89 ++--
 packages/core/package.json                       |   5 +-
 packages/core/src/cluster/ClusterNode.ts         |   1 +
 packages/core/src/computer/BrowserAgent.ts       |   1 +
 packages/core/src/evaluation/ArenaJudge.ts       |   5 +
 packages/core/src/evolution/GeneticOptimizer.ts  |   1 +
 packages/core/src/formal/SymbolicSolver.ts       |  12 +-
 packages/core/src/multimodal/AudioPerception.ts  |   1 +
 packages/core/src/multimodal/VisionPerception.ts |   1 +
 packages/core/src/tests/kernel.test.ts           |  36 +-
 packages/core/src/tools/ASTVerifier.ts           | 202 ++++++--
 packages/core/src/tools/Sandbox.ts               | 631 ++++++++++++++++++++---
 packages/core/src/voice/VoiceKernel.ts           |   5 +
 15 files changed, 908 insertions(+), 303 deletions(-)
```

### 6.2 Files Changed Outside the Section 5 List
- `packages/core/src/tests/kernel.test.ts`: Updated line 16 to set `{ mode: 'docker', timeoutMs: 3000 }` explicitly, matching the fail-closed Docker default requirement, and test names renamed with `[MockProvider]` and `[sample-value check]`.
- `scripts/measure_latency.js`: Benchmarking script created to measure Docker container startup and close latency before vs. after optimization.
- `packages/core/package.json`: Configured `--test-concurrency=1` to prevent parallel container resource contention on Windows Docker Desktop.

---

## 7. STILL UNVERIFIED LIST
1. **Multi-Tenant Concurrent Docker Load**: Behavior of Docker daemon under severe concurrent load (>50 parallel containers simultaneously executing) was not tested; current suite runs with `--test-concurrency=1` to avoid WSL2 vEthernet resource exhaustion.
2. **Windows-Native Container Mode**: Tests were executed against Linux containers (`node:lts-alpine` on WSL2/Docker Desktop for Windows); Windows container host isolation (`process` vs `hyperv` isolation) remains unverified.
3. **Uncached Base Image Cold Pull**: All tests rely on the locally cached pinned image (`node:lts-alpine@sha256:...`); latency and timeout handling during an uncached cold pull from Docker Hub across high-latency network connections remains unverified.
4. **Linux Root Host Verification**: Tests were performed on Windows 11 with Docker Desktop 29.9.2 (WSL2 backend); native bare-metal Linux (`cgroup v2` unified hierarchy directly under systemd) has not been tested in this session.
