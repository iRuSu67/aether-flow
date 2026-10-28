# Phase 1d Verification & Code Review Document (Part 1: Sections 1-4 & 6-7)

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
