// This file should only be imported in server-side code (server actions)
// Available models on OpenRouter
export const MODELS = {
  // Free models
  LLAMA_3_8B: 'meta-llama/llama-3.2-3b-instruct:free',
  MISTRAL_7B: 'mistralai/mistral-7b-instruct:free',

  // Models with web search capabilities (Perplexity)
  PERPLEXITY_SONAR: 'perplexity/sonar',
  PERPLEXITY_SONAR_REASONING: 'perplexity/sonar-reasoning',
  PERPLEXITY_SONAR_PRO: 'perplexity/sonar-pro',

  // Vision and multimodal models
  LLAMA_90B_VISION: 'meta-llama/llama-3.2-90b-vision-instruct',
  GPT_4O: 'openai/gpt-4o',

  // General purpose high quality models
  CLAUDE_3_5_SONNET: 'anthropic/claude-3.5-sonnet',
  CLAUDE_SONNET_4_5: 'anthropic/claude-sonnet-4.5',
  CLAUDE_3_HAIKU: 'anthropic/claude-3-haiku',
  GPT_3_5_TURBO: 'openai/gpt-3.5-turbo',
  MIXTRAL_8X7B: 'mistralai/mixtral-8x7b-instruct',
} as const;

// Model categories for UI organization
export const MODEL_CATEGORIES = {
  'Web Search Enabled': [
    { value: MODELS.PERPLEXITY_SONAR, label: 'Perplexity Sonar (Fast, Web Search)' },
    { value: MODELS.PERPLEXITY_SONAR_REASONING, label: 'Perplexity Sonar Reasoning (Web Search + Analysis)' },
    { value: MODELS.PERPLEXITY_SONAR_PRO, label: 'Perplexity Sonar Pro (Advanced Web Search)' },
  ],
  'Vision & Multimodal': [
    { value: MODELS.LLAMA_90B_VISION, label: 'Llama 3.2 90B Vision' },
    { value: MODELS.GPT_4O, label: 'GPT-4o (Multimodal)' },
  ],
  'General Purpose': [
    { value: MODELS.CLAUDE_3_5_SONNET, label: 'Claude 3.5 Sonnet' },
    { value: MODELS.CLAUDE_3_HAIKU, label: 'Claude 3 Haiku' },
    { value: MODELS.GPT_3_5_TURBO, label: 'GPT-3.5 Turbo' },
    { value: MODELS.MIXTRAL_8X7B, label: 'Mixtral 8x7B' },
  ],
  'Free Models': [
    { value: MODELS.LLAMA_3_8B, label: 'Llama 3.2 3B (Free)' },
    { value: MODELS.MISTRAL_7B, label: 'Mistral 7B (Free)' },
  ],
} as const;

export type ModelName = typeof MODELS[keyof typeof MODELS];