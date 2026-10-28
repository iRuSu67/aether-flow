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
