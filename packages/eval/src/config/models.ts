export interface ModelProfile {
  model: string;
  provider: 'gemini' | 'mock' | 'ollama' | 'openai';
  rpm: number;
  tpm: number;
  rpd: number;
  defaultDailyBudget: number;
  minPacingMs: number;
  supportsThinking: boolean;
  defaultThinkingLevel: 'low' | 'medium' | 'high';
  supportedThinkingLevels?: Array<'minimal' | 'low' | 'medium' | 'high'>;
  maxOutputTokens?: number;
  isStable: boolean;
  isLightweight: boolean;
  docUrl: string;
  description: string;
}

export const DEFAULT_EVAL_MODEL = 'gemini-3.5-flash-lite';

export const MODEL_PROFILES: Record<string, ModelProfile> = {
  'gemini-3.5-flash-lite': {
    model: 'gemini-3.5-flash-lite',
    provider: 'gemini',
    rpm: 15,
    tpm: 250000,
    rpd: 500,
    defaultDailyBudget: 450,
    minPacingMs: 4500, // ~4.5s pacing
    supportsThinking: true,
    defaultThinkingLevel: 'medium',
    supportedThinkingLevels: ['minimal', 'low', 'medium', 'high'],
    maxOutputTokens: 65536,
    isStable: true,
    isLightweight: true,
    docUrl: 'https://ai.google.dev/gemini-api/docs/models#gemini-3.5-flash-lite',
    description: 'Gemini 3.5 Flash Lite: 15 RPM, 250K TPM, 500 RPD, stable release with thinkingLevel support',
  },
  'gemini-3.1-flash-lite': {
    model: 'gemini-3.1-flash-lite',
    provider: 'gemini',
    rpm: 15,
    tpm: 250000,
    rpd: 500,
    defaultDailyBudget: 450,
    minPacingMs: 4500,
    supportsThinking: true,
    defaultThinkingLevel: 'medium',
    supportedThinkingLevels: ['minimal', 'low', 'medium', 'high'],
    maxOutputTokens: 65536,
    isStable: true,
    isLightweight: true,
    docUrl: 'https://ai.google.dev/gemini-api/docs/models#gemini-3.1-flash-lite',
    description: 'Gemini 3.1 Flash Lite (fallback): 15 RPM, 250K TPM, 500 RPD, stable release with thinkingLevel support',
  },
  'gemini-3.8-flash': {
    model: 'gemini-3.8-flash',
    provider: 'gemini',
    rpm: 5,
    tpm: 250000,
    rpd: 20,
    defaultDailyBudget: 18,
    minPacingMs: 13000, // 13s pacing
    supportsThinking: true,
    defaultThinkingLevel: 'medium',
    supportedThinkingLevels: ['low', 'medium', 'high'], // 'minimal' is NOT supported on 3.8 Flash!
    maxOutputTokens: 65536,
    isStable: true,
    isLightweight: false,
    docUrl: 'https://ai.google.dev/gemini-api/docs/models#gemini-3.8-flash',
    description: 'Gemini 3.8 Flash (reasoning model): 5 RPM, 250K TPM, 20 RPD, supports low/medium/high thinking (minimal is unsupported)',
  },
  'gemma-4-26b': {
    model: 'gemma-4-26b',
    provider: 'gemini',
    rpm: 30,
    tpm: 16000,
    rpd: 14400,
    defaultDailyBudget: 10000,
    minPacingMs: 7500, // TPM-aware pacing for 16K TPM limit (~8 calls/min max)
    supportsThinking: false, // Gemma does NOT support thinkingLevel
    defaultThinkingLevel: 'low',
    isStable: false, // Community open model; GA status unverified in AI Studio table
    isLightweight: true,
    docUrl: 'https://ai.google.dev/gemma',
    description: 'Gemma 4 26B: 30 RPM, 16K TPM (TPM-aware 7.5s pacing), 14.4K RPD, thinkingConfig disabled',
  },
  'gemma-4-31b': {
    model: 'gemma-4-31b',
    provider: 'gemini',
    rpm: 30,
    tpm: 16000,
    rpd: 14400,
    defaultDailyBudget: 10000,
    minPacingMs: 7500, // TPM-aware pacing for 16K TPM limit
    supportsThinking: false,
    defaultThinkingLevel: 'low',
    isStable: false,
    isLightweight: true,
    docUrl: 'https://ai.google.dev/gemma',
    description: 'Gemma 4 31B: 30 RPM, 16K TPM (TPM-aware 7.5s pacing), 14.4K RPD, thinkingConfig disabled',
  },
};

export function getModelProfile(modelName: string): ModelProfile {
  if (MODEL_PROFILES[modelName]) {
    return MODEL_PROFILES[modelName];
  }
  // Generic fallback for custom, test, or mock models
  const isGemma = modelName.toLowerCase().includes('gemma');
  return {
    model: modelName,
    provider: 'gemini',
    rpm: 15,
    tpm: 250000,
    rpd: 500,
    defaultDailyBudget: 450,
    minPacingMs: isGemma ? 7500 : 4500,
    supportsThinking: !isGemma,
    defaultThinkingLevel: 'medium',
    maxOutputTokens: 65536,
    isStable: true,
    isLightweight: true,
    docUrl: 'https://ai.google.dev/gemini-api/docs/models',
    description: `Custom model profile for ${modelName}`,
  };
}
