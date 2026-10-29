'use client';

import { useState } from 'react';
import {
  getRecipeImageCandidates,
  parseRecipeTags,
  type RecipeImageSource,
} from '@/lib/utils/recipe-image';
import { getPlaceholderImage } from '@/lib/utils/recipe-placeholders';

/**
 * Why: a broken first image must not hide a working second one, and a reused
 * card must not carry a failure over to the next recipe (#94).
 * What: returns the current candidate URL and an `onError` that advances to the
 * next candidate; the placeholder shows only after every candidate failed. The
 * failure index resets whenever the candidate list changes.
 * Test: `SharedRecipeCarousel.test.tsx`, `RecipeCard.test.tsx` "image fallback".
 */
export function useRecipeImageFallback(recipe: RecipeImageSource): {
  src: string;
  onError: () => void;
} {
  const candidates = getRecipeImageCandidates(recipe);
  const key = candidates.join('\n');
  const [failure, setFailure] = useState({ key, index: 0 });
  // #94: an index recorded for another candidate list does not apply.
  const index = failure.key === key ? failure.index : 0;
  const src = candidates[index] ?? getPlaceholderImage(parseRecipeTags(recipe.tags));
  const onError = () => {
    if (index < candidates.length) setFailure({ key, index: index + 1 });
  };
  return { src, onError };
}
