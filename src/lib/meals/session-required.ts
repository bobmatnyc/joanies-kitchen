/**
 * #253: the meal server actions read the session user. A v1 route reached with
 * only an API key has no session, so the action refuses. These helpers let the
 * route tell that refusal apart from a real failure and answer 401, not 500.
 *
 * The refusal keeps the action's existing `'Unauthorized'` message, so UI
 * callers that show `result.error` are unchanged.
 *
 * Lives outside `src/app/actions/meals.ts` because a `'use server'` module may
 * export only async functions.
 *
 * Test: `src/app/actions/__tests__/meal-routes-api-key-401.test.ts`
 */

export const SESSION_REQUIRED_ERROR_CODE = 'SESSION_REQUIRED';

/** #253: the result a meal action returns when there is no session user. */
export function sessionRequiredRefusal() {
  return {
    success: false as const,
    error: 'Unauthorized',
    errorCode: SESSION_REQUIRED_ERROR_CODE,
  };
}

/** #253: true when a meal action's result is a `sessionRequiredRefusal`. */
export function isSessionRequiredRefusal(result: object): boolean {
  return 'errorCode' in result && result.errorCode === SESSION_REQUIRED_ERROR_CODE;
}
