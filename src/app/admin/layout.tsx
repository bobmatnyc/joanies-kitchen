import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Server-side auth check
  const { sessionClaims } = await auth();

  // Redirect non-admin users to homepage
  const metadata = sessionClaims?.metadata as { isAdmin?: string } | undefined;
  if (metadata?.isAdmin !== 'true') {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Navigation Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link href="/admin" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">A</span>
                </div>
                <span className="text-xl font-bold text-gray-900">Admin Dashboard</span>
              </Link>

              <nav className="hidden md:flex space-x-4">
                <Link
                  href="/admin"
                  className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Overview
                </Link>
                <Link
                  href="/admin/recipes"
                  className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Recipes
                </Link>
                <Link
                  href="/admin/ingest-recipe"
                  className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Ingest Recipe
                </Link>
                <Link
                  href="/admin/flags"
                  className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Flags
                </Link>
                <Link
                  href="/admin/crawl"
                  className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Crawl Recipes
                </Link>
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Back to Site
              </Link>
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </div>
      </header>

      {/* Admin Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
