/**
 * Service Layer - Type-safe business logic
 *
 * This module exports all service classes and their singleton instances.
 * Services provide stateless, testable business logic that can be used by:
 * - API routes (REST endpoints)
 * - Server actions (Next.js server functions)
 * - Background jobs
 *
 * Key Principles:
 * 1. Services are authentication-free - caller handles auth
 * 2. Services throw errors - caller formats responses
 * 3. Services use Drizzle ORM types - type-safe data access
 * 4. Services are stateless - no shared state between calls
 *
 * Usage Examples:
 *
 * ```typescript
 * // In API routes
 * import { chefService } from '@/lib/services';
 * const chef = await chefService.findBySlug('kenji-lopez-alt');
 *
 * // In server actions with auth
 * import { getSessionUserId } from '@/lib/session-user';
 * import { collectionService } from '@/lib/services';
 *
 * const userId = await getSessionUserId();
 * if (!userId) throw new Error('Unauthorized');
 * const collections = await collectionService.findByUserId(userId);
 * ```
 */

// Export service classes (for testing/dependency injection)
// Export singleton instances (for production use)
export { ChefService, chefService } from './chef-service';
export { CollectionService, collectionService } from './collection-service';
export { IngredientService, ingredientService } from './ingredient-service';
export { InventoryService, inventoryService } from './inventory-service';
export { SocialService, socialService } from './social-service';
