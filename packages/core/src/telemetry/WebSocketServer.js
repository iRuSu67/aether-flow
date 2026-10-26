import { WebSocketServer as WSS, WebSocket } from 'ws';
export class TelemetryServer {
    wss = null;
    port;
    bus;
    unsubscribeBus;
    constructor(options) {
        this.port = options.port || 4884;
        this.bus = options.bus;
    }
    start() {
        return new Promise((resolve, reject) => {
            try {
                this.wss = new WSS({ port: this.port });
                this.wss.on('listening', () => {
                    this.unsubscribeBus = this.bus.subscribe((event) => {
                        this.broadcast({
                            type: 'event',
                            data: event,
                        });
                    });
                    resolve(this.port);
                });
                this.wss.on('connection', (ws) => {
                    // Send initial welcome & cached history
                    ws.send(JSON.stringify({
                        type: 'init',
                        payload: {
                            message: 'Connected to AetherFlow Telemetry Stream',
                            history: this.bus.getHistory().slice(-50),
                        },
                    }));
                });
                this.wss.on('error', (err) => {
                    reject(err);
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }
    broadcast(payload) {
        if (!this.wss)
            return;
        const data = JSON.stringify(payload);
        for (const client of this.wss.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        }
    }
    stop() {
        return new Promise((resolve) => {
            if (this.unsubscribeBus) {
                this.unsubscribeBus();
            }
            if (this.wss) {
                this.wss.close(() => resolve());
            }
            else {
                resolve();
            }
        });
    }
}
//# sourceMappingURL=WebSocketServer.js.map