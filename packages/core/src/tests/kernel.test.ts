import test from 'node:test';
import assert from 'node:assert/strict';
import { AetherKernel } from '../index.js';
import { Sandbox } from '../tools/Sandbox.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';

test('Sandbox executes JS code securely and captures logs', async () => {
  const sandbox = new Sandbox(2000);
  const code = `
    export default async function execute(args) {
      console.log('Computing payload...');
      return { multiplied: args.x * 2, valid: true };
    }
  `;

  const result = await sandbox.execute(code, { x: 21 });
  assert.equal(result.success, true);
  const data = result.result as { multiplied: number; valid: boolean };
  assert.equal(data.multiplied, 42);
  assert.equal(data.valid, true);
  assert.equal(result.logs.length, 1);
});

test('ToolRegistry executes pre-registered tools', async () => {
  const registry = new ToolRegistry();
  assert.equal(registry.has('text_analyzer'), true);

  const res = (await registry.execute('text_analyzer', {
    text: 'AetherFlow autonomous multi agent microkernel',
  })) as { wordCount: number; charCount: number };

  assert.equal(res.wordCount, 5);
  assert.ok(res.charCount > 20);
});

test('AetherKernel end-to-end goal execution with mock simulation', async () => {
  const kernel = new AetherKernel({
    provider: 'mock',
    enableJitTools: true,
  });

  const res = await kernel.executeGoal('Evaluate portfolio risk and calculate standard deviation', {
    portfolio: ['AAPL', 'GOOGL', 'NVDA'],
  });

  assert.equal(res.success, true);
  assert.ok(res.confidenceScore >= 0.7);
  assert.ok(res.plan.steps.length >= 3);
  assert.ok(res.traceEventsCount > 0);

  await kernel.stop();
});
