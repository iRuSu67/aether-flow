import { CognitiveEvent, EventSeverity } from '../types.js';
export type EventListener = (event: CognitiveEvent) => void;
/**
 * CognitiveBus
 * Central event-driven nerve center of the AetherFlow microkernel.
 * Handles telemetry streaming, agent communication, and real-time state inspection.
 */
export declare class CognitiveBus {
    private listeners;
    private eventHistory;
    private maxHistory;
    constructor(maxHistory?: number);
    /**
     * Subscribe a callback to receive all cognitive events
     */
    subscribe(listener: EventListener): () => void;
    /**
     * Emit an event across the bus
     */
    emit(type: CognitiveEvent['type'], payload: Record<string, unknown>, agent?: string, severity?: EventSeverity): CognitiveEvent;
    /**
     * Get all recorded events
     */
    getHistory(): CognitiveEvent[];
    /**
     * Filter events by type or agent
     */
    filter(predicate: (event: CognitiveEvent) => boolean): CognitiveEvent[];
    /**
     * Clear event history
     */
    clear(): void;
}
//# sourceMappingURL=CognitiveBus.d.ts.map