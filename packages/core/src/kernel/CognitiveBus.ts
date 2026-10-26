import { CognitiveEvent, EventSeverity } from '../types.js';

export type EventListener = (event: CognitiveEvent) => void;

/**
 * CognitiveBus
 * Central event-driven nerve center of the AetherFlow microkernel.
 * Handles telemetry streaming, agent communication, and real-time state inspection.
 */
export class CognitiveBus {
  private listeners: Set<EventListener> = new Set();
  private eventHistory: CognitiveEvent[] = [];
  private maxHistory: number;

  constructor(maxHistory = 1000) {
    this.maxHistory = maxHistory;
  }

  /**
   * Subscribe a callback to receive all cognitive events
   */
  public subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emit an event across the bus
   */
  public emit(
    type: CognitiveEvent['type'],
    payload: Record<string, unknown>,
    agent?: string,
    severity: EventSeverity = 'info'
  ): CognitiveEvent {
    const event: CognitiveEvent = {
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
      } catch (err) {
        console.error('[CognitiveBus] Listener error:', err);
      }
    }

    return event;
  }

  /**
   * Get all recorded events
   */
  public getHistory(): CognitiveEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Filter events by type or agent
   */
  public filter(predicate: (event: CognitiveEvent) => boolean): CognitiveEvent[] {
    return this.eventHistory.filter(predicate);
  }

  /**
   * Clear event history
   */
  public clear(): void {
    this.eventHistory = [];
  }
}
