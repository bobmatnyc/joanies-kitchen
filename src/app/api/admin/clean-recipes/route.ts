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
 * Authentication: the caller's `users.is_admin` must be true (see `isAdminCaller`).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { apiForbidden } from '@/lib/api/responses';
import { authHasScope } from '@/lib/api-auth/middleware';
import { requireAuth } from '@/lib/api-auth/require-auth';
import { SCOPES } from '@/lib/api-auth/scopes';
import type { AuthContext } from '@/lib/api-auth/types';
import { getUserAdminFlag } from '@/lib/auth-users';
import { cleanRecipesWithOllama } from '@/lib/services/recipe-cleaner.service';
import { toErrorMessage } from '@/lib/utils/error-handling';

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

/**
 * Why: #239 — signed-in admins hold no `admin:system` scope, so a scope-only
 * gate shut them out of this operation.
 * What: true only when `users.is_admin` is true for `auth.userId` (the session
 * user, or an API key's owner). A missing row, null or a failed lookup is
 * false. Every non-session caller (an API key) must also hold `admin:system`:
 * a key acts only through its scopes, so an admin's narrowly scoped key cannot
 * run a system operation.
 * Test: `src/app/api/admin/clean-recipes/__tests__/route-admin-access.test.ts`
 */
async function isAdminCaller(auth: AuthContext): Promise<boolean> {
  if (!auth.userId) return false;
  if (auth.authType !== 'session' && !authHasScope(auth, SCOPES.ADMIN_SYSTEM)) return false;
  try {
    return (await getUserAdminFlag(auth.userId)) === true;
  } catch (error: unknown) {
    console.error('[api/admin/clean-recipes] users.is_admin lookup failed; denying:', error);
    return false;
  }
}

// #239: gate on the caller's users.is_admin, not on the admin:system scope alone.
export const POST = requireAuth(async (request: NextRequest, auth: AuthContext) => {
  if (!(await isAdminCaller(auth))) return apiForbidden('Admin access required');

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
