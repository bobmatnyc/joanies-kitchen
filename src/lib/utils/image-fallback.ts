import type { SyntheticEvent } from 'react';

/** Static asset under `public/` that always exists (#173). */
export const IMAGE_ERROR_FALLBACK_SRC = '/placeholders/generic.svg';

/**
 * Why: the old handlers pointed `src` at a sized placeholder API path
 * that has no route. The 404 fired `onError` again, so the browser requested the
 * placeholder in a loop (#173).
 * What: swaps a failed `<img>` to the static fallback once. If the image is
 * already showing the fallback, it does nothing, so a failing fallback cannot
 * trigger another request.
 * Test: `src/components/recipe/__tests__/ImageCarousel.test.tsx`.
 */
export function swapToFallbackImage(e: SyntheticEvent<HTMLImageElement>): void {
  const target = e.currentTarget;
  // #173: second failure on the fallback itself ends here.
  if (target.getAttribute('src') === IMAGE_ERROR_FALLBACK_SRC) {
    target.onerror = null;
    return;
  }
  target.src = IMAGE_ERROR_FALLBACK_SRC;
}
