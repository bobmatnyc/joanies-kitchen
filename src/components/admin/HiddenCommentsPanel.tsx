/**
 * #59: the hidden-comments section of /admin/flags.
 *
 * Why: the page must show how many comments are hidden and reach each one,
 * whatever the report tabs show. It sits outside the tabs and reads no report rows.
 * What: server component; renders the total and one page of `getHiddenComments`
 * with Previous and Next links carried in the `hiddenPage` query parameter.
 * Test: `src/components/admin/__tests__/hidden-comments-panel.test.tsx`
 */

import { EyeOff } from 'lucide-react';
import Link from 'next/link';
import { getHiddenComments, type HiddenCommentsPage } from '@/app/actions/hidden-comments';
import { HiddenCommentList } from '@/components/admin/HiddenCommentList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HIDDEN_COMMENTS_PAGE_SIZE } from '@/lib/comment-moderation';

function PageLink({ page, label }: { page: number; label: string }) {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={`/admin/flags?hiddenPage=${page}`} scroll={false}>
        {label}
      </Link>
    </Button>
  );
}

function Pagination({ result }: { result: HiddenCommentsPage }) {
  const first = (result.page - 1) * HIDDEN_COMMENTS_PAGE_SIZE + 1;
  const last = first + result.comments.length - 1;
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

export async function HiddenCommentsPanel({ page }: { page: number }) {
  let result: HiddenCommentsPage;
  try {
    result = await getHiddenComments(page);
  } catch (error: unknown) {
    console.error('Failed to load hidden comments:', error);
    return (
      <Card>
        <CardContent className="py-6 text-center text-red-600">
          Failed to load hidden comments
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <EyeOff className="w-5 h-5 text-orange-500" />
          Hidden comments ({result.total})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {result.total === 0 ? (
          <p className="text-gray-500">No comments are hidden.</p>
        ) : (
          <>
            <HiddenCommentList comments={result.comments} />
            <Pagination result={result} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
