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

    // Distinguish "Ollama not available" from other errors
    const isOllamaError = message.toLowerCase().includes('ollama');

    return NextResponse.json(
      {
        success: false,
        error: message,
        hint: isOllamaError
          ? 'Ensure Ollama is running (`ollama serve`) and the gemma3:4b model is available (`ollama pull gemma3:4b`).'
          : undefined,
      },
      { status: isOllamaError ? 503 : 500 }
    );
  }
});
