/**
 * Admin Recipe Moderation Queue
 *
 * Interface for admins to review, approve, or reject user-submitted recipes
 */

// Force dynamic rendering for admin pages (requires authentication headers)
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { getRecipesByStatus } from '@/app/actions/moderation';
import { ModerationStats, ModerationStatsLoading } from '@/components/admin/ModerationStats';
import { RecipeQueue } from '@/components/admin/RecipeQueue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="h-3 w-full bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-2/3 bg-gray-200 rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function RecipeQueueContent({
  status,
}: {
  status?: 'pending' | 'approved' | 'rejected' | 'flagged';
}) {
  try {
    const result = status
      ? await getRecipesByStatus(status, 50)
      : await getRecipesByStatus('pending', 50);

    if (!result.success || !result.data) {
      return (
        <div className="text-center py-12 text-red-600">
          <p>Failed to load recipes</p>
          <p className="text-sm text-gray-500 mt-2">{result.error}</p>
        </div>
      );
    }

    return <RecipeQueue recipes={result.data} />;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return (
      <div className="text-center py-12 text-red-600">
        <p>Failed to load recipes</p>
        <p className="text-sm text-gray-500 mt-2">{errorMessage}</p>
      </div>
    );
  }
}

export default function RecipeModerationPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Recipe Moderation</h1>
        <p className="text-gray-600 mt-2">Review and moderate user-submitted recipes</p>
      </div>

      {/* Stats Overview */}
      <Suspense fallback={<ModerationStatsLoading />}>
        <ModerationStats />
      </Suspense>

      {/* Recipe Queue with Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Recipe Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="flagged">Flagged</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-6">
              <Suspense fallback={<LoadingSkeleton />}>
                <RecipeQueueContent status="pending" />
              </Suspense>
            </TabsContent>

            <TabsContent value="approved" className="mt-6">
              <Suspense fallback={<LoadingSkeleton />}>
                <RecipeQueueContent status="approved" />
              </Suspense>
            </TabsContent>

            <TabsContent value="rejected" className="mt-6">
              <Suspense fallback={<LoadingSkeleton />}>
                <RecipeQueueContent status="rejected" />
              </Suspense>
            </TabsContent>

            <TabsContent value="flagged" className="mt-6">
              <Suspense fallback={<LoadingSkeleton />}>
                <RecipeQueueContent status="flagged" />
              </Suspense>
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <Suspense fallback={<LoadingSkeleton />}>
                <RecipeQueueContent status="approved" />
              </Suspense>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
