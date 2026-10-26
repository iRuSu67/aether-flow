export interface CompletionRequest {
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
}
export interface ModelProvider {
    name: string;
    generateText(request: CompletionRequest): Promise<string>;
    generateStructured<T>(request: CompletionRequest, schemaDescription: string): Promise<T>;
}
//# sourceMappingURL=ModelProvider.d.ts.map