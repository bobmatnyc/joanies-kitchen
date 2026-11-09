import { Link2 } from 'lucide-react';
import Link from 'next/link';
import type { ResolvedRecipeSource } from '@/lib/recipes/recipe-source';

// Tdb: show recipe source (Bob 2026-11-09)
const EXTERNAL_REL = 'nofollow noopener noreferrer';
const LINK_CLASS = 'font-medium hover:text-primary underline-offset-2 hover:underline';

function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  // Internal targets (chef page, profile) start with one `/`; the resolver only emits
  // http(s) URLs otherwise.
  if (href.startsWith('/') && !href.startsWith('//')) {
    return (
      <Link href={href} className={LINK_CLASS}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel={EXTERNAL_REL} className={LINK_CLASS}>
      {children}
    </a>
  );
}

/**
 * Why: Tdb — readers could not see where a recipe came from.
 * What: the "Source" item in the recipe page's metadata row. Renders nothing for a null
 * source; external links open in a new tab with rel="nofollow noopener noreferrer".
 * Test: src/app/recipes/[slug]/__tests__/RecipeSourceLine.test.tsx
 */
export function RecipeSourceLine({ source }: { source: ResolvedRecipeSource | null }) {
  if (!source) return null;
  return (
    <div
      className="flex items-center gap-1.5 text-muted-foreground"
      data-testid="recipe-source"
      data-source-kind={source.kind}
    >
      <Link2 className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      <span>
        Source:{' '}
        {source.href ? (
          <SourceLink href={source.href}>{source.label}</SourceLink>
        ) : (
          <span className="font-medium">{source.label}</span>
        )}
        {source.secondary && (
          <>
            {' ('}
            <SourceLink href={source.secondary.href}>{source.secondary.label}</SourceLink>
            {')'}
          </>
        )}
      </span>
    </div>
  );
}
