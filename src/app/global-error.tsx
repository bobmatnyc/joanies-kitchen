'use client';

/**
 * Global Error Handler
 *
 * Note: In Next.js 15 App Router, global-error.tsx requires <html> and <body> tags
 * but these tags MUST be written in lowercase without imports from next/document.
 *
 * This component handles unexpected errors at the root level.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    // Next.js 15 requires <html> and <body> in global-error.tsx (lowercase, no imports)
    <html lang="en">
      <body>
        <div className="container mx-auto py-16 px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
          <p className="text-gray-600 mb-4">An unexpected error occurred. Please try again.</p>
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-700"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
