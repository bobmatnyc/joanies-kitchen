/**
 * #135: seeded duplicate groups for the merge apply/rollback tests.
 *
 * Groups (title key -> members; keeper first):
 * - banana bread (auto, A1): a1 (NULL slug) <- a2 (slug `banana-bread`). a2 holds
 *   a favorite that collides with a1's, a collection row, a rating, a view, a
 *   recipe_of_the_day row, a discovery text ref and a backup-table row
 *   (`recipe_embeddings_bak_d57`, never moved). Collection k2 holds both a1
 *   and a2, so a2's row collides and k2's recipe_count drops from 2 to 1.
 *   `z1` already owns `banana-bread-2`, so a1 must get `banana-bread-3`.
 * - beef tacos (review, C): d1, d2 -> decision no_merge.
 * - cashew milk (review, size 3): b2 <- b1, b3 -> decision merge. b1 and b3
 *   both sit on chef ch1, so the second move collides and is dropped (the
 *   signed triple ch1/b3/b2); ch1's recipe_count goes from 2 to 1. The
 *   decision sets `source_override`.
 * - chicken stock (review, size 3): c1 <- c2 only -> decision partial; c3 stays.
 * - kale stew (auto, A1): e1 (NULL slug) <- e2, which holds a recipe_tools row.
 */
import { buildPlan } from '../../../../scripts/dedup-135/plan';
import type { Queryable } from '../dedup-merge-db';
import { type DecisionsFile, sha256Hex } from '../dedup-merge-decisions';
import type { PinPlan } from '../dedup-merge-pin';

const recipe = (
  id: string,
  name: string,
  slug: string | null,
  created: string,
  ing = 'same ingredients',
  ins = 'same steps'
) =>
  `('${id}', 'system', '${name}', ${slug ? `'${slug}'` : 'NULL'}, '${ing}', '${ins}', 'example.com', true, '${created}')`;

export const SEED_SQL = `
INSERT INTO user_profiles (user_id, username, display_name) VALUES
  ('u1', 'u1', 'U1'), ('u2', 'u2', 'U2'), ('u3', 'u3', 'U3'), ('u4', 'u4', 'U4');
INSERT INTO recipes (id, user_id, name, slug, ingredients, instructions, source, is_public, created_at) VALUES
  ${recipe('a1', 'Banana Bread', null, '2026-01-01 00:00:00')},
  ${recipe('a2', 'Banana Bread', 'banana-bread', '2026-01-02 00:00:00')},
  ${recipe('z1', 'Unrelated Soup', 'banana-bread-2', '2026-01-03 00:00:00')},
  ${recipe('b1', 'Cashew Milk', null, '2026-02-01 00:00:00', 'cashews 1')},
  ${recipe('b2', 'Cashew Milk', 'cashew-milk', '2026-02-02 00:00:00', 'cashews 2')},
  ${recipe('b3', 'Cashew Milk ', 'cashew-milk-2', '2026-02-03 00:00:00', 'cashews 3')},
  ${recipe('c1', 'Chicken Stock', 'chicken-stock', '2026-03-01 00:00:00', 'bones 1')},
  ${recipe('c2', 'Chicken Stock', null, '2026-03-02 00:00:00', 'bones 2')},
  ${recipe('c3', 'Chicken Stock', null, '2026-03-03 00:00:00', 'bones 3')},
  ${recipe('d1', 'Beef Tacos', 'beef-tacos', '2026-04-01 00:00:00', 'beef 1')},
  ${recipe('d2', 'Beef Tacos', 'beef-tacos-2', '2026-04-02 00:00:00', 'beef 2')},
  ${recipe('e1', 'Kale Stew', null, '2026-05-01 00:00:00')},
  ${recipe('e2', 'Kale Stew', null, '2026-05-02 00:00:00')};
UPDATE recipes SET like_count = 7, collection_count = 3 WHERE id = 'a1';
INSERT INTO favorites (user_id, recipe_id) VALUES ('u1', 'a1'), ('u1', 'a2'), ('u1', 'd2');
INSERT INTO recipe_ratings (recipe_id, user_id, rating) VALUES ('a1', 'u2', 4), ('a2', 'u3', 5);
INSERT INTO recipe_comments (recipe_id, user_id, content) VALUES ('a1', 'u4', 'nice');
INSERT INTO collections (id, user_id, name, slug, recipe_count) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'u1', 'Mine', 'mine', 1),
  ('00000000-0000-0000-0000-0000000000c2', 'u1', 'Both', 'both', 2);
INSERT INTO collection_recipes (collection_id, recipe_id) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'a2'),
  ('00000000-0000-0000-0000-0000000000c2', 'a1'),
  ('00000000-0000-0000-0000-0000000000c2', 'a2');
INSERT INTO recipe_views (recipe_id, viewed_at) VALUES
  ('a1', '2026-06-01'), ('a1', '2026-06-02'), ('a2', '2026-06-03'),
  ('b1', '2026-06-04'), ('b2', '2026-06-05'), ('b2', '2026-06-06'), ('c3', '2026-06-07'),
  ('d1', '2026-06-08');
INSERT INTO recipe_of_the_day (recipe_id, date) VALUES ('a2', '2026-05-23'), ('d1', '2026-05-24');
INSERT INTO recipe_discovery_runs (id) VALUES ('00000000-0000-0000-0000-0000000000f1');
INSERT INTO recipe_discovery_run_items (id, run_id, url, outcome, recipe_id) VALUES
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1', 'https://x', 'stored', 'a2');
INSERT INTO chefs (id, slug, name, recipe_count) VALUES
  ('00000000-0000-0000-0000-00000000c4e1', 'ch1', 'Chef One', 2),
  ('00000000-0000-0000-0000-00000000c4e2', 'ch2', 'Chef Two', 1);
INSERT INTO chef_recipes (chef_id, recipe_id) VALUES
  ('00000000-0000-0000-0000-00000000c4e1', 'b1'),
  ('00000000-0000-0000-0000-00000000c4e1', 'b3'),
  ('00000000-0000-0000-0000-00000000c4e2', 'b2');
INSERT INTO meals (id, user_id, name) VALUES ('00000000-0000-0000-0000-0000000000a1', 'u1', 'Dinner');
INSERT INTO meal_recipes (meal_id, recipe_id) VALUES ('00000000-0000-0000-0000-0000000000a1', 'c2');
INSERT INTO tools (id, name, display_name, category, slug)
  VALUES ('00000000-0000-0000-0000-0000000000b1', 'pot', 'Pot', 'cookware', 'pot');
INSERT INTO recipe_tools (recipe_id, tool_id) VALUES ('e2', '00000000-0000-0000-0000-0000000000b1');
CREATE TABLE recipe_embeddings_bak_d57 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipe_id text, embedding text);
INSERT INTO recipe_embeddings_bak_d57 (id, recipe_id, embedding)
  VALUES ('00000000-0000-0000-0000-0000000000ba', 'a2', '[0.1]');
`;

/** Every table the merge can touch, compared row for row. */
export const TOUCHED_TABLES = [
  'recipes',
  'favorites',
  'recipe_ratings',
  'recipe_comments',
  'collections',
  'collection_recipes',
  'recipe_views',
  'recipe_of_the_day',
  'recipe_discovery_run_items',
  'chef_recipes',
  'meal_recipes',
  'recipe_tools',
  'recipe_likes',
  'recipe_forks',
  'recipe_redirects',
  'chefs',
  'recipe_embeddings_bak_d57',
];

export async function snapshot(db: Queryable): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const t of TOUCHED_TABLES) {
    const { rows } = await db.query<{ r: unknown }>(
      `SELECT to_jsonb(t) AS r FROM "${t}" t ORDER BY to_jsonb(t)::text`
    );
    out[t] = rows.map((x) => x.r);
  }
  return out;
}

export interface Signed {
  text: string;
  sha: string;
  plan: PinPlan;
  /** group id by title key */
  ids: Record<string, string>;
}

/** Runs the real dry-run planner and returns it as the file Bob would sign. */
export async function signDryRun(db: Queryable): Promise<Signed> {
  const plan = await buildPlan(db);
  const text = `${JSON.stringify(plan, null, 2)}\n`;
  const parsed = JSON.parse(text) as PinPlan;
  const ids = Object.fromEntries(parsed.groups.map((g) => [g.key, g.groupId]));
  return { text, sha: sha256Hex(text), plan: parsed, ids };
}

export function signedDecisions(s: Signed, overrides: Partial<DecisionsFile> = {}): DecisionsFile {
  return {
    signed_by: 'Bob',
    signed_at: '2026-10-31T12:00:00Z',
    dry_run_sha256: s.sha,
    decisions: {
      [s.ids['beef tacos']]: { action: 'no_merge' },
      [s.ids['cashew milk']]: {
        action: 'merge',
        keeper: 'b2',
        source_override: 'https://example.com/cashew-milk',
      },
      [s.ids['chicken stock']]: { action: 'partial', keeper: 'c1', retire: ['c2'] },
    },
    ...overrides,
  };
}
