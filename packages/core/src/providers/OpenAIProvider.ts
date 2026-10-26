import { CompletionRequest, ModelProvider } from './ModelProvider.js';

export class OpenAIProvider implements ModelProvider {
  public name = 'OpenAICompatibleProvider';
  private apiKey: string;
  private baseURL: string;
  private model: string;

  constructor(apiKey?: string, model = 'gpt-4o', baseURL = 'https://api.openai.com/v1') {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.model = model;
    this.baseURL = baseURL;
  }

  async generateText(request: CompletionRequest): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        'OpenAI API key is required. Pass it in config or set OPENAI_API_KEY environment variable.'
      );
    }

    const messages = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.prompt });

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API Error (${response.status}): ${err}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return data.choices?.[0]?.message?.content || '';
  }

  async generateStructured<T>(request: CompletionRequest, schemaDescription: string): Promise<T> {
    const prompt = `${request.prompt}\nRespond strictly with valid JSON conforming to:\n${schemaDescription}`;
    const text = await this.generateText({ ...request, prompt });
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned) as T;
  }
}
