import { CognitiveBus } from '../kernel/CognitiveBus.js';
export interface TelemetryServerOptions {
    port?: number;
    bus: CognitiveBus;
}
export declare class TelemetryServer {
    private wss;
    private port;
    private bus;
    private unsubscribeBus?;
    constructor(options: TelemetryServerOptions);
    start(): Promise<number>;
    broadcast(payload: Record<string, unknown>): void;
    stop(): Promise<void>;
}
//# sourceMappingURL=WebSocketServer.d.ts.map