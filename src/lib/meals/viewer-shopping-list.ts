import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { type ShoppingList, shoppingLists } from '@/lib/db/schema';

/**
 * Why: any signed-in viewer of a public meal can generate a shopping list
 * against it, so one meal can carry lists from several users (#223).
 * What: returns the viewer's newest shopping list for the meal, or null.
 * A null viewer (signed out) gets null without a query.
 * Test: `src/lib/__tests__/meal-page-shopping-list.test.ts`
 */
export async function getViewerShoppingListForMeal(
  mealId: string,
  viewerId: string | null
): Promise<ShoppingList | null> {
  if (!viewerId) return null;
  const [list] = await db
    .select()
    .from(shoppingLists)
    // #223: scope to the viewer; meal_id alone returns other users' lists.
    .where(and(eq(shoppingLists.meal_id, mealId), eq(shoppingLists.user_id, viewerId)))
    .orderBy(desc(shoppingLists.created_at))
    .limit(1);
  return list ?? null;
}
