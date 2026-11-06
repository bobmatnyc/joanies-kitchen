/**
 * #270: the hidden-reviews section of /admin/flags, beside the hidden-comments one.
 *
 * Why: the page must show how many rating reviews are hidden and reach each one,
 * whatever the report tabs show. It sits outside the tabs and reads no report rows.
 * What: server component; renders the total and one page of `getHiddenReviews`
 * with Previous and Next links carried in the `hiddenReviewsPage` query parameter.
 * Test: `src/components/admin/__tests__/hidden-reviews-panel.test.tsx`
 */

import { EyeOff } from 'lucide-react';
import Link from 'next/link';
import { getHiddenReviews, type HiddenReviewsPage } from '@/app/actions/hidden-reviews';
import { HiddenReviewList } from '@/components/admin/HiddenReviewList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HIDDEN_REVIEWS_PAGE_SIZE } from '@/lib/review-moderation';

function PageLink({ page, label }: { page: number; label: string }) {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={`/admin/flags?hiddenReviewsPage=${page}`} scroll={false}>
        {label}
      </Link>
    </Button>
  );
}

function Pagination({ result }: { result: HiddenReviewsPage }) {
  const first = (result.page - 1) * HIDDEN_REVIEWS_PAGE_SIZE + 1;
  const last = first + result.reviews.length - 1;
  return (
    <div className="flex items-center justify-between gap-4 mt-4">
      <p className="text-sm text-gray-500">
        Showing {first}-{last} of {result.total}
      </p>
      <div className="flex gap-2">
        {result.page > 1 && <PageLink page={result.page - 1} label="Previous" />}
        {result.page < result.pageCount && <PageLink page={result.page + 1} label="Next" />}
      </div>
    </div>
  );
}

export async function HiddenReviewsPanel({ page }: { page: number }) {
  let result: HiddenReviewsPage;
  try {
    result = await getHiddenReviews(page);
  } catch (error: unknown) {
    console.error('Failed to load hidden reviews:', error);
    return (
      <Card>
        <CardContent className="py-6 text-center text-red-600">
          Failed to load hidden reviews
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <EyeOff className="w-5 h-5 text-orange-500" />
          Hidden reviews ({result.total})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {result.total === 0 ? (
          <p className="text-gray-500">No reviews are hidden.</p>
        ) : (
          <>
            <HiddenReviewList reviews={result.reviews} />
            <Pagination result={result} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
