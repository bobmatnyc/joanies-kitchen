import Link from 'next/link';
import { UndoDeletionForm } from './UndoDeletionForm';

/**
 * Why: #103 — a user with a pending deletion is refused sign-in and sent here
 * with a short-lived signed token to undo it. The server action checks the
 * token; this page does not.
 * What: shows the undo button when a token is present; otherwise points back
 * to sign-in. `no-referrer` keeps the token out of outgoing Referer headers.
 */
export const metadata = {
  title: "Undo account deletion - Joanie's Kitchen",
  referrer: 'no-referrer' as const,
  robots: { index: false, follow: false },
};

export default async function UndoDeletionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Your account is scheduled for deletion
          </h1>
          <p className="text-gray-600">
            Until you undo the deletion, you cannot sign in, and your profile, recipes and comments
            stay hidden.
          </p>
          {token ? (
            <UndoDeletionForm token={token} />
          ) : (
            <p className="text-gray-700">
              To undo the deletion, <Link href="/sign-in">sign in with Google</Link> again.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
