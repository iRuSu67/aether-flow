import { ToolDefinition } from '../types.js';
import { WebSearchEngine } from './search/WebSearchEngine.js';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private searchEngine: WebSearchEngine = new WebSearchEngine();

  constructor() {
    this.registerStandardTools();
  }

  /**
   * Register a standard or dynamic tool
   */
  public register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Check if tool exists
   */
  public has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get tool definition
   */
  public get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * List all registered tools
   */
  public list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Execute a registered tool
   */
  public async execute(name: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool "${name}" is not registered.`);
    }
    return await tool.handler(args);
  }

  /**
   * Pre-loads essential foundational tools
   */
  private registerStandardTools(): void {
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
        const sortBy = args.sortBy as string | undefined;
        const order = (args.order as string) === 'desc' ? -1 : 1;

        if (sortBy) {
          data.sort((a: any, b: any) => {
            if (a[sortBy] < b[sortBy]) return -1 * order;
            if (a[sortBy] > b[sortBy]) return 1 * order;
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
        } catch (err) {
          return { error: String(err), status: 500 };
        }
      }
    });

    // 4. Live Autonomous Web Search
    this.register({
      name: 'web_search',
      description: 'Searches the live public web for real-time information, research papers, and technical data.',
      parameters: [
        { name: 'query', type: 'string', description: 'Search query string', required: true }
      ],
      handler: async (args) => {
        return await this.searchEngine.search(String(args.query || ''));
      }
    });

    // 5. Web Scraper & Article Extractor
    this.register({
      name: 'web_scrape',
      description: 'Extracts clean, readable article content from a specified URL.',
      parameters: [
        { name: 'url', type: 'string', description: 'Target URL to scrape', required: true }
      ],
      handler: async (args) => {
        return await this.searchEngine.extractPageText(String(args.url || ''));
      }
    });
  }
}
