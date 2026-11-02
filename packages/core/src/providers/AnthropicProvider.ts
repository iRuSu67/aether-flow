import { CompletionRequest, ModelProvider } from './ModelProvider.js';

export class AnthropicProvider implements ModelProvider {
  public name = 'AnthropicClaudeProvider';
  private apiKey: string;
  private model: string;
  private baseURL: string;

  constructor(
    apiKey?: string,
    model?: string,
    baseURL = 'https://api.anthropic.com/v1'
  ) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.model = model || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    this.baseURL = baseURL;
  }

  async generateText(request: CompletionRequest): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        'Anthropic API key is required. Pass it in config or set ANTHROPIC_API_KEY environment variable.'
      );
    }

    const payload: Record<string, unknown> = {
      model: this.model,
      max_tokens: request.maxTokens ?? 2048,
      messages: [{ role: 'user', content: request.prompt }],
    };

    if (request.systemPrompt) {
      payload.system = request.systemPrompt;
    }
    if (typeof request.temperature === 'number') {
      payload.temperature = request.temperature;
    }

    const response = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API Error (${response.status}): ${err}`);
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    return (
      data.content
        ?.filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('') || ''
    );
  }

  async generateStructured<T>(request: CompletionRequest, schemaDescription: string): Promise<T> {
    const prompt = `${request.prompt}\nRespond strictly with valid JSON conforming to:\n${schemaDescription}`;
    const text = await this.generateText({ ...request, prompt });
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned) as T;
  }
}
