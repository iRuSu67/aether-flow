import { CognitiveBus } from '../kernel/CognitiveBus.js';
import { ModelProvider } from '../providers/ModelProvider.js';
import { ToolSynthesisRequest, ToolSynthesisResult } from '../types.js';
import { Sandbox } from './Sandbox.js';
import { ToolRegistry } from './ToolRegistry.js';
export declare class ToolForge {
    private provider;
    private registry;
    private sandbox;
    private bus?;
    private maxRetries;
    constructor(provider: ModelProvider, registry: ToolRegistry, sandbox?: Sandbox, bus?: CognitiveBus);
    /**
     * Synthesize a tool just-in-time from a specification and verify in sandbox
     */
    synthesize(request: ToolSynthesisRequest): Promise<ToolSynthesisResult>;
    private buildSynthesisPrompt;
    private extractCode;
    private generateSampleArgs;
}
//# sourceMappingURL=ToolForge.d.ts.map