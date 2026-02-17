'use client';

import { AlertCircle, Calendar, CheckCircle, Edit2, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { deleteInventoryItem, markItemAsUsed, updateInventoryItem } from '@/app/actions/inventory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { InventoryStatus } from '@/lib/db/inventory-schema';

// Helper type for inventory item with ingredient details
type InventoryItemWithIngredient = {
  id: string;
  ingredient_id: string;
  storage_location: 'fridge' | 'freezer' | 'pantry' | 'other';
  status: InventoryStatus;
  quantity: string;
  unit: string;
  expiry_date: Date | null;
  notes: string | null;
  ingredient: {
    id: string;
    name: string;
    display_name: string;
    category: string | null;
  };
};

interface InventoryItemCardProps {
  item: InventoryItemWithIngredient;
  onUpdate?: () => void;
}

/**
 * InventoryItemCard Component
 *
 * Individual inventory item display with:
 * - Status badge with color coding
 * - Quantity and unit display
 * - Days until expiry calculation
 * - Inline quantity editing
 * - Mark as Used button
 * - Delete button with confirmation
 */
export function InventoryItemCard({ item, onUpdate }: InventoryItemCardProps) {
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [editQuantity, setEditQuantity] = useState(item.quantity);
  const [loading, setLoading] = useState(false);

  // Calculate days until expiry
  const daysUntilExpiry = item.expiry_date
    ? Math.floor((new Date(item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // Get status badge color and label
  const getStatusBadge = (status: InventoryStatus) => {
    switch (status) {
      case 'fresh':
        return { label: 'Fresh', className: 'bg-green-100 text-green-800 border-green-200' };
      case 'use_soon':
        return {
          label: 'Use Soon',
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        };
      case 'expiring':
        return { label: 'Expiring', className: 'bg-orange-100 text-orange-800 border-orange-200' };
      case 'expired':
        return { label: 'Expired', className: 'bg-red-100 text-red-800 border-red-200' };
      case 'used':
        return { label: 'Used', className: 'bg-gray-100 text-gray-800 border-gray-200' };
      case 'wasted':
        return { label: 'Wasted', className: 'bg-gray-100 text-gray-800 border-gray-200' };
      default:
        return { label: status, className: 'bg-gray-100 text-gray-800 border-gray-200' };
    }
  };

  const statusBadge = getStatusBadge(item.status);

  // Handle quantity update
  const handleUpdateQuantity = async () => {
    if (editQuantity === item.quantity) {
      setEditing(false);
      return;
    }

    setLoading(true);
    try {
      const result = await updateInventoryItem(item.id, {
        quantity: parseFloat(editQuantity),
      });

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Quantity updated.',
        });
        setEditing(false);
        onUpdate?.();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update quantity.',
          variant: 'destructive',
        });
        setEditQuantity(item.quantity);
      }
    } catch (error) {
      console.error('Update failed:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
      setEditQuantity(item.quantity);
    } finally {
      setLoading(false);
    }
  };

  // Handle mark as used
  const handleMarkAsUsed = async () => {
    setLoading(true);
    try {
      const quantityUsed = parseFloat(item.quantity);
      const result = await markItemAsUsed(item.id, quantityUsed, 'cooked');

      if (result.success) {
        toast({
          title: 'Success',
          description: `Marked ${item.ingredient.display_name} as used.`,
        });
        onUpdate?.();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to mark as used.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Mark as used failed:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!confirm(`Delete ${item.ingredient.display_name}?`)) {
      return;
    }

    setLoading(true);
    try {
      const result = await deleteInventoryItem(item.id);

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Item deleted from inventory.',
        });
        onUpdate?.();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to delete item.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Delete failed:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="relative">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header: Name and Status */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-heading text-lg text-jk-olive truncate">
                {item.ingredient.display_name}
              </h3>
              {item.ingredient.category && (
                <p className="text-xs text-jk-charcoal/60 capitalize">{item.ingredient.category}</p>
              )}
            </div>
            <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
          </div>

          {/* Quantity */}
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  className="w-24 h-8"
                  disabled={loading}
                />
                <span className="text-sm text-jk-charcoal/70">{item.unit}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleUpdateQuantity}
                  disabled={loading}
                  className="h-8 px-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  )}
                </Button>
              </>
            ) : (
              <>
                <span className="text-2xl font-bold text-jk-clay">{item.quantity}</span>
                <span className="text-sm text-jk-charcoal/70">{item.unit}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(true)}
                  disabled={loading}
                  className="h-8 px-2 ml-auto"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>

          {/* Expiry Date */}
          {item.expiry_date && (
            <div
              className={`flex items-center gap-2 text-sm ${
                daysUntilExpiry !== null && daysUntilExpiry < 0
                  ? 'text-red-600'
                  : daysUntilExpiry !== null && daysUntilExpiry <= 3
                    ? 'text-orange-600'
                    : 'text-jk-charcoal/70'
              }`}
            >
              <Calendar className="w-4 h-4" />
              {daysUntilExpiry !== null && daysUntilExpiry < 0 ? (
                <span className="font-medium">
                  Expired {Math.abs(daysUntilExpiry)} {Math.abs(daysUntilExpiry) === 1 ? 'day' : 'days'}{' '}
                  ago
                </span>
              ) : daysUntilExpiry !== null && daysUntilExpiry === 0 ? (
                <span className="font-medium">Expires today</span>
              ) : daysUntilExpiry !== null && daysUntilExpiry <= 3 ? (
                <span className="font-medium">
                  Expires in {daysUntilExpiry} {daysUntilExpiry === 1 ? 'day' : 'days'}
                </span>
              ) : (
                <span>Expires {new Date(item.expiry_date).toLocaleDateString()}</span>
              )}
            </div>
          )}

          {/* Notes */}
          {item.notes && (
            <div className="flex items-start gap-2 text-sm text-jk-charcoal/60">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="line-clamp-2">{item.notes}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-jk-sage/20">
            <Button
              size="sm"
              onClick={handleMarkAsUsed}
              disabled={loading || item.status === 'used' || item.status === 'wasted'}
              className="flex-1 bg-jk-sage hover:bg-jk-sage/90 text-white gap-1"
            >
              <CheckCircle className="w-4 h-4" />
              Mark as Used
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
              className="gap-1"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
