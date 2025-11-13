'use client';

import { CheckCircle2, DollarSign, Loader2, Package } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { updateShoppingList } from '@/app/actions/meals';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import type { ShoppingList } from '@/lib/db/schema';
import {
  isValidShoppingListStatus,
  parseShoppingListItems,
  type ShoppingListItem,
} from '@/lib/meals/type-guards';
import { formatQuantity } from '@/lib/utils/quantity-formatter';
import { convertToRetailPackaging } from '@/lib/utils/retail-packaging';

interface ShoppingListViewProps {
  shoppingList: ShoppingList;
  onUpdate?: () => void;
}

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  active: { label: 'Active', color: 'bg-blue-100 text-blue-800' },
  shopping: { label: 'Shopping', color: 'bg-yellow-100 text-yellow-800' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  archived: { label: 'Archived', color: 'bg-gray-100 text-gray-600' },
};

const CATEGORY_ORDER = [
  'proteins',
  'vegetables',
  'fruits',
  'dairy',
  'grains',
  'condiments',
  'spices',
  'other',
];

const CATEGORY_LABELS: Record<string, string> = {
  proteins: 'Proteins',
  vegetables: 'Vegetables',
  fruits: 'Fruits',
  dairy: 'Dairy',
  grains: 'Grains & Breads',
  condiments: 'Condiments & Oils',
  spices: 'Spices & Herbs',
  other: 'Other Items',
};

const CATEGORY_ICONS: Record<string, string> = {
  proteins: '🥩',
  vegetables: '🥬',
  fruits: '🍎',
  dairy: '🥛',
  grains: '🌾',
  condiments: '🧂',
  spices: '🌿',
  other: '📦',
};

export function ShoppingListView({ shoppingList, onUpdate }: ShoppingListViewProps) {
  const router = useRouter();
  const [items, setItems] = useState<ShoppingListItem[]>(() => {
    try {
      return parseShoppingListItems(shoppingList.items as string);
    } catch (error) {
      console.error('Failed to parse shopping list items:', error);
      toast.error('Failed to load shopping list items');
      return [];
    }
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const statusConfig = STATUS_CONFIG[shoppingList.status] || STATUS_CONFIG.draft;

  // Group items by category (memoized to avoid recalculation on every render)
  const itemsByCategory = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const category = item.category || 'other';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(item);
        return acc;
      },
      {} as Record<string, ShoppingListItem[]>
    );
  }, [items]);

  // Calculate totals (memoized)
  const totalItems = items.length;
  const checkedItems = useMemo(() => items.filter((item) => item.checked).length, [items]);
  const progress = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0;
  const estimatedTotal = useMemo(
    () => items.reduce((sum, item) => sum + (item.estimated_price || 0), 0),
    [items]
  );

  const saveItems = useCallback(
    async (updatedItems: ShoppingListItem[]) => {
      setIsUpdating(true);
      const result = await updateShoppingList(shoppingList.id, {
        items: JSON.stringify(updatedItems),
      });

      if (result.success) {
        onUpdate?.();
      } else {
        toast.error('Failed to update shopping list');
      }
      setIsUpdating(false);
    },
    [shoppingList.id, onUpdate]
  );

  const handleToggleItem = useCallback(
    async (index: number) => {
      const updatedItems = [...items];
      updatedItems[index].checked = !updatedItems[index].checked;
      setItems(updatedItems);

      // Save to database
      await saveItems(updatedItems);
    },
    [items, saveItems]
  );

  const handleMarkAllCompleted = useCallback(async () => {
    setIsMarkingAll(true);
    const updatedItems = items.map((item) => ({ ...item, checked: true }));
    setItems(updatedItems);
    await saveItems(updatedItems);
    setIsMarkingAll(false);
    toast.success('All items marked as completed');
  }, [items, saveItems]);

  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      // Validate status before updating
      if (!isValidShoppingListStatus(newStatus)) {
        toast.error(`Invalid shopping list status: ${newStatus}`);
        return;
      }

      setIsUpdating(true);
      const result = await updateShoppingList(shoppingList.id, {
        status: newStatus,
      });

      if (result.success) {
        toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label}`);
        onUpdate?.();
        router.refresh();
      } else {
        toast.error('Failed to update status');
      }
      setIsUpdating(false);
    },
    [shoppingList.id, onUpdate, router]
  );

  return (
    <Card className="border-jk-sage">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 space-y-2">
            <CardTitle className="font-heading text-jk-olive text-2xl">
              {shoppingList.name}
            </CardTitle>
            {shoppingList.notes && (
              <p className="text-sm text-jk-charcoal/70 font-body">{shoppingList.notes}</p>
            )}
          </div>
          <Badge variant="outline" className={`${statusConfig.color} font-ui`}>
            {statusConfig.label}
          </Badge>
        </div>

        {/* Progress bar */}
        <div className="space-y-2 pt-4">
          <div className="flex items-center justify-between text-sm font-ui">
            <span className="text-jk-charcoal/70">
              {checkedItems} of {totalItems} items
            </span>
            <span className="text-jk-olive font-semibold">{progress.toFixed(0)}%</span>
          </div>
          <div className="w-full h-2 bg-jk-sage/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-jk-sage transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Total estimate */}
        {estimatedTotal > 0 && (
          <div className="flex items-center gap-2 pt-2 text-jk-charcoal/70">
            <DollarSign className="w-4 h-4 text-jk-clay" />
            <span className="font-ui text-sm">
              Estimated Total: <span className="font-semibold">${estimatedTotal.toFixed(2)}</span>
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleMarkAllCompleted}
            disabled={isMarkingAll || checkedItems === totalItems}
            className="min-h-[44px] touch-manipulation border-jk-sage text-jk-olive hover:bg-jk-sage/10 font-ui"
          >
            {isMarkingAll ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Marking...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Mark All Completed
              </>
            )}
          </Button>

          {shoppingList.status !== 'completed' && (
            <Button
              variant="outline"
              onClick={() => handleStatusChange('completed')}
              disabled={isUpdating}
              className="min-h-[44px] touch-manipulation border-jk-clay text-jk-clay hover:bg-jk-clay/10 font-ui"
            >
              Complete Shopping
            </Button>
          )}
        </div>

        {/* Shopping list items by category */}
        <div className="space-y-6">
          {CATEGORY_ORDER.map((category) => {
            const categoryItems = itemsByCategory[category];
            if (!categoryItems || categoryItems.length === 0) return null;

            const categoryChecked = categoryItems.filter((item) => item.checked).length;
            const categoryTotal = categoryItems.length;

            return (
              <div key={category} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-lg text-jk-olive flex items-center gap-2">
                    <span>{CATEGORY_ICONS[category]}</span>
                    {CATEGORY_LABELS[category]}
                  </h3>
                  <span className="text-xs text-jk-charcoal/60 font-ui">
                    {categoryChecked}/{categoryTotal}
                  </span>
                </div>

                <div className="space-y-2">
                  {categoryItems.map((item, _itemIndex) => {
                    const globalIndex = items.indexOf(item);
                    return (
                      <label
                        key={globalIndex}
                        className={`flex items-start gap-2 p-2 rounded-jk border border-jk-sage/30 hover:border-jk-sage/60 transition-colors cursor-pointer min-h-[44px] ${
                          item.checked ? 'bg-jk-sage/5' : 'bg-white'
                        }`}
                      >
                        <Checkbox
                          checked={item.checked}
                          onCheckedChange={() => handleToggleItem(globalIndex)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div
                            className={`font-body ${
                              item.checked ? 'line-through text-jk-charcoal/50' : 'text-jk-charcoal'
                            }`}
                          >
                            {item.isToTaste ? (
                              <>
                                <span className="font-semibold">{item.name}</span>
                                <span className="text-jk-charcoal/60 text-sm ml-1">(to taste)</span>
                              </>
                            ) : (() => {
                                const retailPackage = item.quantity > 0 ? convertToRetailPackaging(item.name, item.quantity, item.unit) : null;

                                if (retailPackage) {
                                  return (
                                    <>
                                      <span className="font-semibold">
                                        {retailPackage.quantity} {retailPackage.unit}{retailPackage.quantity > 1 ? 's' : ''}{' '}
                                      </span>
                                      {item.name}
                                      <span className="text-jk-charcoal/60 text-sm ml-1">
                                        (need {formatQuantity(retailPackage.originalQuantity)} {retailPackage.originalUnit})
                                      </span>
                                    </>
                                  );
                                }

                                return (
                                  <>
                                    {item.quantity > 0 && (
                                      <span className="font-semibold">
                                        {formatQuantity(item.quantity)} {item.unit}{' '}
                                      </span>
                                    )}
                                    {item.name}
                                  </>
                                );
                              })()}
                          </div>
                          {item.estimated_price && (
                            <div className="text-xs text-jk-charcoal/60 mt-1 font-ui">
                              ${item.estimated_price.toFixed(2)}
                            </div>
                          )}
                          {item.notes && (
                            <div className="text-xs text-jk-charcoal/60 mt-1 italic font-body">
                              {item.notes}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {totalItems === 0 && (
          <div className="text-center py-12 text-jk-charcoal/60">
            <Package className="w-12 h-12 mx-auto mb-4 text-jk-sage" />
            <p className="font-body">No items in shopping list</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
