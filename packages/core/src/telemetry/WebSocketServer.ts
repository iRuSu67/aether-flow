import { WebSocketServer as WSS, WebSocket } from 'ws';
import { CognitiveBus } from '../kernel/CognitiveBus.js';
import { CognitiveEvent } from '../types.js';

export interface TelemetryServerOptions {
  port?: number;
  bus: CognitiveBus;
}

export class TelemetryServer {
  private wss: WSS | null = null;
  private port: number;
  private bus: CognitiveBus;
  private unsubscribeBus?: () => void;

  constructor(options: TelemetryServerOptions) {
    this.port = options.port || 4884;
    this.bus = options.bus;
  }

  public start(): Promise<number> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WSS({ port: this.port });

        this.wss.on('listening', () => {
          this.unsubscribeBus = this.bus.subscribe((event: CognitiveEvent) => {
            this.broadcast({
              type: 'event',
              data: event,
            });
          });
          resolve(this.port);
        });

        this.wss.on('connection', (ws: WebSocket) => {
          // Send initial welcome & cached history
          ws.send(
            JSON.stringify({
              type: 'init',
              payload: {
                message: 'Connected to AetherFlow Telemetry Stream',
                history: this.bus.getHistory().slice(-50),
              },
            })
          );
        });

        this.wss.on('error', (err) => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  public broadcast(payload: Record<string, unknown>): void {
    if (!this.wss) return;
    const data = JSON.stringify(payload);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.unsubscribeBus) {
        this.unsubscribeBus();
      }
      if (this.wss) {
        this.wss.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
