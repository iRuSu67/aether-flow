/**
 * MockProvider
 * High-fidelity zero-key simulation engine for local testing, CI/CD, and out-of-the-box evaluation.
 * Generates context-aware, realistic multi-agent reasoning, dynamic tool code, and Hegelian critiques.
 */
export class MockProvider {
    name = 'MockSimulationEngine';
    async generateText(request) {
        const prompt = request.prompt.toLowerCase();
        // Check if synthesizing a tool
        if (prompt.includes('synthesize a tool') || prompt.includes('tool code')) {
            return this.generateSimulatedToolCode(prompt);
        }
        // Check if critic / antithesis
        if (prompt.includes('antithesis') || prompt.includes('critic')) {
            return `[Critic Analysis]: The proposed plan has 2 critical vulnerabilities:
1. Potential unbounded recursion if the data stream contains circular references.
2. Edge cases when input values are empty or malformed.
Recommendation: Enforce parameter validation and add a fallback circuit-breaker.`;
        }
        // Check if architect / thesis
        if (prompt.includes('thesis') || prompt.includes('architect') || prompt.includes('plan')) {
            return `[Architectural Plan]:
1. Initialize telemetry & register necessary domain tools.
2. Ingest input data and transform into normalized vector format.
3. Execute calculation pipeline with self-healing checkpoints.
4. Synthesize final verified insight.`;
        }
        // Default synthesis
        return `[AetherFlow Kernel Decision]: Convergence achieved with 98.4% confidence score. All validation tests passed.`;
    }
    async generateStructured(request, _schemaDescription) {
        const text = await this.generateText(request);
        try {
            return JSON.parse(text);
        }
        catch {
            return { output: text };
        }
    }
    generateSimulatedToolCode(prompt) {
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
//# sourceMappingURL=MockProvider.js.map