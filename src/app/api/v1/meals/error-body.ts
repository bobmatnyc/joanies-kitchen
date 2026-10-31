import { NextResponse } from 'next/server';

/**
 * #253: the 401 a v1 meal route returns when its server action refuses for
 * lack of a session user (an API-key-only caller). Same body shape as the
 * session-only `/api/v1/auth/keys` 401s.
 *
 * Test: `src/app/actions/__tests__/meal-routes-api-key-401.test.ts`
 */
export function mealSessionRequiredResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Authentication required',
      reason: 'missing_auth',
      note: 'This meal endpoint requires a signed-in session',
    },
    { status: 401, headers: { 'WWW-Authenticate': 'Session realm="Meals"' } }
  );
}

/**
 * #241: v1 meal routes must not put raw action error text (which can carry
 * database constraint names) into a 500 response body.
 *
 * Returns the message to send for a given status. A 500 logs the detail on the
 * server and returns the fixed `generic` message; any other status keeps the
 * action's own message (e.g. 'Meal not found').
 *
 * Test: `src/app/actions/__tests__/meal-routes-500-messages.test.ts`
 */
export function mealErrorMessage(
  status: number,
  error: string | undefined,
  generic: string
): string {
  if (status === 500) {
    console.error(`${generic}:`, error);
    return generic;
  }
  return error || generic;
}
