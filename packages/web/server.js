import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AetherKernel } from '@aether-flow/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const TELEMETRY_PORT = 4884;

const kernel = new AetherKernel({
  provider: (process.env.PROVIDER || 'mock'),
  enableJitTools: true,
});

await kernel.startTelemetry(TELEMETRY_PORT);

// Pre-populate some knowledge graph concepts for rich out-of-the-box exploration
kernel.graph.addNode('Objective', 'input', { label: 'High-Level Objective' });
kernel.graph.addNode('Architect', 'agent', { role: 'orchestrator' });
kernel.graph.addNode('Critic', 'agent', { role: 'adversary' });
kernel.graph.addNode('ToolForge', 'runtime', { capability: 'jit_synthesis' });
kernel.graph.addNode('SandboxedVM', 'security', { timeout: 5000 });
kernel.graph.addEdge('Objective', 'Architect', 'decomposed_by');
kernel.graph.addEdge('Architect', 'Critic', 'audited_by');
kernel.graph.addEdge('Architect', 'ToolForge', 'synthesizes_tool');
kernel.graph.addEdge('ToolForge', 'SandboxedVM', 'executes_in');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API: Dispatch Goal
  if (req.method === 'POST' && url.pathname === '/api/dispatch') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const goal = payload.goal || 'Autonomous risk & algorithmic trading assessment';
        const result = await kernel.executeGoal(goal, payload.context);
        
        // Add goal to memory and graph
        kernel.memory.insert(`goal_${Date.now()}`, goal, { success: result.success });
        kernel.graph.addNode(`Goal_${Date.now().toString().slice(-4)}`, 'goal', { text: goal });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    return;
  }

  // API: Speculative Execution
  if (req.method === 'POST' && url.pathname === '/api/speculative') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const goal = payload.goal || 'Deconstruct quantum lattice cryptography';
        const branches = Number(payload.branches) || 3;
        const result = await kernel.executeSpeculative(goal, branches);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    return;
  }

  // API: Knowledge Graph
  if (req.method === 'GET' && url.pathname === '/api/graph') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(kernel.graph.toJSON()));
    return;
  }

  // API: Get Tools
  if (req.method === 'GET' && url.pathname === '/api/tools') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(kernel.registry.list()));
    return;
  }

  // API: Get Trace History
  if (req.method === 'GET' && url.pathname === '/api/history') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(kernel.bus.getHistory()));
    return;
  }

  // Static File Serving
  let filePath = path.join(__dirname, 'public', url.pathname === '/' ? 'index.html' : url.pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, 'public', 'index.html');
  }

  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
  };

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`\n🌌 AetherFlow Visual Cognitive Studio running at http://localhost:${PORT}`);
  console.log(`📡 WebSocket Telemetry stream connected at ws://localhost:${TELEMETRY_PORT}\n`);
});
