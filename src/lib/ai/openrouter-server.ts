// Server-only file for OpenRouter API client
import 'server-only';
import OpenAI from 'openai';

// Create OpenRouter client - only for server-side use
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

// Re-export the constants from the client-safe file
export { MODELS, MODEL_CATEGORIES, type ModelName } from './openrouter';