/**
 * OpenRouter AI Client
 *
 * Thin wrapper around the OpenAI SDK pointed at OpenRouter.
 * Used as the primary AI provider for recipe cleaning, image prompt generation, etc.
 * Falls back to local Ollama when OPENROUTER_API_KEY is not set.
 */

import 'server-only';
import OpenAI from 'openai';

export const DEFAULT_OPENROUTER_MODEL = 'anthropic/claude-haiku-4-5';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');
    _client = new OpenAI({
      apiKey,
      baseURL: OPENROUTER_BASE_URL,
      defaultHeaders: {
        'HTTP-Referer': 'https://joanies.kitchen',
        'X-Title': 'Joanies Kitchen',
      },
    });
  }
  return _client;
}

/**
 * Returns true if OPENROUTER_API_KEY is configured (sync, no network call)
 */
export function isOpenRouterAvailable(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/**
 * Generate text via OpenRouter using the chat completions endpoint.
 *
 * @param prompt - The user prompt
 * @param model  - OpenRouter model identifier (defaults to Claude Haiku 4-5)
 * @param maxTokens - Maximum tokens to generate (default 2000)
 * @returns The generated text
 */
export async function openrouterGenerate(
  prompt: string,
  model: string = DEFAULT_OPENROUTER_MODEL,
  maxTokens = 2000
): Promise<string> {
  const client = getClient();

  const completion = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });

  return completion.choices[0]?.message?.content ?? '';
}
