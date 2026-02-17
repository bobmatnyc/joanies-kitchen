/**
 * REST API v1 - Inventory Item Endpoints
 *
 * GET    /api/v1/inventory/:id - Get inventory item by ID
 * PATCH  /api/v1/inventory/:id - Update inventory item
 * DELETE /api/v1/inventory/:id - Remove item from inventory
 *
 * Authentication: Requires Clerk session or API key
 * Authorization: Scope-based permissions + ownership verification
 */

import type { NextRequest } from 'next/server';
import {
  apiError,
  apiNotFound,
  apiSuccess,
  getRouteParams,
  parseJsonBody,
  verifyResourceOwnership,
} from '@/lib/api';
import { requireScopes, SCOPES } from '@/lib/api-auth';
import { inventoryService } from '@/lib/services/inventory-service';
import { updateInventoryItemSchema } from '@/lib/validations/inventory-api';

/**
 * GET /api/v1/inventory/:id
 *
 * Get a specific inventory item by ID
 *
 * Response:
 * {
 *   success: true,
 *   data: InventoryItem
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions or not the owner
 * - 404: Inventory item not found
 * - 500: Internal server error
 */
export const GET = requireScopes(
  [SCOPES.READ_INVENTORY],
  async (request: NextRequest, auth, context) => {
    try {
      // Extract ID from route params
      const params = await getRouteParams(context);
      const id = params.id as string;

      if (!id) {
        return apiError('Inventory item ID is required', 400);
      }

      // Fetch inventory item and verify ownership
      const item = await inventoryService.findById(id);
      const ownershipCheck = verifyResourceOwnership(item, auth, 'inventory item');

      if ('error' in ownershipCheck) {
        return ownershipCheck.error;
      }

      return apiSuccess(ownershipCheck.resource);
    } catch (error) {
      console.error('Error fetching inventory item:', error);
      return apiError('Internal server error');
    }
  }
);

/**
 * PATCH /api/v1/inventory/:id
 *
 * Update an inventory item
 * Only the owner can update
 *
 * Request Body (all optional):
 * {
 *   storage_location?: 'fridge' | 'freezer' | 'pantry' | 'other',
 *   quantity?: number,
 *   unit?: string,
 *   expiry_date?: Date,
 *   cost_usd?: number,
 *   notes?: string,
 *   status?: InventoryStatus
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: InventoryItem
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions or not the owner
 * - 404: Inventory item not found
 * - 400: Invalid request body
 * - 500: Internal server error
 */
export const PATCH = requireScopes(
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

      // Parse and validate request body
      const parsed = await parseJsonBody(request, updateInventoryItemSchema);
      if ('error' in parsed) return parsed.error;

      const { data: validatedData } = parsed;

      // Transform numeric fields to strings for database compatibility
      const updateData = {
        ...validatedData,
        quantity: validatedData.quantity?.toString(),
        cost_usd: validatedData.cost_usd?.toString(),
      };

      // Update inventory item
      const updatedItem = await inventoryService.update(id, updateData);

      if (!updatedItem) {
        return apiError('Failed to update inventory item', 500);
      }

      return apiSuccess(updatedItem);
    } catch (error) {
      console.error('Error updating inventory item:', error);
      return apiError('Internal server error');
    }
  }
);

/**
 * DELETE /api/v1/inventory/:id
 *
 * Remove an item from inventory
 * Only the owner can delete
 *
 * Response:
 * {
 *   success: true,
 *   data: { deleted: true }
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: Insufficient permissions or not the owner
 * - 404: Inventory item not found
 * - 500: Internal server error
 */
export const DELETE = requireScopes(
  [SCOPES.DELETE_INVENTORY],
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

      // Delete inventory item
      const deleted = await inventoryService.delete(id);

      if (!deleted) {
        return apiError('Failed to delete inventory item', 500);
      }

      return apiSuccess({ deleted: true });
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      return apiError('Internal server error');
    }
  }
);
