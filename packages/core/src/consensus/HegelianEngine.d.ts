import { CognitiveBus } from '../kernel/CognitiveBus.js';
import { ModelProvider } from '../providers/ModelProvider.js';
import { DialecticRound } from '../types.js';
export interface HegelianResult {
    converged: boolean;
    finalSynthesis: string;
    confidenceScore: number;
    rounds: DialecticRound[];
    totalRounds: number;
}
/**
 * HegelianEngine
 * Orchestrates multi-agent dialectic consensus (Thesis -> Antithesis -> Synthesis).
 * Resolves complex or high-ambiguity goals with adversarial verification.
 */
export declare class HegelianEngine {
    private provider;
    private bus?;
    private maxRounds;
    private convergenceThreshold;
    constructor(provider: ModelProvider, bus?: CognitiveBus, maxRounds?: number, convergenceThreshold?: number);
    resolve(goal: string, context?: Record<string, unknown>): Promise<HegelianResult>;
}
//# sourceMappingURL=HegelianEngine.d.ts.map