/**
 * REST API v1 - Inventory Usage Endpoint
 *
 * POST /api/v1/inventory/:id/use - Mark item as used (reduce quantity)
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Scope-based permissions + ownership verification
 */

import type { NextRequest } from 'next/server';
import { apiError, apiSuccess, getRouteParams, parseJsonBody, verifyResourceOwnership } from '@/lib/api';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import { inventoryService } from '@/lib/services/inventory-service';
import { markAsUsedSchema } from '@/lib/validations/inventory-api';

/**
 * POST /api/v1/inventory/:id/use
 *
 * Mark an inventory item as used and reduce its quantity
 *
 * Request Body:
 * {
 *   quantity: number,
 *   action?: 'cooked' | 'eaten_raw' | 'composted' | 'trashed' | 'donated',
 *   recipe_id?: string (UUID),
 *   notes?: string
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     remainingQuantity: number
 *   }
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions or not the owner
 * - 404: Inventory item not found
 * - 400: Invalid request body or insufficient quantity
 * - 500: Internal server error
 */
export const POST = requireScopes(
  [SCOPES.WRITE_INVENTORY],
  async (request: NextRequest, auth, context) => {
    try {
      // Extract ID from route params
      const params = await getRouteParams(context);
      const id = params.id as string;

      if (!id) {
        return apiError('Inventory item ID is required', 400);
      }

      // Fetch item and verify ownership
      const item = await inventoryService.findById(id);
      const ownershipCheck = verifyResourceOwnership(item, auth, 'inventory item');

      if ('error' in ownershipCheck) {
        return ownershipCheck.error;
      }

      const verifiedItem = ownershipCheck.resource;

      // Parse and validate request body
      const parsed = await parseJsonBody(request, markAsUsedSchema);
      if ('error' in parsed) return parsed.error;

      const { data: validatedData } = parsed;

      // Validate quantity doesn't exceed available
      const currentQuantity = parseFloat(verifiedItem.quantity);
      if (validatedData.quantity > currentQuantity) {
        return apiError(
          `Cannot use ${validatedData.quantity} ${verifiedItem.unit}. Only ${currentQuantity} ${verifiedItem.unit} available.`,
          400
        );
      }

      // Mark item as used in service
      const result = await inventoryService.markAsUsed(
        id,
        validatedData.quantity,
        validatedData.action,
        validatedData.recipe_id,
        validatedData.notes
      );

      return apiSuccess(result);
    } catch (error) {
      console.error('Error marking inventory item as used:', error);
      return apiError('Internal server error');
    }
  }
);
