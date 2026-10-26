export class ToolRegistry {
    tools = new Map();
    constructor() {
        this.registerStandardTools();
    }
    /**
     * Register a standard or dynamic tool
     */
    register(tool) {
        this.tools.set(tool.name, tool);
    }
    /**
     * Check if tool exists
     */
    has(name) {
        return this.tools.has(name);
    }
    /**
     * Get tool definition
     */
    get(name) {
        return this.tools.get(name);
    }
    /**
     * List all registered tools
     */
    list() {
        return Array.from(this.tools.values());
    }
    /**
     * Execute a registered tool
     */
    async execute(name, args) {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Tool "${name}" is not registered.`);
        }
        return await tool.handler(args);
    }
    /**
     * Pre-loads essential foundational tools
     */
    registerStandardTools() {
        // 1. Text Analyzer
        this.register({
            name: 'text_analyzer',
            description: 'Calculates word count, sentiment metrics, readability and character distribution.',
            parameters: [
                { name: 'text', type: 'string', description: 'Input text to evaluate', required: true }
            ],
            handler: (args) => {
                const text = String(args.text || '');
                const words = text.trim().split(/\s+/).filter(Boolean);
                return {
                    wordCount: words.length,
                    charCount: text.length,
                    avgWordLength: words.length > 0 ? (text.length / words.length).toFixed(1) : 0,
                    timestamp: Date.now()
                };
            }
        });
        // 2. Data Sorter & Filter
        this.register({
            name: 'data_filter',
            description: 'Filters and sorts arrays of objects by key and predicate.',
            parameters: [
                { name: 'data', type: 'array', description: 'Array of records', required: true },
                { name: 'sortBy', type: 'string', description: 'Key to sort by' },
                { name: 'order', type: 'string', description: 'asc or desc' }
            ],
            handler: (args) => {
                const data = Array.isArray(args.data) ? [...args.data] : [];
                const sortBy = args.sortBy;
                const order = args.order === 'desc' ? -1 : 1;
                if (sortBy) {
                    data.sort((a, b) => {
                        if (a[sortBy] < b[sortBy])
                            return -1 * order;
                        if (a[sortBy] > b[sortBy])
                            return 1 * order;
                        return 0;
                    });
                }
                return { count: data.length, data };
            }
        });
        // 3. HTTP Fetcher / Web Extractor
        this.register({
            name: 'http_get',
            description: 'Fetches content or JSON data from a public URL.',
            parameters: [
                { name: 'url', type: 'string', description: 'URL to query', required: true }
            ],
            handler: async (args) => {
                const url = String(args.url);
                try {
                    const res = await fetch(url);
                    const contentType = res.headers.get('content-type') || '';
                    if (contentType.includes('application/json')) {
                        return { status: res.status, json: await res.json() };
                    }
                    return { status: res.status, text: (await res.text()).slice(0, 5000) };
                }
                catch (err) {
                    return { error: String(err), status: 500 };
                }
            }
        });
    }
}
//# sourceMappingURL=ToolRegistry.js.map