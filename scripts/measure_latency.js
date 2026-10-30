import { spawnSync, spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const nodeImage = 'node:lts-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53';

async function runAsyncContainer() {
  const cName = `bench-opt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const t0 = performance.now();
  return new Promise((resolve) => {
    const child = spawn('docker', [
      'run', '--name', cName, '--rm', '-i',
      '--network', 'none', '--read-only',
      '--user', 'node', '--security-opt', 'no-new-privileges',
      '--memory=64m', '--memory-swap=64m', '--cpus=1.0',
      '--pids-limit=64', '--cap-drop=ALL',
      nodeImage, 'node', '-e', 'console.log(JSON.stringify({success:true,result:42}))'
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    child.stdout.on('data', d => stdout += d);
    child.on('close', () => {
      // Clean exit: --rm cleans up, no synchronous kill calls!
      const total = performance.now() - t0;
      resolve(total);
    });
  });
}

async function measure() {
  console.log('================================================================');
  console.log('              DOCKER CALL LATENCY BENCHMARK                     ');
  console.log('================================================================\n');

  console.log('--- 1. BEFORE OPTIMIZATION (with synchronous kill + rm on close) ---');
  const runs = 5;
  let sumRun = 0;
  let sumKill = 0;
  let sumRm = 0;

  for (let i = 0; i < runs; i++) {
    const cName = `bench-before-${Date.now()}-${i}`;
    const t0 = performance.now();
    spawnSync('docker', [
      'run', '--name', cName, '--rm', '-i',
      '--network', 'none', '--read-only',
      '--user', 'node', '--security-opt', 'no-new-privileges',
      '--memory=64m', '--memory-swap=64m', '--cpus=1.0',
      '--pids-limit=64', '--cap-drop=ALL',
      nodeImage, 'node', '-e', 'console.log(JSON.stringify({success:true,result:42}))'
    ], { encoding: 'utf8' });
    const tRun = performance.now() - t0;

    const tK0 = performance.now();
    spawnSync('docker', ['kill', cName], { stdio: 'ignore' });
    const tKill = performance.now() - tK0;

    const tR0 = performance.now();
    spawnSync('docker', ['rm', '-f', cName], { stdio: 'ignore' });
    const tRm = performance.now() - tR0;

    sumRun += tRun;
    sumKill += tKill;
    sumRm += tRm;

    console.log(`  Run ${i + 1}: docker run: ${tRun.toFixed(1)}ms | spawnSync kill: ${tKill.toFixed(1)}ms | spawnSync rm: ${tRm.toFixed(1)}ms | close: ${(tKill + tRm).toFixed(1)}ms | total: ${(tRun + tKill + tRm).toFixed(1)}ms`);
  }

  const avgRun = sumRun / runs;
  const avgKill = sumKill / runs;
  const avgRm = sumRm / runs;
  const avgCloseBefore = (sumKill + sumRm) / runs;
  const avgTotalBefore = (sumRun + sumKill + sumRm) / runs;

  console.log('\n  Average Before:');
  console.log(`    docker run execution:       ${avgRun.toFixed(1)}ms`);
  console.log(`    spawnSync docker kill:      ${avgKill.toFixed(1)}ms`);
  console.log(`    spawnSync docker rm:        ${avgRm.toFixed(1)}ms`);
  console.log(`    Synchronous close overhead: ${avgCloseBefore.toFixed(1)}ms`);
  console.log(`    Total per-call latency:     ${avgTotalBefore.toFixed(1)}ms`);

  console.log('\n--- 2. AFTER OPTIMIZATION (async, --rm auto-cleanup on exit) ---');
  let sumAfter = 0;
  for (let i = 0; i < runs; i++) {
    const tAfter = await runAsyncContainer();
    sumAfter += tAfter;
    console.log(`  Run ${i + 1}: async docker run with --rm: ${tAfter.toFixed(1)}ms (close overhead: 0.0ms)`);
  }

  const avgAfter = sumAfter / runs;
  const latencyReduction = avgTotalBefore - avgAfter;
  const pctImprovement = ((latencyReduction / avgTotalBefore) * 100).toFixed(1);

  console.log('\n  Average After:');
  console.log(`    Total per-call latency:     ${avgAfter.toFixed(1)}ms`);
  console.log(`    Synchronous close overhead: 0.0ms (eliminated)`);
  console.log(`    Latency reduction:          ${latencyReduction.toFixed(1)}ms (${pctImprovement}% speedup)`);
  console.log('================================================================\n');
}

measure();
