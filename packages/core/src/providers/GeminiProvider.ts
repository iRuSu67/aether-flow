import { CompletionRequest, ModelProvider } from './ModelProvider.js';

export class GeminiProvider implements ModelProvider {
  public name = 'GoogleGeminiProvider';
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model = 'gemini-1.5-pro') {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    this.model = model;
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
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens ?? 2048,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async generateStructured<T>(request: CompletionRequest, schemaDescription: string): Promise<T> {
    const structuredPrompt = `${request.prompt}\n\nYou MUST respond STRICTLY with valid JSON conforming to this schema:\n${schemaDescription}\nDo not wrap in backticks or markdown if possible.`;
    const text = await this.generateText({ ...request, prompt: structuredPrompt });
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned) as T;
  }
}
