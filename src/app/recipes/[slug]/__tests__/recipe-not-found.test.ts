// @vitest-environment node
/**
 * #134: /recipes/<slug> answers a real 404 for a missing recipe and for a private
 * recipe the viewer cannot see, and the two answers are identical.
 *
 * The layout and `generateMetadata` run against real Postgres (PGlite) through the
 * real `getRecipe` visibility rule (#32). `notFound()` and `redirect()` are the real
 * Next functions; the test reads the digest each one throws.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const OWNER = 'user_owner';
const OTHER = 'user_other';
const PUBLIC_ID = 'aaaaaaaa-0000-4000-8000-00000000000a';
const PRIVATE_ID = 'bbbbbbbb-0000-4000-8000-00000000000b';
const MISSING_ID = 'cccccccc-0000-4000-8000-00000000000c';
const SECRET = 'Secret Stew';
const NOT_FOUND_DIGEST = 'NEXT_HTTP_ERROR_FALLBACK;404';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  userId: null as string | null,
}));

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ userId: state.userId, sessionClaims: null }),
}));
vi.mock('@/lib/auth-users', () => ({ getUserAdminFlag: async () => false }));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import type { Metadata } from 'next';
import { resolveTitle } from 'next/dist/lib/metadata/resolvers/resolve-title';
import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { metadata as notFoundMetadata } from '@/app/not-found';
import RecipeLayout, { generateMetadata } from '@/app/recipes/[slug]/layout';
import * as schema from '@/lib/db/schema';
import { SITE_NAME, SITE_TITLE_TEMPLATE } from '@/lib/site-title';

/** The root layout's title, as `src/app/layout.tsx` declares it. */
const ROOT_METADATA: Metadata = {
  title: { default: 'Home default', template: SITE_TITLE_TEMPLATE },
};

/**
 * #138: the document title Next 15 resolves for a chain of metadata items, root first,
 * one item per tree level (`null` for a level with no metadata). Mirrors
 * `next/dist/lib/metadata/resolve-metadata.js`: each title resolves against the current
 * template, and the template is re-read from the resolved title after every item but
 * the last two, so a plain-string title clears it for the levels below.
 */
function resolveDocumentTitle(chain: Array<Metadata | null>): string {
  let template: string | null = null;
  let resolved: ReturnType<typeof resolveTitle> | null = null;
  for (const [i, item] of chain.entries()) {
    if (item?.title != null) resolved = resolveTitle(item.title, template);
    if (i < chain.length - 2) template = resolved?.template ?? null;
  }
  return resolved?.absolute ?? '';
}

function brandCount(title: string): number {
  return title.split(SITE_NAME).length - 1;
}

let client: PGlite;

function row(id: string, slug: string, isPublic: boolean, name: string) {
  return {
    id,
    slug,
    user_id: OWNER,
    name,
    description: `${name} description`,
    ingredients: '[]',
    instructions: '[]',
    is_public: isPublic,
    is_system_recipe: false,
    fork_count: 0,
    like_count: 0,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  };
}

type Outcome =
  | { kind: 'value'; value: unknown }
  | { kind: 'thrown'; digest: string | undefined; message: string };

/** Runs `fn` and records either its value or the Next control-flow digest it threw. */
async function outcome(fn: () => Promise<unknown>): Promise<Outcome> {
  try {
    return { kind: 'value', value: await fn() };
  } catch (error) {
    const e = error as { digest?: string; message?: string };
    return { kind: 'thrown', digest: e.digest, message: String(e.message) };
  }
}

/** Metadata and layout outcomes for one URL segment and one viewer. */
async function visit(slug: string, userId: string | null) {
  state.userId = userId;
  const params = Promise.resolve({ slug });
  return {
    metadata: await outcome(() => generateMetadata({ params })),
    layout: await outcome(() => RecipeLayout({ children: null, params })),
  };
}

beforeAll(async () => {
  const built = await createVisibilityDb([schema.recipes], schema);
  client = built.client;
  state.db = built.db;
  await built.db
    .insert(schema.recipes)
    .values([
      row(PUBLIC_ID, 'open-soup', true, 'Open Soup'),
      row(PRIVATE_ID, 'secret-stew', false, SECRET),
    ]);
});

afterAll(async () => {
  await client?.close();
});

describe('/recipes/[slug] not-found (#134)', () => {
  it('missing, private-to-anonymous and private-to-other-user give one identical 404', async () => {
    const missing = await visit('no-such-recipe', null);
    const privateAnon = await visit('secret-stew', null);
    const privateOther = await visit('secret-stew', OTHER);

    for (const result of [missing, privateAnon, privateOther]) {
      // #138: metadata never throws and is the fixed 404 metadata; the layout owns the 404.
      expect(result.metadata).toEqual({ kind: 'value', value: notFoundMetadata });
      expect(result.layout).toMatchObject({ kind: 'thrown', digest: NOT_FOUND_DIGEST });
      expect(JSON.stringify(result)).not.toContain(SECRET);
    }
    expect(privateAnon).toEqual(missing);
    expect(privateOther).toEqual(missing);
  });

  it('a private recipe UUID gives anonymous the same 404 as a missing UUID, not a redirect', async () => {
    const privateUuid = await visit(PRIVATE_ID, null);
    const missingUuid = await visit(MISSING_ID, null);

    expect(privateUuid.layout).toMatchObject({ kind: 'thrown', digest: NOT_FOUND_DIGEST });
    expect(privateUuid.metadata).toEqual({ kind: 'value', value: notFoundMetadata });
    expect(JSON.stringify(privateUuid)).not.toContain('secret-stew');
    expect(privateUuid).toEqual(missingUuid);
  });

  it('the owner gets their private recipe rendered with its title', async () => {
    const owner = await visit('secret-stew', OWNER);

    expect(owner.layout.kind).toBe('value');
    expect(owner.metadata).toMatchObject({
      kind: 'value',
      value: { title: SECRET },
    });
  });

  it('a public recipe renders for anyone, and its UUID still redirects to the slug', async () => {
    for (const viewer of [null, OTHER]) {
      const visit_ = await visit('open-soup', viewer);
      expect(visit_.layout.kind).toBe('value');
      expect(visit_.metadata).toMatchObject({
        kind: 'value',
        value: { title: 'Open Soup' },
      });
    }

    const byUuid = await visit(PUBLIC_ID, null);
    expect(byUuid.layout).toMatchObject({ kind: 'thrown' });
    expect((byUuid.layout as { digest: string }).digest).toMatch(
      /^NEXT_REDIRECT;[a-z]+;\/recipes\/open-soup;/
    );
  });
});

describe('/recipes/[slug] 404 page metadata and title (#138)', () => {
  // Tree levels: root layout, `recipes` (no layout), `[slug]` layout, page (no metadata).
  // The server HTML of a 404 appends app/not-found.tsx; a throw from the [slug] step
  // dropped the whole head. The client keeps the head streamed without it.
  it('a dead or hidden recipe resolves to the styled not-found title, brand once, noindex', async () => {
    for (const [slug, viewer] of [
      ['no-such-recipe', null],
      ['secret-stew', null],
      ['secret-stew', OTHER],
      [PRIVATE_ID, null],
    ] as const) {
      state.userId = viewer;
      const segment = await generateMetadata({ params: Promise.resolve({ slug }) });
      const serverTitle = resolveDocumentTitle([
        ROOT_METADATA,
        null,
        segment,
        null,
        notFoundMetadata,
      ]);
      const streamedTitle = resolveDocumentTitle([ROOT_METADATA, null, segment, null]);

      for (const title of [serverTitle, streamedTitle]) {
        expect(title).toBe("Page Not Found | Joanie's Kitchen");
        expect(brandCount(title)).toBe(1);
      }
      expect(segment.robots).toEqual({ index: false, follow: false });
      expect(JSON.stringify(segment)).not.toContain(SECRET);
    }
    expect(notFoundMetadata.robots).toEqual({ index: false, follow: false });
  });

  it('a recipe title with the root template applied shows the brand exactly once', async () => {
    state.userId = null;
    const segment = await generateMetadata({ params: Promise.resolve({ slug: 'open-soup' }) });
    const title = resolveDocumentTitle([ROOT_METADATA, null, segment, null]);

    expect(title).toBe("Open Soup | Joanie's Kitchen");
    expect(brandCount(title)).toBe(1);
  });
});
