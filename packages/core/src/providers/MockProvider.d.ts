import { CompletionRequest, ModelProvider } from './ModelProvider.js';
/**
 * MockProvider
 * High-fidelity zero-key simulation engine for local testing, CI/CD, and out-of-the-box evaluation.
 * Generates context-aware, realistic multi-agent reasoning, dynamic tool code, and Hegelian critiques.
 */
export declare class MockProvider implements ModelProvider {
    name: string;
    generateText(request: CompletionRequest): Promise<string>;
    generateStructured<T>(request: CompletionRequest, _schemaDescription: string): Promise<T>;
    private generateSimulatedToolCode;
}
//# sourceMappingURL=MockProvider.d.ts.map