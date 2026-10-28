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
  const hasCRLF = current.includes('\r\n');
  const normCurrent = current.replace(/\r\n/g, '\n');
  const normTarget = target.replace(/\r\n/g, '\n');
  const normReplacement = replacement.replace(/\r\n/g, '\n');

  if (!normCurrent.includes(normTarget)) {
    throw new Error(`Target string not found in ${relPath} for mutation:\n"${target}"`);
  }
  let mutated = normCurrent.replaceAll(normTarget, normReplacement);
  if (hasCRLF) {
    mutated = mutated.replace(/\n/g, '\r\n');
  }
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
      timeout: 180000,
    }
  );

  if (res.error) {
    console.error('Adversarial suite execution error:', res.error);
  }

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
        'packages/core/src/tools/sandbox-runner.ts',
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
        'packages/core/src/tools/sandbox-runner.ts',
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
        'packages/core/src/tools/sandbox-runner.ts',
        'if (__totalLogBytes > __maxLogBytes) {',
        'if (false && __totalLogBytes > __maxLogBytes) {'
      );
      applyMutation(
        'packages/core/src/tools/sandbox-runner.ts',
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
        `  args.push(\`--memory=\${maxMemoryMb}m\`);
  args.push(\`--memory-swap=\${maxMemoryMb}m\`);`,
        '  // MUTATION: --memory and --memory-swap omitted'
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
        'packages/core/src/tools/sandbox-runner.ts',
        'if (__totalLogBytes > __maxLogBytes) {',
        'if (false && __totalLogBytes > __maxLogBytes) {'
      );
    },
  },
  {
    mode: 'docker',
    name: 'Docker Layer 8: VM Context Lockdown & Isolated Realm (Docker Mode)',
    description: 'Expose dangerous require() and fetch() globals directly in contextGlobals in mounted runner',
    apply() {
      applyMutation(
        'packages/core/src/tools/sandbox-runner.ts',
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
    mode: 'docker',
    name: 'Docker Layer 9: V8 Engine Flags in Docker Mode (--disallow-code-generation-from-strings)',
    description: 'Remove V8 string compilation disallowance from Docker command and VM context',
    apply() {
      applyMutation(
        'packages/core/src/tools/Sandbox.ts',
        "    args.push('node', '--disallow-code-generation-from-strings', '/sandbox/runner.mjs');",
        "    args.push('node', '/sandbox/runner.mjs');"
      );
      applyMutation(
        'packages/core/src/tools/sandbox-runner.ts',
        'codeGeneration: { strings: false, wasm: false },',
        'codeGeneration: { strings: true, wasm: true },'
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
