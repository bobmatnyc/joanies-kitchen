'use client';

import { signOut } from 'next-auth/react';
import { useState, useTransition } from 'react';
import { requestAccountDeletion } from '@/app/actions/account-deletion';

/**
 * Why: #103 lets a user request deletion of their own account from settings.
 * What: the user picks what happens to public recipes (delete is the default)
 * and types their account email to confirm; the server re-checks both. On
 * success the user is signed out.
 * Test: `src/lib/account-deletion/__tests__/account-deletion.test.ts`
 */
export function DeleteAccountSection() {
  const [keepRecipes, setKeepRecipes] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestAccountDeletion({ confirmEmail, keepRecipes });
      if (!result.success) {
        setError(result.error ?? 'Deletion failed. Nothing was changed.');
        return;
      }
      await signOut({ callbackUrl: '/' });
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-gray-600">
        Your profile, recipes and comments are hidden at once. You can undo this for 30 days by
        signing in again with Google. After 30 days the account is removed.
      </p>
      <fieldset className="space-y-2">
        <legend className="font-medium text-gray-900">Your public recipes</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="recipes"
            checked={!keepRecipes}
            onChange={() => setKeepRecipes(false)}
          />
          Delete them
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="recipes"
            checked={keepRecipes}
            onChange={() => setKeepRecipes(true)}
          />
          Keep them, credited to &quot;deleted user&quot;
        </label>
      </fieldset>
      <label className="block">
        <span className="text-gray-900">Type your account email to confirm</span>
        <input
          type="email"
          autoComplete="off"
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          required
        />
      </label>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || !confirmEmail.trim()}
        className="rounded-md bg-red-700 px-4 py-2 text-white hover:bg-red-800 disabled:opacity-50"
      >
        {pending ? 'Deleting…' : 'Delete my account'}
      </button>
    </form>
  );
}
