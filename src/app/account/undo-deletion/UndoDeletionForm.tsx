'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import type { AccountDeletionResult } from '@/app/actions/account-deletion';
import { undoAccountDeletion } from '@/app/actions/account-deletion';

/** #103: submits the signed undo token from the blocked sign-in. */
export function UndoDeletionForm({ token }: { token: string }) {
  const [result, setResult] = useState<AccountDeletionResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (result?.success) {
    return (
      <p className="text-gray-700">
        Your account is restored. <Link href="/sign-in">Sign in</Link> to continue.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await undoAccountDeletion(token)))}
        className="rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {pending ? 'Restoring…' : 'Undo deletion'}
      </button>
      {result?.error && (
        <p role="alert" className="text-red-700">
          {result.error}
        </p>
      )}
    </div>
  );
}
