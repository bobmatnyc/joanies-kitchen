/**
 * Admin API: Clean Recipes with Local AI
 *
 * POST /api/admin/clean-recipes?limit=5
 *
 * Uses a local Ollama model (gemma3:4b) to standardize recipe text:
 * - Fix spelling/grammar
 * - Standardize measurements
 * - Number instructions clearly
 *
 * Query params:
 * - limit: number of recipes to clean (default 5, max 20)
 *
 * Authentication: requires admin:system scope
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireScopes } from '@/lib/api-auth/require-auth';
import { SCOPES } from '@/lib/api-auth/scopes';
import { cleanRecipesWithOllama } from '@/lib/services/recipe-cleaner.service';
import { toErrorMessage } from '@/lib/utils/error-handling';

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

export const POST = requireScopes([SCOPES.ADMIN_SYSTEM], async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(limitParam ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
  );

  try {
    const result = await cleanRecipesWithOllama(limit);

    return NextResponse.json({
      success: true,
      data: result,
      message: `Cleaned ${result.processed} recipes, skipped ${result.skipped}`,
    });
  } catch (err) {
    const message = toErrorMessage(err);
    console.error('[api/admin/clean-recipes]', message);

    // Distinguish "no AI provider available" from other errors
    const isProviderError =
      message.toLowerCase().includes('ollama') ||
      message.toLowerCase().includes('openrouter') ||
      message.toLowerCase().includes('neither');

    return NextResponse.json(
      {
        success: false,
        error: message,
        hint: isProviderError
          ? 'Neither OpenRouter API key nor local Ollama is available. Set OPENROUTER_API_KEY in your environment or run Ollama locally.'
          : undefined,
      },
      { status: isProviderError ? 503 : 500 }
    );
  }
});
