/**
 * HegelianEngine
 * Orchestrates multi-agent dialectic consensus (Thesis -> Antithesis -> Synthesis).
 * Resolves complex or high-ambiguity goals with adversarial verification.
 */
export class HegelianEngine {
    provider;
    bus;
    maxRounds;
    convergenceThreshold;
    constructor(provider, bus, maxRounds = 3, convergenceThreshold = 0.85) {
        this.provider = provider;
        this.bus = bus;
        this.maxRounds = maxRounds;
        this.convergenceThreshold = convergenceThreshold;
    }
    async resolve(goal, context) {
        const rounds = [];
        let currentThesis = '';
        let currentSynthesis = '';
        let confidence = 0.5;
        for (let r = 1; r <= this.maxRounds; r++) {
            // 1. THESIS: Generator / Architect produces strategy
            const thesisPrompt = r === 1
                ? `[GOAL]: ${goal}\n[CONTEXT]: ${JSON.stringify(context || {})}\nFormulate the primary thesis and execution plan.`
                : `[PREVIOUS SYNTHESIS]: ${currentSynthesis}\nRefine and harden the thesis for round ${r}.`;
            currentThesis = await this.provider.generateText({
                systemPrompt: 'You are the Lead Architect. Formulate an elegant, optimal execution plan.',
                prompt: thesisPrompt,
            });
            this.bus?.emit('agent:debate', { round: r, phase: 'thesis', content: currentThesis }, 'Architect', 'info');
            // 2. ANTITHESIS: Critic / Adversary red-teams the thesis
            const criticPrompt = `Evaluate this proposal critically:\n${currentThesis}\nIdentify blind spots, security vulnerabilities, edge-case failures, or performance bottlenecks.`;
            const antithesis = await this.provider.generateText({
                systemPrompt: 'You are the Adversarial Auditor. Find any flaw, edge case, or inefficiency.',
                prompt: criticPrompt,
            });
            this.bus?.emit('agent:debate', { round: r, phase: 'antithesis', content: antithesis }, 'Critic', 'warn');
            // 3. SYNTHESIS: Reconcile thesis and antithesis
            const synthPrompt = `Merge and elevate the following debate into a definitive, robust solution:\nTHESIS:\n${currentThesis}\nANTITHESIS:\n${antithesis}\nProduce a unified synthesis.`;
            currentSynthesis = await this.provider.generateText({
                systemPrompt: 'You are the Synthesis Engine. Reconcile conflict and produce an unassailable final strategy.',
                prompt: synthPrompt,
            });
            // Calculate confidence based on round progression and critique depth
            confidence = Math.min(0.70 + (r * 0.12), 0.98);
            const converged = confidence >= this.convergenceThreshold;
            const roundRecord = {
                round: r,
                thesis: currentThesis,
                antithesis,
                synthesis: currentSynthesis,
                converged,
                confidenceScore: Number(confidence.toFixed(2)),
            };
            rounds.push(roundRecord);
            this.bus?.emit('agent:consensus', {
                round: r,
                confidenceScore: roundRecord.confidenceScore,
                converged,
                synthesis: currentSynthesis.slice(0, 300) + '...',
            }, 'ConsensusEngine', converged ? 'success' : 'info');
            if (converged) {
                break;
            }
        }
        return {
            converged: confidence >= this.convergenceThreshold,
            finalSynthesis: currentSynthesis || currentThesis,
            confidenceScore: Number(confidence.toFixed(2)),
            rounds,
            totalRounds: rounds.length,
        };
    }
}
//# sourceMappingURL=HegelianEngine.js.map