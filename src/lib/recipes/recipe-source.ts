/**
 * Tdb: show recipe source (Bob 2026-11-09)
 *
 * Why: `recipes.source` is free text in several formats (URL, bare domain, TheMealDB id,
 * person text, placeholders), and the recipe page showed none of it.
 * What: a pure resolver from a recipe's source fields to one display line, plus the
 * http(s)-only URL parsing it relies on. No I/O; the data comes from
 * `getRecipeSourceContext` (src/app/actions/recipe-source.ts).
 * Test: src/app/recipes/[slug]/__tests__/recipe-source.test.ts
 */

export interface RecipeSourceChef {
  slug: string;
  name: string;
  display_name: string | null;
}

/** The `recipe_sources` row a recipe's `source_id` points at. */
export interface RecipeSourceSite {
  name: string;
  slug: string;
  website_url: string | null;
}

/** The recipe owner's profile, reduced to what may be shown. Never carries an email. */
export type RecipeSourceAuthor =
  | { isPublic: true; username: string; display_name: string }
  | { isPublic: false };

/** Companion data for one recipe, loaded beside the recipe row. */
export interface RecipeSourceContext {
  chef: RecipeSourceChef | null;
  /** `chef_recipes.original_url` for the chef above, when one is stored. */
  chefOriginalUrl: string | null;
  site: RecipeSourceSite | null;
  author: RecipeSourceAuthor | null;
}

export interface RecipeSourceInput extends Partial<RecipeSourceContext> {
  source: string | null | undefined;
  isSystemRecipe: boolean | null | undefined;
  isAiGenerated: boolean | null | undefined;
}

export type RecipeSourceKind = 'chef' | 'site' | 'themealdb' | 'text' | 'first-party' | 'user';

export interface ResolvedRecipeSource {
  kind: RecipeSourceKind;
  label: string;
  /** Internal path (starts with `/`) or an http(s) URL. */
  href?: string;
  /** For a chef: the original page on the external site. */
  secondary?: { label: string; href: string };
}

const PLACEHOLDERS = new Set(['system', 'recipe manager team']);
const FORK_MARKER = 'forked from recipe id:';
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
// A bare host (labels + TLD) with an optional path; no spaces, no userinfo, no port.
const BARE_DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:\/\S*)?$/i;
const THEMEALDB = /^themealdb\b/i;

export interface ExternalUrl {
  href: string;
  host: string;
}

function hostLabel(hostname: string): string {
  return hostname.replace(/^www\./, '');
}

/**
 * Parses a full http(s) URL or a bare domain/path into a link target.
 * Returns null for any other scheme (`javascript:`, `data:`, `ftp:`) and for plain text.
 * A bare value gets `https://`; credentials are dropped from the href.
 */
export function parseExternalUrl(value: string | null | undefined): ExternalUrl | null {
  const text = value?.trim();
  if (!text) return null;
  let candidate: string;
  if (SCHEME.test(text)) {
    candidate = text;
  } else if (BARE_DOMAIN.test(text)) {
    candidate = `https://${text}`;
  } else {
    return null;
  }
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) return null;
  url.username = '';
  url.password = '';
  return { href: url.href, host: hostLabel(url.hostname) };
}

function isUserCreated(input: RecipeSourceInput): boolean {
  return !input.isSystemRecipe && !input.isAiGenerated;
}

/** Rule g: the user who added the recipe, never more than a public profile shows. */
function resolveAuthor(author: RecipeSourceAuthor | null | undefined): ResolvedRecipeSource {
  if (author?.isPublic) {
    return {
      kind: 'user',
      label: `Added by ${author.display_name}`,
      href: `/profile/${encodeURIComponent(author.username)}`,
    };
  }
  return { kind: 'user', label: 'Shared by a community member' };
}

/**
 * Resolves the "Source" line for a recipe. The first matching rule wins:
 * a) known chef, b) http(s) URL or bare domain, c) TheMealDB with a source row,
 * e) "Joanie's…" text, f) placeholder / fork marker / empty -> null,
 * d) any other text as plain text, g) user recipe with no external source,
 * h) AI-only -> null. Only http(s) values ever become external links.
 */
export function resolveRecipeSource(input: RecipeSourceInput): ResolvedRecipeSource | null {
  const text = input.source?.trim() ?? '';
  const sourceUrl = parseExternalUrl(text);

  // a) Chef page on this site; the original page, when known, as a secondary link.
  if (input.chef) {
    const original = parseExternalUrl(input.chefOriginalUrl) ?? sourceUrl;
    return {
      kind: 'chef',
      label: input.chef.display_name || input.chef.name,
      href: `/chef/${encodeURIComponent(input.chef.slug)}`,
      ...(original
        ? { secondary: { label: `original on ${original.host}`, href: original.href } }
        : {}),
    };
  }

  // b) Full URL or bare domain/path.
  if (sourceUrl) {
    return { kind: 'site', label: sourceUrl.host, href: sourceUrl.href };
  }

  // c) TheMealDB id with its recipe_sources row.
  if (THEMEALDB.test(text) && input.site) {
    const site = parseExternalUrl(input.site.website_url);
    return { kind: 'themealdb', label: 'TheMealDB', ...(site ? { href: site.href } : {}) };
  }

  const lower = text.toLowerCase();
  // e) First-party recipe.
  if (lower.startsWith("joanie's") || lower.startsWith('joanie’s')) {
    return { kind: 'first-party', label: "Joanie's Kitchen" };
  }

  // f) Nothing external is known: empty, placeholder, fork marker, or a non-http(s) scheme.
  const unknown =
    text === '' || PLACEHOLDERS.has(lower) || lower.startsWith(FORK_MARKER) || SCHEME.test(text);
  if (!unknown) {
    // d) Person or title text, never a link.
    return { kind: 'text', label: text };
  }

  // g) A user's own recipe; h) AI-only and system placeholders render nothing.
  return isUserCreated(input) ? resolveAuthor(input.author) : null;
}

/** The external http(s) URL a resolved source points at, for JSON-LD `isBasedOn`. */
export function resolvedExternalUrl(resolved: ResolvedRecipeSource | null): string | undefined {
  if (!resolved) return undefined;
  if (resolved.kind === 'chef') return resolved.secondary?.href;
  if (resolved.kind === 'site' || resolved.kind === 'themealdb') return resolved.href;
  return undefined;
}
