import { AlertTriangle, CheckCircle, Flag } from 'lucide-react';
import { getModerationStats } from '@/app/actions/moderation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export async function ModerationStats() {
  try {
    const result = await getModerationStats();

    if (!result.success || !result.data) {
      return null;
    }

    const stats = result.data;

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Pending Review</CardTitle>
              <AlertTriangle className="w-4 h-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.totalPending}</div>
            <p className="text-xs text-gray-500 mt-1">Awaiting moderation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Approved Today</CardTitle>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approvedToday}</div>
            <p className="text-xs text-gray-500 mt-1">Recipes approved</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Rejected Today</CardTitle>
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejectedToday}</div>
            <p className="text-xs text-gray-500 mt-1">Recipes rejected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Flagged Items</CardTitle>
              <Flag className="w-4 h-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.flaggedCount}</div>
            <p className="text-xs text-gray-500 mt-1">Need review</p>
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    console.error('Failed to load moderation stats:', error);
    return null;
  }
}

export function ModerationStatsLoading() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-20 bg-gray-200 rounded animate-pulse mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
