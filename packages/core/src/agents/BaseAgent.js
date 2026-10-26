export class BaseAgent {
    id;
    name;
    role;
    systemPrompt;
    provider;
    bus;
    memory = [];
    constructor(id, name, role, systemPrompt, provider, bus) {
        this.id = id;
        this.name = name;
        this.role = role;
        this.systemPrompt = systemPrompt;
        this.provider = provider;
        this.bus = bus;
    }
    recordMessage(sender, content, role) {
        const msg = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            sender,
            role,
            content,
            timestamp: Date.now(),
        };
        this.memory.push(msg);
        return msg;
    }
    getMemory() {
        return [...this.memory];
    }
    clearMemory() {
        this.memory = [];
    }
}
//# sourceMappingURL=BaseAgent.js.map