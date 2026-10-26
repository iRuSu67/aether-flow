import test from 'node:test';
import assert from 'node:assert/strict';
import { AetherKernel } from '../index.js';
import { Sandbox } from '../tools/Sandbox.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { VectorMemory } from '../memory/VectorMemory.js';
import { KnowledgeGraph } from '../memory/KnowledgeGraph.js';

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

test('ToolRegistry executes pre-registered tools and web tools', async () => {
  const registry = new ToolRegistry();
  assert.equal(registry.has('text_analyzer'), true);
  assert.equal(registry.has('web_search'), true);
  assert.equal(registry.has('web_scrape'), true);

  const res = (await registry.execute('text_analyzer', {
    text: 'AetherFlow autonomous multi agent microkernel',
  })) as { wordCount: number; charCount: number };

  assert.equal(res.wordCount, 5);
  assert.ok(res.charCount > 20);
});

test('VectorMemory embeds, inserts, and retrieves nearest neighbors', () => {
  const memory = new VectorMemory(64);
  memory.insert('doc1', 'Quantum computing entanglement state algorithm', { category: 'physics' });
  memory.insert('doc2', 'High-frequency algorithmic equity portfolio management', { category: 'finance' });
  memory.insert('doc3', 'Superposition principles in qubit architectures', { category: 'physics' });

  const results = memory.search('quantum qubit entanglement', 2);
  assert.ok(results.length > 0);
  assert.equal(results[0].record.metadata.category, 'physics');
});

test('KnowledgeGraph connects entities and computes BFS shortest paths', () => {
  const graph = new KnowledgeGraph();
  graph.addNode('AgentArchitect', 'agent');
  graph.addNode('ConsensusDialectic', 'concept');
  graph.addNode('ExecutionSandbox', 'runtime');

  graph.addEdge('AgentArchitect', 'ConsensusDialectic', 'participatesIn');
  graph.addEdge('ConsensusDialectic', 'ExecutionSandbox', 'authorizes');

  const path = graph.findPath('AgentArchitect', 'ExecutionSandbox');
  assert.deepEqual(path, ['AgentArchitect', 'ConsensusDialectic', 'ExecutionSandbox']);
});

test('AetherKernel end-to-end goal execution with speculative swarm', async () => {
  const kernel = new AetherKernel({
    provider: 'mock',
    enableJitTools: true,
  });

  // Speculative execution
  const spec = await kernel.executeSpeculative('Deconstruct zero-knowledge rollup proofs', 3);
  assert.ok(spec.allBranches.length === 3);
  assert.ok(spec.winningBranch.criticScore >= 80);

  // End-to-end goal
  const res = await kernel.executeGoal('Evaluate portfolio risk and calculate standard deviation', {
    portfolio: ['AAPL', 'GOOGL', 'NVDA'],
  });

  assert.equal(res.success, true);
  assert.ok(res.confidenceScore >= 0.7);
  assert.ok(res.plan.steps.length >= 3);
  assert.ok(res.traceEventsCount > 0);

  await kernel.stop();
});
