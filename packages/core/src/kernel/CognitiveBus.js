/**
 * CognitiveBus
 * Central event-driven nerve center of the AetherFlow microkernel.
 * Handles telemetry streaming, agent communication, and real-time state inspection.
 */
export class CognitiveBus {
    listeners = new Set();
    eventHistory = [];
    maxHistory;
    constructor(maxHistory = 1000) {
        this.maxHistory = maxHistory;
    }
    /**
     * Subscribe a callback to receive all cognitive events
     */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    /**
     * Emit an event across the bus
     */
    emit(type, payload, agent, severity = 'info') {
        const event = {
            id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            type,
            agent,
            payload,
            timestamp: Date.now(),
            severity,
        };
        this.eventHistory.push(event);
        if (this.eventHistory.length > this.maxHistory) {
            this.eventHistory.shift();
        }
        for (const listener of this.listeners) {
            try {
                listener(event);
            }
            catch (err) {
                console.error('[CognitiveBus] Listener error:', err);
            }
        }
        return event;
    }
    /**
     * Get all recorded events
     */
    getHistory() {
        return [...this.eventHistory];
    }
    /**
     * Filter events by type or agent
     */
    filter(predicate) {
        return this.eventHistory.filter(predicate);
    }
    /**
     * Clear event history
     */
    clear() {
        this.eventHistory = [];
    }
}
//# sourceMappingURL=CognitiveBus.js.map