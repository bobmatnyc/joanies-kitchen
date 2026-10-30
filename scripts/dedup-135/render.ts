/**
 * #135: Markdown rendering of the read-only dry-run plan built by `plan.ts`.
 * Pure: takes the plan object, returns the report text.
 */
import type { MemberDetail } from '../../src/lib/recipes/dedup-merge-pin';
import type { GroupCategory } from '../../src/lib/recipes/dedup-merge-plan';
import type { Group, TableCount } from './plan';

/** Figures from `.trusty-mpm/runbooks/2026-10-29-duplicate-recipes-report.md` §1/§3. */
const REPORT = {
  groups: 961,
  recipes: 1936,
  losers: 975,
  totalRecipes: 5033,
  byCategory: { A1: 89, A2: 8, B1: 837, B2: 4, C: 23 } as Record<GroupCategory, number>,
  bySize: { '2': 952, '3': 6, '4+': 3 } as Record<string, number>,
};
/** The report's snapshot was taken on this UTC day; rows created from it on are drift. */
const REPORT_DAY = '2026-10-29';

export interface Plan {
  generatedAt: string;
  baseline: { total: number; deleted: number; public: number };
  groups: Group[];
  dependents: { fk: TableCount[]; unlinked: TableCount[] };
  recipeOfTheDay: Array<Record<string, unknown>>;
  discoveryRunItems: Array<Record<string, unknown>>;
  /** #135 (A69): per-member detail the apply pins against. */
  memberRefs: MemberDetail['memberRefs'];
  memberKeys: MemberDetail['memberKeys'];
  /** Rules-only chef_recipes collisions, one per (chef, loser, survivor). */
  chefCollisions: Array<{ groupId: string; chefId: string; loserId: string; survivorId: string }>;
  /** Rules-only recipe_tools drops (logical key recipe_id, tool_id), one per (tool, loser, survivor). */
  toolCollisions: Array<{ groupId: string; toolId: string; loserId: string; survivorId: string }>;
}

const CATS: GroupCategory[] = ['A1', 'A2', 'B1', 'B2', 'C'];
const esc = (s: string | null): string => (s === null ? 'NULL' : s.replace(/\|/g, '\\|'));
const delta = (now: number, then: number): string =>
  now === then ? 'matches' : `${now - then > 0 ? '+' : ''}${now - then}`;

export function renderMarkdown(plan: Plan): string {
  const { groups } = plan;
  const recipes = groups.reduce((n, g) => n + g.members.length, 0);
  const losers = recipes - groups.length;
  const size = (g: Group) => (g.members.length >= 4 ? '4+' : String(g.members.length));
  const L: string[] = [];
  L.push('# #135 duplicate merge: read-only dry run', '');
  L.push(
    `Generated ${plan.generatedAt} by \`scripts/dedup-135/plan.ts\` against the unpooled prod host, in a session with \`default_transaction_read_only = on\` and one READ ONLY transaction (rolled back). No writes.`,
    ''
  );

  L.push('## 1. Totals and reconciliation with the 2026-10-29 report', '');
  L.push('| Measure | Now | Report | Delta |', '|---|---|---|---|');
  L.push(
    `| Recipes in table | ${plan.baseline.total} | ${REPORT.totalRecipes} | ${delta(plan.baseline.total, REPORT.totalRecipes)} |`
  );
  L.push(
    `| Soft-deleted recipes | ${plan.baseline.deleted} | 0 | ${delta(plan.baseline.deleted, 0)} |`
  );
  L.push(
    `| Groups | ${groups.length} | ${REPORT.groups} | ${delta(groups.length, REPORT.groups)} |`
  );
  L.push(
    `| Recipes in groups | ${recipes} | ${REPORT.recipes} | ${delta(recipes, REPORT.recipes)} |`
  );
  L.push(
    `| Losers to soft-delete | ${losers} | ${REPORT.losers} | ${delta(losers, REPORT.losers)} |`
  );
  for (const c of CATS) {
    const n = groups.filter((g) => g.category === c).length;
    const r = groups.filter((g) => g.category === c).reduce((a, g) => a + g.members.length, 0);
    L.push(
      `| Category ${c}: groups (recipes, losers) | ${n} (${r}, ${r - n}) | ${REPORT.byCategory[c]} | ${delta(n, REPORT.byCategory[c])} |`
    );
  }
  for (const s of ['2', '3', '4+']) {
    const n = groups.filter((g) => size(g) === s).length;
    L.push(`| Groups of size ${s} | ${n} | ${REPORT.bySize[s]} | ${delta(n, REPORT.bySize[s])} |`);
  }
  const review = groups.filter((g) => g.needsReview);
  L.push(
    `| Groups needing review (C or size >= 3) | ${review.length} | 32 (23 C + 9 size >= 3; 4 overlap) | |`,
    ''
  );
  const fresh = groups.filter((g) => g.members.some((m) => m.createdAt.slice(0, 10) >= REPORT_DAY));
  L.push(
    `Drift check: ${fresh.length} group(s) contain a recipe created on or after ${REPORT_DAY} (the report's snapshot day): ${fresh.map((g) => `\`${g.groupId}\` "${g.key}" (${g.category}, ${g.members.length})`).join('; ') || 'none'}.`,
    ''
  );

  L.push('## 2. Dependent rows to re-point (loser -> keeper)', '');
  L.push(
    '| Table.column | FK on delete | Loser rows | Unique key(s) with the column | Collisions with a keeper row | Handling |',
    '|---|---|---|---|---|---|'
  );
  for (const t of [...plan.dependents.fk, ...plan.dependents.unlinked]) {
    const keys =
      t.uniqueKeys
        .map((u) => `\`${u.name}\` (${u.columns.join(', ')})${u.partial ? ' partial' : ''}`)
        .join('; ') || 'none';
    const coll = t.uniqueKeys.length ? t.uniqueKeys.map((u) => u.collisions).join(' / ') : 'n/a';
    L.push(
      `| \`${t.table}.${t.column}\` | ${t.onDelete} | ${t.loserRows} | ${keys} | ${coll} | ${t.handling} |`
    );
  }
  L.push(
    '',
    "A collision means the same user/collection/meal/chef already holds a row on the keeper, or two losers of one group move onto the same key. Proposed handling: drop the loser's row, keep the keeper's. After the move, recompute `like_count`, `fork_count`, `collection_count`, `total_user_ratings`, `avg_user_rating` on each keeper.",
    ''
  );

  L.push('## 3. recipe_of_the_day and recipe_discovery_run_items', '');
  L.push(
    `recipe_of_the_day rows pointing at a loser: ${plan.recipeOfTheDay.length}. The FK is \`set null\`, so they must be re-pointed, never left to a delete.`,
    ''
  );
  for (const r of plan.recipeOfTheDay)
    L.push(
      `- date ${String(r.date).slice(0, 10)}: \`${r.recipe_id}\` -> \`${keeperOfId(groups, String(r.recipe_id))}\``
    );
  L.push(
    '',
    `recipe_discovery_run_items rows whose text \`recipe_id\` names a loser: ${plan.discoveryRunItems.length} (no FK).`,
    ''
  );
  for (const r of plan.discoveryRunItems)
    L.push(
      `- item \`${r.id}\` run \`${r.run_id}\` outcome ${r.outcome}: \`${r.recipe_id}\` -> \`${keeperOfId(groups, String(r.recipe_id))}\``
    );
  L.push('');
  L.push(
    `chef_recipes collisions under the rules (chef, loser, survivor): ${plan.chefCollisions.length}. The apply derives its allowed set from \`memberKeys\` for the signed survivors and stops on any other.`,
    ''
  );
  for (const c of plan.chefCollisions)
    L.push(`- \`${c.groupId}\` chef \`${c.chefId}\`: \`${c.loserId}\` -> \`${c.survivorId}\``);
  L.push(
    '',
    `recipe_tools drops under the rules (tool, loser, survivor; logical key recipe_id, tool_id): ${plan.toolCollisions.length}.`,
    ''
  );
  for (const c of plan.toolCollisions)
    L.push(`- \`${c.groupId}\` tool \`${c.toolId}\`: \`${c.loserId}\` -> \`${c.survivorId}\``);
  L.push('');

  L.push('## 4. Redirect map', '');
  const keepers = groups.map((g) => g.members.find((m) => m.id === g.keeperId));
  const nullSlug = keepers.filter((k) => k?.slug === null).length;
  const sluggedLosers = groups.flatMap((g) =>
    g.members.filter((m) => m.id !== g.keeperId && m.slug !== null)
  );
  const untrimmed = keepers.filter((k) => k && k.name !== k.name.trim()).length;
  L.push(`- Redirect entries (loser id -> keeper slug): ${losers}.`);
  L.push(
    `- Losers that have a slug of their own (their \`/recipes/<slug>\` also needs a redirect): ${sluggedLosers.length}.`
  );
  L.push(`- Keepers with a NULL slug that need one before the redirect can resolve: ${nullSlug}.`);
  L.push(`- Keepers whose name needs trimming: ${untrimmed}.`, '');

  L.push(`## 5. Review list (${review.length} groups)`, '');
  L.push(
    'Proposed keeper in **bold**. Refs = favorites + collections + meal rows + ratings + comments (incl. Joanie notes) + likes.',
    ''
  );
  L.push(
    '| Group | Cat | Members: id / name / slug / created_at (UTC) / views / refs | Proposed keeper | Reason |',
    '|---|---|---|---|---|'
  );
  for (const g of [...review].sort(
    (a, b) => a.category.localeCompare(b.category) || a.key.localeCompare(b.key)
  )) {
    const members = g.members
      .map((m) => {
        const cell = `\`${m.id}\` "${esc(m.name)}" / ${esc(m.slug)} / ${m.createdAt.slice(0, 19)} / ${m.views} / ${m.userRefs}`;
        return m.id === g.keeperId ? `**${cell}**` : cell;
      })
      .join('<br>');
    L.push(
      `| \`${g.groupId}\` ${esc(g.key)} | ${g.category} | ${members} | \`${g.keeperId}\` | ${esc(g.reason)} |`
    );
  }
  L.push('');
  return `${L.join('\n')}\n`;
}

function keeperOfId(groups: Group[], id: string): string {
  return groups.find((g) => g.members.some((m) => m.id === id))?.keeperId ?? '?';
}
