import { CompletionRequest, ModelProvider } from './ModelProvider.js';
export declare class GeminiProvider implements ModelProvider {
    name: string;
    private apiKey;
    private model;
    constructor(apiKey?: string, model?: string);
    generateText(request: CompletionRequest): Promise<string>;
    generateStructured<T>(request: CompletionRequest, schemaDescription: string): Promise<T>;
}
//# sourceMappingURL=GeminiProvider.d.ts.map