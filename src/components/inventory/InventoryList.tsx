'use client';

import { Package, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getUserInventory } from '@/app/actions/inventory';
import { InventoryItemCard } from '@/components/inventory/InventoryItemCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { InventoryStatus, StorageLocation } from '@/lib/db/inventory-schema';

// Helper type for inventory item with ingredient details
type InventoryItemWithIngredient = {
  id: string;
  ingredient_id: string;
  storage_location: StorageLocation;
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

/**
 * InventoryList Component
 *
 * Displays user's inventory grouped by storage location
 * Features:
 * - Group by storage location (fridge, freezer, pantry, other)
 * - Filter by storage location or status
 * - Sort by expiry date or name
 * - Empty state with helpful message
 * - Refresh button
 */
export function InventoryList() {
  const [items, setItems] = useState<InventoryItemWithIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [storageFilter, setStorageFilter] = useState<StorageLocation | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'expiry' | 'name'>('expiry');

  // Fetch inventory
  const fetchInventory = async () => {
    try {
      setError(null);
      const result = await getUserInventory();

      if (result.success && 'data' in result && result.data) {
        setItems(result.data as any);
      } else if ('error' in result) {
        setError(result.error || 'Failed to load inventory');
      }
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchInventory();
  };

  // Apply filters and sorting
  const filteredItems = items
    .filter((item) => {
      if (storageFilter !== 'all' && item.storage_location !== storageFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'expiry') {
        // Sort by expiry date (null dates go last)
        if (!a.expiry_date && !b.expiry_date) return 0;
        if (!a.expiry_date) return 1;
        if (!b.expiry_date) return -1;
        return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
      } else {
        // Sort by name
        return a.ingredient.display_name.localeCompare(b.ingredient.display_name);
      }
    });

  // Group by storage location
  const groupedItems: Record<StorageLocation, InventoryItemWithIngredient[]> = {
    fridge: filteredItems.filter((item) => item.storage_location === 'fridge'),
    freezer: filteredItems.filter((item) => item.storage_location === 'freezer'),
    pantry: filteredItems.filter((item) => item.storage_location === 'pantry'),
    other: filteredItems.filter((item) => item.storage_location === 'other'),
  };

  const storageLocationLabels: Record<StorageLocation, string> = {
    fridge: 'Fridge',
    freezer: 'Freezer',
    pantry: 'Pantry',
    other: 'Other',
  };

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-jk-charcoal/60">Loading inventory...</CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <Package className="w-12 h-12 text-jk-charcoal/40 mx-auto" />
          <div>
            <h3 className="text-lg font-heading text-jk-olive">Your inventory is empty</h3>
            <p className="text-sm text-jk-charcoal/60 mt-2">
              Add items to start tracking your food and get recipe suggestions.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters and Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Storage Filter */}
            <div className="flex-1">
              <Select
                value={storageFilter}
                onValueChange={(v: any) => setStorageFilter(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  <SelectItem value="fridge">Fridge</SelectItem>
                  <SelectItem value="freezer">Freezer</SelectItem>
                  <SelectItem value="pantry">Pantry</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="flex-1">
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="fresh">Fresh</SelectItem>
                  <SelectItem value="use_soon">Use Soon</SelectItem>
                  <SelectItem value="expiring">Expiring</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort By */}
            <div className="flex-1">
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expiry">Sort by Expiry</SelectItem>
                  <SelectItem value="name">Sort by Name</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              className="shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grouped Inventory Items */}
      {(Object.entries(groupedItems) as [StorageLocation, InventoryItemWithIngredient[]][]).map(
        ([location, locationItems]) => {
          if (locationItems.length === 0) return null;

          return (
            <Card key={location}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{storageLocationLabels[location]}</span>
                  <span className="text-sm font-normal text-jk-charcoal/60">
                    {locationItems.length} {locationItems.length === 1 ? 'item' : 'items'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {locationItems.map((item) => (
                    <InventoryItemCard key={item.id} item={item} onUpdate={handleRefresh} />
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        }
      )}

      {/* No Results After Filtering */}
      {filteredItems.length === 0 && items.length > 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-jk-charcoal/60">No items match your current filters.</p>
            <Button
              onClick={() => {
                setStorageFilter('all');
                setStatusFilter('all');
              }}
              variant="outline"
              className="mt-4"
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
