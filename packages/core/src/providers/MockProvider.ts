import { CompletionRequest, ModelProvider } from './ModelProvider.js';

/**
 * MockProvider
 * High-fidelity zero-key simulation engine for local testing, CI/CD, and out-of-the-box evaluation.
 * Generates context-aware, realistic multi-agent reasoning, dynamic tool code, and Hegelian critiques.
 */
export class MockProvider implements ModelProvider {
  public name = 'MockSimulationEngine';

  async generateText(request: CompletionRequest): Promise<string> {
    const prompt = request.prompt.toLowerCase();
    const system = (request.systemPrompt || '').toLowerCase();

    // 1. Tool Synthesis Request (ToolForge)
    if (
      prompt.includes('export default async function') ||
      prompt.includes('inputspecification') ||
      prompt.includes('expected output') ||
      prompt.includes('synthesize a self-contained javascript tool')
    ) {
      return this.generateSimulatedToolCode(prompt);
    }

    // 2. Critic / Antithesis
    if (
      system.includes('critic') ||
      system.includes('adversarial') ||
      prompt.includes('antithesis') ||
      prompt.includes('critique') ||
      prompt.includes('blind spots')
    ) {
      return `[Adversarial Critic Audit]:
- Identified edge-case: Input distribution may suffer from non-stationary drift or division by zero.
- Security audit: Enforce sandboxed memory boundary and parameter validation checks.
- Plan verification: Approved with contingency mitigation attached.`;
    }

    // 3. Architect / Thesis
    if (
      system.includes('architect') ||
      prompt.includes('thesis') ||
      prompt.includes('execution plan') ||
      prompt.includes('decompose')
    ) {
      return `[Architectural Plan]:
1. Initialize cognitive event telemetry and register prerequisite tools.
2. Formulate probabilistic model and ingest boundary conditions.
3. Synthesize dynamic computational kernel for numeric evaluation.
4. Execute sandboxed verification pipeline and produce unified synthesis.`;
    }

    // 4. Synthesizer / Reconciliation
    return `[Hegelian Synthesis]: Reconciliation complete. The thesis execution plan has been hardened against edge-case anomalies identified by the adversarial auditor. Confidence rating: 96.8%. Ready for sandboxed execution.`;
  }

  async generateStructured<T>(request: CompletionRequest, _schemaDescription: string): Promise<T> {
    const text = await this.generateText(request);
    try {
      return JSON.parse(text) as T;
    } catch {
      return { output: text } as unknown as T;
    }
  }

  private generateSimulatedToolCode(prompt: string): string {
    if (prompt.includes('math') || prompt.includes('statistic') || prompt.includes('average')) {
      return `
// Synthesized Math & Statistics Tool
export default async function execute(args) {
  const numbers = args.numbers || [10, 20, 30, 40, 50];
  const sum = numbers.reduce((a, b) => a + b, 0);
  const avg = sum / numbers.length;
  const variance = numbers.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / numbers.length;
  const stdDev = Math.sqrt(variance);

  return {
    count: numbers.length,
    sum,
    average: avg,
    variance: Number(variance.toFixed(2)),
    stdDev: Number(stdDev.toFixed(2))
  };
}
      `.trim();
    }

    if (prompt.includes('financial') || prompt.includes('stock') || prompt.includes('price')) {
      return `
// Synthesized Financial Metrics Tool
export default async function execute(args) {
  const prices = args.prices || [142.5, 145.2, 148.0, 146.8, 150.3, 153.1];
  const initial = prices[0];
  const current = prices[prices.length - 1];
  const roi = ((current - initial) / initial) * 100;
  
  return {
    ticker: args.ticker || 'NVDA',
    baselinePrice: initial,
    currentPrice: current,
    roiPercentage: Number(roi.toFixed(2)) + '%',
    momentum: roi > 0 ? 'bullish' : 'bearish'
  };
}
      `.trim();
    }

    // Generic dynamic tool
    return `
// Synthesized Adaptive Transform Tool
export default async function execute(args) {
  const payload = args.input || 'AetherFlow JIT Synthesized Payload';
  return {
    processed: true,
    inputLength: String(payload).length,
    timestamp: Date.now(),
    digest: 'sha256_' + Math.random().toString(36).substring(2, 10)
  };
}
    `.trim();
  }
}
