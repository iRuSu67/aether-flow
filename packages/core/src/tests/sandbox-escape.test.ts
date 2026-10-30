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
  console.log('  [MODE: static-ast] ASTVerifier blocks prototype constructor chain breakout');
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
  console.log('  [MODE: static-ast] ASTVerifier blocks computed string concatenation constructor evasion');
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
  console.log('  [MODE: static-ast] ASTVerifier blocks template literal constructor evasion');
  const verifier = new ASTVerifier();
  const code = 'export default async function execute(args) { return this[`con${"struc"}tor`]; }';
  const report = verifier.verify(code);
  assert.equal(report.isSafe, false);
  assert.ok(report.bannedPatternsDetected.some((p) => p.includes('constructor')));
});

test('ASTVerifier blocks prototype pollution via __proto__', () => {
  console.log('  [MODE: static-ast] ASTVerifier blocks prototype pollution via __proto__');
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
  console.log('  [MODE: static-ast] ASTVerifier blocks dynamic import expressions');
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
  console.log('  [MODE: static-ast] ASTVerifier blocks eval and new Function identifiers');
  const verifier = new ASTVerifier();
  const code1 = 'export default async function execute(args) { return eval("1 + 1"); }';
  const code2 = 'export default async function execute(args) { return new Function("return 42")(); }';

  assert.equal(verifier.verify(code1).isSafe, false);
  assert.equal(verifier.verify(code2).isSafe, false);
});

test('ASTVerifier blocks static while(true) infinite loops', () => {
  console.log('  [MODE: static-ast] ASTVerifier blocks static while(true) infinite loops');
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

test('ASTVerifier permits while(true) loop with reachable break or return statement', () => {
  console.log('  [MODE: static-ast] ASTVerifier permits while(true) with break or return');
  const verifier = new ASTVerifier();
  const codeWithBreak = `
    export default async function execute(args) {
      let i = 0;
      while (true) {
        i++;
        if (i > 10) break;
      }
      return i;
    }
  `;
  const reportBreak = verifier.verify(codeWithBreak);
  assert.equal(reportBreak.isSafe, true, 'Loops with reachable break must not be falsely rejected');

  const codeWithReturn = `
    export default async function execute(args) {
      while (true) {
        if (args.done) return args.result;
      }
    }
  `;
  const reportReturn = verifier.verify(codeWithReturn);
  assert.equal(reportReturn.isSafe, true, 'Loops with reachable return must not be falsely rejected');
});

// ============================================================================
// LAYER 2: KNOWN AST BYPASSES (AST MISSES, SANDBOX CONTAINS)
// Demonstrates that AST is only a static lint; Sandbox runtime is the true boundary.
// ============================================================================

test('Known AST bypass: computed key via Array.join is missed by AST but contained by Sandbox', async () => {
  console.log('  [MODE: subprocess+docker] Known AST bypass: computed key via Array.join');
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

  // Docker sandbox contains it via container isolation + engine flags (8000ms ensures cold WSL2 startup does not timeout)
  const docSandbox = new Sandbox({ mode: 'docker', timeoutMs: 8000 });
  const docRes = await docSandbox.execute(code, {});
  assert.equal(docRes.success, false);
  assert.ok(docRes.error?.includes('disallowed') || docRes.error?.includes('Code generation'));
});

test('Known AST bypass: Reflect.get with String.fromCharCode is missed by AST but contained by Sandbox', async () => {
  console.log('  [MODE: subprocess+docker] Known AST bypass: Reflect.get with String.fromCharCode');
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

  // Docker sandbox contains it (8000ms ensures cold WSL2 startup does not timeout)
  const docSandbox = new Sandbox({ mode: 'docker', timeoutMs: 8000 });
  const docRes = await docSandbox.execute(code, {});
  assert.equal(docRes.success, false);
  assert.ok(docRes.error?.includes('disallowed') || docRes.error?.includes('Code generation'));
});

// ============================================================================
// LAYER 3: FAIL-CLOSED API CONTRACT
// ============================================================================

test('Sandbox fails closed: subprocess mode without unsafeDevMode throws immediately', () => {
  console.log('  [MODE: contract-check] Sandbox fails closed: subprocess mode without unsafeDevMode throws');
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

// ============================================================================
// LAYER 4: PARAMETERIZED ADVERSARIAL SUITE (RUNS IN BOTH SUBPROCESS AND DOCKER)
// Covers: constructor chain, args.constructor, eval, env, fs, network,
// process.binding, flood, big return, timeouts, and heap bomb.
// ============================================================================

const MODES = ['subprocess', 'docker'] as const;

function createSandbox(
  mode: 'subprocess' | 'docker',
  options?: { timeoutMs?: number; maxMemoryMb?: number; maxOutputBytes?: number }
) {
  if (mode === 'subprocess') {
    return new Sandbox({
      mode: 'subprocess',
      unsafeDevMode: true,
      timeoutMs: options?.timeoutMs ?? 2000,
      maxMemoryMb: options?.maxMemoryMb ?? 64,
      maxOutputBytes: options?.maxOutputBytes ?? 64 * 1024,
    });
  } else {
    return new Sandbox({
      mode: 'docker',
      timeoutMs: options?.timeoutMs ?? 6000,
      maxMemoryMb: options?.maxMemoryMb ?? 64,
      maxOutputBytes: options?.maxOutputBytes ?? 64 * 1024,
    });
  }
}

for (const mode of MODES) {
  test(`[${mode}] Sandbox blocks prototype constructor chain breakout`, async () => {
    console.log(`  [MODE: ${mode}] Sandbox blocks prototype constructor chain breakout`);
    const sandbox = createSandbox(mode);
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

  test(`[${mode}] Sandbox blocks args.constructor.constructor breakout`, async () => {
    console.log(`  [MODE: ${mode}] Sandbox blocks args.constructor.constructor breakout`);
    const sandbox = createSandbox(mode);
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

  test(`[${mode}] Sandbox blocks eval() via engine-level string compilation disallowance`, async () => {
    console.log(`  [MODE: ${mode}] Sandbox blocks eval() via engine-level string compilation disallowance`);
    const sandbox = createSandbox(mode);
    const maliciousCode = `
      export default async function execute(args) {
        return eval('40 + 2');
      }
    `;
    const res = await sandbox.execute(maliciousCode, {});
    assert.equal(res.success, false);
    assert.ok(res.error?.includes('disallowed') || res.error?.includes('Code generation'));
  });

  test(`[${mode}] Sandbox environment is clean: host process.env is inaccessible in VM`, async () => {
    console.log(`  [MODE: ${mode}] Sandbox environment is clean: host process.env is inaccessible in VM`);
    const sandbox = createSandbox(mode);
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

  test(`[${mode}] Sandbox strips host environment variables (no host secrets accessible)`, async () => {
    console.log(`  [MODE: ${mode}] Sandbox strips host environment variables (no host secrets accessible)`);
    process.env.AETHER_HOST_SUPER_SECRET = 'leak_target_secret_12345';
    const sandbox = createSandbox(mode);
    const testCode = `
      export default async function execute(args) {
        const hasProcess = typeof process !== 'undefined';
        const envKeys = hasProcess && process.env ? Object.keys(process.env) : [];
        const secret = hasProcess && process.env ? process.env.AETHER_HOST_SUPER_SECRET : undefined;
        return { hasProcess, envKeys, secret };
      }
    `;
    try {
      const res = await sandbox.execute(testCode, { __probeEnv: true });
      assert.equal(res.success, true);
      const data = res.result as { envKeys: string[]; secret?: string };
      assert.equal(data.secret, undefined);
      assert.ok(!data.envKeys.includes('AETHER_HOST_SUPER_SECRET'));
      assert.ok(!data.envKeys.some((k) => k.startsWith('AETHER_')));
    } finally {
      delete process.env.AETHER_HOST_SUPER_SECRET;
    }
  });

  test(`[${mode}] Sandbox blocks filesystem read outside sandbox (fs / require)`, async () => {
    console.log(`  [MODE: ${mode}] Sandbox blocks filesystem read outside sandbox (fs / require)`);
    const sandbox = createSandbox(mode);
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

  test(`[${mode}] Sandbox blocks outbound network connection attempts (fetch / net)`, async () => {
    console.log(`  [MODE: ${mode}] Sandbox blocks outbound network connection attempts (fetch / net)`);
    const sandbox = createSandbox(mode);
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

  test(`[${mode}] Sandbox blocks access to process.binding and process.mainModule`, async () => {
    console.log(`  [MODE: ${mode}] Sandbox blocks access to process.binding and process.mainModule`);
    const sandbox = createSandbox(mode);
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

  test(`[${mode}] Sandbox output caps terminate execution on unbounded output flooding`, async () => {
    console.log(`  [MODE: ${mode}] Sandbox output caps terminate execution on unbounded output flooding`);
    const sandbox = createSandbox(mode, {
      timeoutMs: mode === 'docker' ? 5000 : 3000,
      maxOutputBytes: 64 * 1024,
    });
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

  test(`[${mode}] Sandbox fails safely when return value exceeds maximum result size`, async () => {
    console.log(`  [MODE: ${mode}] Sandbox fails safely when return value exceeds maximum result size`);
    const sandbox = createSandbox(mode, {
      timeoutMs: mode === 'docker' ? 5000 : 2000,
      maxOutputBytes: 128 * 1024,
    });
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

  test(`[${mode}] Sandbox hard timeout terminates synchronous CPU infinite loop`, async () => {
    console.log(`  [MODE: ${mode}] Sandbox hard timeout terminates synchronous CPU infinite loop`);
    const timeoutMs = mode === 'docker' ? 1500 : 800;
    const sandbox = createSandbox(mode, { timeoutMs });
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
    assert.ok(
      res.error?.includes('timed out') || res.error?.includes('Process killed') || res.error?.includes('terminated'),
      `Error was: ${res.error}`
    );
    assert.ok(elapsed >= timeoutMs - 150 && elapsed <= timeoutMs + 5000, `Execution took ${elapsed}ms`);
  });

  test(`[${mode}] Sandbox hard timeout terminates asynchronous microtask loop`, async () => {
    console.log(`  [MODE: ${mode}] Sandbox hard timeout terminates asynchronous microtask loop`);
    const timeoutMs = mode === 'docker' ? 1500 : 800;
    const sandbox = createSandbox(mode, { timeoutMs });
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
    assert.ok(
      res.error?.includes('timed out') || res.error?.includes('Process killed') || res.error?.includes('terminated'),
      `Error was: ${res.error}`
    );
    assert.ok(elapsed >= timeoutMs - 150 && elapsed <= timeoutMs + 5000, `Execution took ${elapsed}ms`);
  });

  test(`[${mode}] Sandbox caps heap memory and fails safely on memory exhaustion attempt`, async () => {
    console.log(`  [MODE: ${mode}] Sandbox caps heap memory and fails safely on memory exhaustion attempt`);
    const sandbox = createSandbox(mode, {
      timeoutMs: mode === 'docker' ? 6000 : 3000,
      maxMemoryMb: 32,
    });
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

  test(`[${mode}] VM Context Realm Isolation: sandboxed code cannot mutate runner JSON.stringify, Array.prototype, or Object.prototype`, async () => {
    console.log(`  [MODE: ${mode}] VM Context Realm Isolation: sandboxed code cannot mutate runner prototypes`);
    const sandbox = createSandbox(mode, { timeoutMs: mode === 'docker' ? 10000 : 2000 });
    const code = `
      export default async function execute(args) {
        Array.prototype.push = function() { throw new Error('Sabotaged push'); };
        JSON.stringify = function() { return 'sabotaged'; };
        Object.prototype.polluted = 'MALICIOUS_POLLUTION';
        return { inSandbox: 42 };
      }
    `;

    const testArr = [1, 2];
    testArr.push(3);
    assert.equal(testArr.length, 3);
    assert.equal(JSON.stringify({ ok: true }), '{"ok":true}');
    assert.equal(({} as Record<string, unknown>).polluted, undefined);

    const res = await sandbox.execute(code, {});
    assert.equal(res.success, true);
    assert.deepEqual(res.result, { inSandbox: 42 });

    testArr.push(4);
    assert.equal(testArr.length, 4, 'Host Array.prototype.push must remain unmodified');
    assert.equal(JSON.stringify({ ok: true }), '{"ok":true}', 'Host JSON.stringify must remain unmodified');
    assert.equal(({} as Record<string, unknown>).polluted, undefined, 'Host Object.prototype must remain unpolluted');
  });
}

// ============================================================================
// LAYER 5: DOCKER CONTAINER SPECIFIC PROBE TESTS
// ============================================================================

test('Docker network isolation Test 1: Real flag list cannot connect to host TCP listener (0 connections)', async () => {
  console.log('  [MODE: docker] Docker network isolation Test 1: Real flag list cannot connect to host TCP listener');
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
        '--add-host=host.docker.internal:host-gateway',
        'node',
        '-e',
        `const net = require('node:net'); const s = net.connect(${port}, 'host.docker.internal', () => { s.end(); process.exit(0); }); s.on('error', (err) => { console.error('PROBE_ERR:' + err.code); process.exit(1); });`,
      ],
    });

    const res = spawnSync('docker', dockerArgs, { encoding: 'utf8', timeout: 15000 });
    assert.equal(res.status, 1, `Expected container connection failure, exit status was: ${res.status}`);
    assert.equal(hostConnections, 0, 'Host TCP listener must receive exactly 0 connections with --network none');

    // Assert that the failure is a real connection/network failure, NOT a DNS failure
    const stderr = res.stderr || '';
    assert.ok(
      stderr.includes('ENETUNREACH') ||
      stderr.includes('EHOSTUNREACH') ||
      stderr.includes('ECONNREFUSED') ||
      stderr.includes('ETIMEDOUT'),
      `Failure must be a network/connection failure, not DNS failure. Stderr: ${stderr}`
    );
    assert.ok(!stderr.includes('ENOTFOUND'), `DNS failed to resolve host.docker.internal: ${stderr}`);
    assert.ok(!stderr.includes('EAI_AGAIN'), `DNS lookup timed out or failed: ${stderr}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Docker network isolation Test 2 (control): Omitting --network none MUST connect to host listener', async () => {
  console.log('  [MODE: docker] Docker network isolation Test 2 (control): Omitting --network none MUST connect to host listener');
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
    const dockerArgs = buildDockerArgs({
      containerName,
      network: null,
      customArgs: [
        '--add-host=host.docker.internal:host-gateway',
        'node',
        '-e',
        `const net = require('node:net'); const s = net.connect(${port}, 'host.docker.internal', () => { console.log('CONNECTED_DEFAULT'); s.end(); process.exit(0); }); s.on('error', (e) => { console.error('ERR:', e.code, e.message); process.exit(1); });`,
      ],
    });

    const res = spawnSync('docker', dockerArgs, { encoding: 'utf8', timeout: 15000 });
    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    assert.equal(res.status, 0, `Control container should connect successfully. Output: ${res.stdout} ${res.stderr}`);
    assert.ok(hostConnections >= 1, `Host TCP listener must receive connection without --network none (got ${hostConnections})`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Docker probe: container runs as non-root user node (uid 1000)', () => {
  console.log('  [MODE: docker] Docker probe: container runs as non-root user node (uid 1000)');
  const containerName = `aether-probe-user-${Date.now()}`;
  const dockerArgs = buildDockerArgs({
    containerName,
    customArgs: ['id', '-u'],
  });
  const res = spawnSync('docker', dockerArgs, { encoding: 'utf8', timeout: 15000 });
  assert.equal(res.status, 0);
  const uid = res.stdout.trim();
  assert.equal(uid, '1000', `Container must run as non-root user node (uid 1000), got: ${uid}`);
});

test('Docker probe: container filesystem is strictly read-only (touch /x fails)', () => {
  console.log('  [MODE: docker] Docker probe: container filesystem is strictly read-only');
  const containerName = `aether-probe-ro-${Date.now()}`;
  const dockerArgs = buildDockerArgs({
    containerName,
    customArgs: ['touch', '/test_ro_probe'],
  });
  const res = spawnSync('docker', dockerArgs, { encoding: 'utf8', timeout: 15000 });
  assert.notEqual(res.status, 0, 'Writing to root filesystem in read-only container must fail');
  assert.ok(
    res.stderr.includes('Read-only file system'),
    `Expected 'Read-only file system' error, got: ${res.stderr}`
  );
});

test('Docker probe: container Linux capabilities are dropped (CapBnd is 0)', () => {
  console.log('  [MODE: docker] Docker probe: container Linux capabilities are dropped');
  const containerName = `aether-probe-cap-${Date.now()}`;
  const dockerArgs = buildDockerArgs({
    containerName,
    customArgs: ['sh', '-c', 'grep CapBnd /proc/self/status'],
  });
  const res = spawnSync('docker', dockerArgs, { encoding: 'utf8', timeout: 15000 });
  assert.equal(res.status, 0);
  assert.ok(
    res.stdout.includes('0000000000000000'),
    `Expected all capabilities dropped (CapBnd 0000000000000000), got: ${res.stdout.trim()}`
  );
});

test('Docker probe: container pids limit is enforced (pids.max is 64)', () => {
  console.log('  [MODE: docker] Docker probe: container pids limit is enforced');
  const containerName = `aether-probe-pids-${Date.now()}`;
  const dockerArgs = buildDockerArgs({
    containerName,
    customArgs: ['sh', '-c', 'cat /sys/fs/cgroup/pids.max 2>/dev/null || cat /sys/fs/cgroup/pids/pids.max 2>/dev/null'],
  });
  const res = spawnSync('docker', dockerArgs, { encoding: 'utf8', timeout: 15000 });
  assert.equal(res.status, 0);
  const pidsMax = res.stdout.trim();
  assert.equal(pidsMax, '64', `Expected pids limit 64, got: ${pidsMax}`);
});

test('Docker probe: container memory limit is enforced (memory.max matches 64MB)', () => {
  console.log('  [MODE: docker] Docker probe: container memory limit is enforced');
  const containerName = `aether-probe-mem-${Date.now()}`;
  const dockerArgs = buildDockerArgs({
    containerName,
    maxMemoryMb: 64,
    customArgs: ['sh', '-c', 'cat /sys/fs/cgroup/memory.max 2>/dev/null || cat /sys/fs/cgroup/memory/memory.limit_in_bytes 2>/dev/null'],
  });
  const res = spawnSync('docker', dockerArgs, { encoding: 'utf8', timeout: 15000 });
  assert.equal(res.status, 0);
  const memMax = res.stdout.trim();
  assert.equal(memMax, '67108864', `Expected memory limit 67108864 (64MB), got: ${memMax}`);
});

test('Docker mode host-side stderr flooding is terminated by output limit cap', async () => {
  console.log('  [MODE: docker] Docker mode host-side stderr flooding is terminated by output limit cap');
  const sandbox = new Sandbox({ mode: 'docker', timeoutMs: 12000, maxOutputBytes: 32 * 1024 });
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
  console.log('  [MODE: docker] Docker container is killed and removed after timeout');
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

  const psCheck = spawnSync(
    'docker',
    ['ps', '-a', '--filter', `name=${sandbox.lastContainerName}`, '--format', '{{.Names}}'],
    { encoding: 'utf8' }
  );
  const output = psCheck.stdout.trim();
  assert.equal(output, '', `Container ${sandbox.lastContainerName} must be completely removed from docker ps -a after timeout`);
});

test('ArrayBuffer memory bomb analysis: timeout vs memory cap in each mode', async () => {
  console.log('  [MODE: subprocess+docker] ArrayBuffer memory bomb analysis: timeout vs memory cap in each mode');
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
  // The process continues allocating virtual memory until the authoritative timeout fires.
  const subSandbox = new Sandbox({ mode: 'subprocess', unsafeDevMode: true, timeoutMs: 1500, maxMemoryMb: 32 });
  const subStart = performance.now();
  const subRes = await subSandbox.execute(code, {});
  const subElapsed = performance.now() - subStart;

  assert.equal(subRes.success, false);
  assert.ok(
    subRes.error?.includes('timed out') || subRes.error?.includes('Process killed'),
    `Subprocess stopped by TIMEOUT: ${subRes.error}`
  );
  assert.ok(subElapsed >= 1350, `Subprocess elapsed (${subElapsed}ms) matches timeout window`);

  // Mode 2: Docker mode (untouched virtual pages)
  // Linux kernel uses virtual memory overcommit, so untouched pages do not contribute to cgroup RSS.
  // The CPU infinite loop is stopped by TIMEOUT.
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
  const docSandboxCommitted = new Sandbox({ mode: 'docker', timeoutMs: 8000, maxMemoryMb: 32 });
  const docCommittedStart = performance.now();
  const docCommittedRes = await docSandboxCommitted.execute(commitCode, {});
  const docCommittedElapsed = performance.now() - docCommittedStart;

  assert.equal(docCommittedRes.success, false);
  assert.ok(
    docCommittedRes.error?.includes('OOM') || docCommittedRes.error?.includes('killed') || docCommittedRes.error?.includes('137'),
    `Docker mode with committed pages stopped by MEMORY CAP (OOM killer): ${docCommittedRes.error}`
  );
  assert.ok(
    !docCommittedRes.error?.includes('timed out'),
    `Docker committed pages must be stopped by OOM killer, not by timeout. Error was: ${docCommittedRes.error}`
  );
  assert.ok(docCommittedElapsed < 7500, `Docker committed pages killed by cgroups OOM before 8000ms timeout (${docCommittedElapsed}ms)`);
});
