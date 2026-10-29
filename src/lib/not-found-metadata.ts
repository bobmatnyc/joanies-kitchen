import type { Metadata } from 'next';
import { SITE_TITLE_TEMPLATE } from '@/lib/site-title';

/**
 * #138: metadata for every 404. `app/not-found.tsx` uses it, and so do segments that
 * render a 404 themselves (recipe layout, catch-all), because Next streams the
 * segment's own metadata to the client before the not-found page replaces it; without
 * this the hydrated page showed the home title and "index, follow".
 * The title is absolute: Next drops the root title.template below a segment that sets
 * a plain title, so a templated "Page Not Found" lost its brand on the recipe 404.
 * #134: the root layout sets robots index/follow; a 404 must not inherit it.
 */
export const NOT_FOUND_METADATA: Metadata = {
  title: { absolute: SITE_TITLE_TEMPLATE.replace('%s', 'Page Not Found') },
  robots: { index: false, follow: false },
};
