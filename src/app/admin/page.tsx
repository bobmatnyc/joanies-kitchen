import { Suspense } from 'react';
import { StatsCard } from '@/components/admin/StatsCard';
import { getAdminRecipeStats, getRecentRecipeActivity } from '@/app/actions/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { SlideshowManager } from '@/components/admin/SlideshowManager';
import { HeroBackgroundManager } from '@/components/admin/HeroBackgroundManager';

function StatsLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
  );
}

async function DashboardStats() {
  const statsResult = await getAdminRecipeStats();

  if (!statsResult.success || !statsResult.data) {
    return (
      <div className="text-center py-12 text-red-600">
        Failed to load statistics
      </div>
    );
  }

  const stats = statsResult.data;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatsCard
        title="Total Recipes"
        value={stats.totalRecipes}
        description="All recipes in the database"
        icon={
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
        }
      />

      <StatsCard
        title="Public Recipes"
        value={stats.publicRecipes}
        description="Visible to all users"
        icon={
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        }
      />

      <StatsCard
        title="System Recipes"
        value={stats.systemRecipes}
        description="Curated system recipes"
        icon={
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
            />
          </svg>
        }
      />

      <StatsCard
        title="Active Users"
        value={stats.totalUsers}
        description="Users with recipes"
        icon={
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        }
      />
    </div>
  );
}

async function RecentActivity() {
  const activityResult = await getRecentRecipeActivity(10);

  if (!activityResult.success || !activityResult.data) {
    return (
      <div className="text-center py-8 text-gray-500">
        Failed to load recent activity
      </div>
    );
  }

  const recentRecipes = activityResult.data;

  return (
    <div className="space-y-4">
      {recentRecipes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No recent activity
        </div>
      ) : (
        recentRecipes.map((recipe) => (
          <div
            key={recipe.id}
            className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex-1">
              <Link
                href={`/recipes/${recipe.id}`}
                className="font-medium text-gray-900 hover:text-blue-600"
              >
                {recipe.name}
              </Link>
              <div className="flex gap-2 mt-1">
                {recipe.is_public && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    Public
                  </span>
                )}
                {recipe.is_system_recipe && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    System
                  </span>
                )}
                {recipe.is_ai_generated && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                    AI Generated
                  </span>
                )}
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {new Date(recipe.created_at).toLocaleDateString()}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Manage recipes, users, and system settings
        </p>
      </div>

      {/* Statistics Cards */}
      <Suspense fallback={<StatsLoadingSkeleton />}>
        <DashboardStats />
      </Suspense>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button asChild className="w-full">
              <Link href="/admin/recipes">Manage Recipes</Link>
            </Button>
            <Button asChild className="w-full bg-green-600 hover:bg-green-700">
              <Link href="/admin/crawl">Crawl Web for Recipes</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/shared">View Public Recipes</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/recipes/new">Create Recipe</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Recipes</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <div className="text-center py-8 text-gray-500">
                Loading recent activity...
              </div>
            }
          >
            <RecentActivity />
          </Suspense>
        </CardContent>
      </Card>

      {/* Hero Background Management */}
      <Card>
        <CardHeader>
          <CardTitle>Hero Background Images</CardTitle>
        </CardHeader>
        <CardContent>
          <HeroBackgroundManager />
        </CardContent>
      </Card>

      {/* Slideshow Management */}
      <Card>
        <CardHeader>
          <CardTitle>Photo Gallery</CardTitle>
        </CardHeader>
        <CardContent>
          <SlideshowManager />
        </CardContent>
      </Card>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Database Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Status</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Healthy
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Last Backup</span>
                <span className="text-sm font-medium">Automatic</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Environment</span>
                <span className="text-sm font-medium">
                  {process.env.NODE_ENV || 'development'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Auth Provider</span>
                <span className="text-sm font-medium">Clerk</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
