/**
 * Admin Flags Dashboard
 *
 * Displays and manages all recipe content flags:
 * - View all pending flags
 * - Filter by status
 * - Review and take action on flags
 * - View flag details and history
 */

// Force dynamic rendering for admin pages (requires authentication headers)
export const dynamic = 'force-dynamic';

import { AlertTriangle, CheckCircle, Flag, XCircle } from 'lucide-react';
import { Suspense } from 'react';
import { getAllFlags } from '@/app/actions/flag-recipe';
import { FlagList } from '@/components/admin/FlagList';
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

async function FlagStats() {
  try {
    const allFlags = await getAllFlags(undefined, 1000);

    const pending = allFlags.filter((f) => f.status === 'pending').length;
    const reviewed = allFlags.filter((f) => f.status === 'reviewed').length;
    const resolved = allFlags.filter((f) => f.status === 'resolved').length;
    const dismissed = allFlags.filter((f) => f.status === 'dismissed').length;

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
              <AlertTriangle className="w-4 h-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Under Review</CardTitle>
              <Flag className="w-4 h-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{reviewed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Resolved</CardTitle>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{resolved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Dismissed</CardTitle>
              <XCircle className="w-4 h-4 text-gray-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{dismissed}</div>
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    console.error('Failed to load flag stats:', error);
    return null;
  }
}

async function FlagsContent({
  status,
}: {
  status?: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
}) {
  try {
    const flags = await getAllFlags(status, 100);

    if (flags.length === 0) {
      return (
        <div className="text-center py-12">
          <Flag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">{status ? `No ${status} flags found` : 'No flags found'}</p>
        </div>
      );
    }

    return <FlagList flags={flags} />;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return (
      <div className="text-center py-12 text-red-600">
        <p>Failed to load flags</p>
        <p className="text-sm text-gray-500 mt-2">{message}</p>
      </div>
    );
  }
}

export default function AdminFlagsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Content Moderation</h1>
        <p className="text-gray-600 mt-2">Review and manage flagged recipes</p>
      </div>

      {/* Stats Overview */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        }
      >
        <FlagStats />
      </Suspense>

      {/* Flags List with Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Flagged Content</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="reviewed">Under Review</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
              <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
              <Suspense fallback={<LoadingSkeleton />}>
                <FlagsContent />
              </Suspense>
            </TabsContent>

            <TabsContent value="pending" className="mt-6">
              <Suspense fallback={<LoadingSkeleton />}>
                <FlagsContent status="pending" />
              </Suspense>
            </TabsContent>

            <TabsContent value="reviewed" className="mt-6">
              <Suspense fallback={<LoadingSkeleton />}>
                <FlagsContent status="reviewed" />
              </Suspense>
            </TabsContent>

            <TabsContent value="resolved" className="mt-6">
              <Suspense fallback={<LoadingSkeleton />}>
                <FlagsContent status="resolved" />
              </Suspense>
            </TabsContent>

            <TabsContent value="dismissed" className="mt-6">
              <Suspense fallback={<LoadingSkeleton />}>
                <FlagsContent status="dismissed" />
              </Suspense>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
