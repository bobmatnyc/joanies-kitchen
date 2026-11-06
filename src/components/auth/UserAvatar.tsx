'use client';

import { useState } from 'react';

/** Up to two initials from the name, else the first letter of the email. */
export function getInitials(name: string | null, email: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length > 0)
    return words
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('');
  return email?.trim()[0]?.toUpperCase() ?? '?';
}

/**
 * Header user icon: the Google profile picture, or initials.
 *
 * Why: the header showed a generic icon; owners asked for Google avatars.
 * What: plain `<img>` with `referrerPolicy="no-referrer"` (lh3.googleusercontent.com
 * can 403 with a referrer; no `next/image` host allowlist needed). Falls back to
 * initials with no image or on load error. Both fill the parent (which must be `relative`),
 * so the face fills the circle at any trigger size (32px, or 44px under the touch-target rule).
 * Test: `src/components/auth/__tests__/UserAvatar.test.tsx`
 */
export function UserAvatar({
  image,
  name,
  email,
}: {
  image: string | null;
  name: string | null;
  email: string | null;
}) {
  // Tracks the URL that failed, so a new image URL gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (image && failedSrc !== image) {
    return (
      // biome-ignore lint/performance/noImgElement: tiny remote avatar; plain img needed for referrerPolicy
      <img
        src={image}
        alt={name ?? email ?? 'Account'}
        referrerPolicy="no-referrer"
        onError={() => setFailedSrc(image)}
        className="absolute inset-0 h-full w-full max-w-none shrink-0 object-cover"
      />
    );
  }
  return (
    <span className="flex h-full w-full shrink-0 items-center justify-center text-xs font-medium text-foreground">
      {getInitials(name, email)}
    </span>
  );
}
