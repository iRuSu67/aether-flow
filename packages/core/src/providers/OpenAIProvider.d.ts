import { CompletionRequest, ModelProvider } from './ModelProvider.js';
export declare class OpenAIProvider implements ModelProvider {
    name: string;
    private apiKey;
    private baseURL;
    private model;
    constructor(apiKey?: string, model?: string, baseURL?: string);
    generateText(request: CompletionRequest): Promise<string>;
    generateStructured<T>(request: CompletionRequest, schemaDescription: string): Promise<T>;
}
//# sourceMappingURL=OpenAIProvider.d.ts.map