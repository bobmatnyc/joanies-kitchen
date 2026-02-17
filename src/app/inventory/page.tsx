'use client';

import { Suspense } from 'react';
import { AddInventoryItemForm } from '@/components/inventory/AddInventoryItemForm';
import { ExpiringItemsAlert } from '@/components/inventory/ExpiringItemsAlert';
import { InventoryList } from '@/components/inventory/InventoryList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Inventory Management Page
 *
 * Full inventory management interface with:
 * - Expiring items alert banner
 * - Add new inventory item form
 * - Inventory list grouped by storage location
 * - Quick actions (mark as used, delete, edit)
 */
export default function InventoryPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-jk-cream via-white to-jk-sage/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        {/* Page Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading text-jk-olive">
            My Inventory
          </h1>
          <p className="text-base sm:text-lg text-jk-charcoal/70 font-body mt-2">
            Track what's in your fridge, freezer, and pantry. Get recipe suggestions before food
            goes to waste.
          </p>
        </div>

        {/* Expiring Items Alert */}
        <Suspense fallback={null}>
          <ExpiringItemsAlert />
        </Suspense>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Add New Item Form - Left Column on Desktop */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Add New Item</CardTitle>
              </CardHeader>
              <CardContent>
                <AddInventoryItemForm />
              </CardContent>
            </Card>
          </div>

          {/* Inventory List - Right Column on Desktop */}
          <div className="lg:col-span-2">
            <Suspense
              fallback={
                <Card>
                  <CardContent className="py-12 text-center text-jk-charcoal/60">
                    Loading inventory...
                  </CardContent>
                </Card>
              }
            >
              <InventoryList />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
