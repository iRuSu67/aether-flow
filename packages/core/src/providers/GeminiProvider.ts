import { CompletionRequest, ModelProvider } from './ModelProvider.js';

export class GeminiProvider implements ModelProvider {
  public name = 'GoogleGeminiProvider';
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    this.model =
      model ||
      process.env.GEMINI_MODEL ||
      process.env.MODEL_NAME ||
      process.env.MODEL ||
      'gemini-3.5-flash-lite';
  }

  setModel(model: string): void {
    this.model = model;
  }

  getModel(): string {
    return this.model;
  }

  async generateText(request: CompletionRequest): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        'Gemini API key is required. Pass it in config or set GEMINI_API_KEY environment variable.'
      );
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const contents = [
      {
        role: 'user',
        parts: [{ text: (request.systemPrompt ? `${request.systemPrompt}\n\n` : '') + request.prompt }],
      },
    ];

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${err}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async generateStructured<T>(request: CompletionRequest, schemaDescription: string): Promise<T> {
    const prompt = `${request.prompt}\nRespond strictly with valid JSON conforming to:\n${schemaDescription}`;
    const text = await this.generateText({ ...request, prompt });
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned) as T;
  }
}
