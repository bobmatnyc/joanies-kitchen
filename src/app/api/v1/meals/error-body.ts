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
