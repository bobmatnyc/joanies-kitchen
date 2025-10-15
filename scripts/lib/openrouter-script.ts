/**
 * OpenRouter client for standalone scripts
 * This version doesn't use 'server-only' so it can be used in tsx scripts
 */

import OpenAI from 'openai';

export function getOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3004',
      'X-Title': 'Recipe Manager',
    },
  });
}
