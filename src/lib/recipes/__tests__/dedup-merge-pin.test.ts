/**
 * #135 (A69): the exact pin between the signed dry run and the live plan, and
 * the derivation of the allowed unique-key collisions.
 */
import { describe, expect, it } from 'vitest';
import type { ResolvedGroup, SignedGroup } from '../dedup-merge-decisions';
import { checkPinned, expectedCollisions, type PinPlan, repeatedKeys } from '../dedup-merge-pin';

const group = (groupId: string, ids: string[]): SignedGroup => ({
  groupId,
  key: groupId,
  isPublic: true,
  needsReview: false,
  keeperId: ids[0] ?? '',
  members: ids.map((id) => ({ id, slug: null })),
});
const resolved = (groupId: string, keeperId: string, losers: string[]): ResolvedGroup => ({
  groupId,
  phase: 1,
  isPublic: true,
  keeperId,
  losers,
  memberIds: [keeperId, ...losers],
  source: 'decision',
});

const SIGNED: PinPlan = {
  groups: [group('g1', ['k1', 'l1', 'x1']), group('g2', ['k2', 'l2'])],
  memberRefs: {
    l1: { 'recipe_views.recipe_id': 100, 'chef_recipes.recipe_id': 2 },
    x1: { 'recipe_tools.recipe_id': 9 },
    l2: { 'recipe_views.recipe_id': 100, 'recipe_ingredients.recipe_id': 7 },
  },
  memberKeys: {},
};
// g1 is partial: only l1 retires, x1 (not a loser) contributes nothing.
const RESOLVED = [resolved('g1', 'k1', ['l1']), resolved('g2', 'k2', ['l2'])];
const clone = (p: PinPlan): PinPlan => JSON.parse(JSON.stringify(p)) as PinPlan;

describe('checkPinned', () => {
  it('passes on identical data; counts only post-decision losers', () => {
    const r = checkPinned(SIGNED, clone(SIGNED), RESOLVED, new Set());
    expect(r.problems).toEqual([]);
    expect(r.rows).toEqual([
      { ref: 'chef_recipes.recipe_id', signed: 2, now: 2, ok: true },
      { ref: 'recipe_views.recipe_id', signed: 200, now: 200, ok: true },
    ]);
  });

  it.each<[string, (p: PinPlan) => void, RegExp]>([
    ['a new group', (p) => p.groups.push(group('g3', ['n1', 'n2'])), /new group g3/],
    ['a missing group', (p) => p.groups.splice(1, 1), /signed group g2 .* is missing now/],
    [
      'an added member',
      (p) => p.groups[0]?.members.push({ id: 'n9', slug: null }),
      /g1: member\(s\) added: n9/,
    ],
    ['a missing member', (p) => p.groups[0]?.members.splice(2, 1), /g1: member\(s\) missing: x1/],
    [
      'a non-views count off by one',
      (p) => {
        (p.memberRefs as Record<string, Record<string, number>>).l1['chef_recipes.recipe_id'] = 3;
      },
      /chef_recipes.recipe_id: 3 .* signed 2/,
    ],
    [
      'a new table with loser rows',
      (p) => {
        (p.memberRefs as Record<string, Record<string, number>>).l2['favorites.recipe_id'] = 1;
      },
      /favorites.recipe_id: 1 .* signed 0/,
    ],
    [
      'views beyond 5%',
      (p) => {
        (p.memberRefs as Record<string, Record<string, number>>).l1['recipe_views.recipe_id'] = 111;
      },
      /recipe_views.recipe_id: 211/,
    ],
  ])('stops on %s', (_label, mutate, expected) => {
    const live = clone(SIGNED);
    mutate(live);
    const r = checkPinned(SIGNED, live, RESOLVED, new Set());
    expect(r.ok).toBe(false);
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toMatch(expected);
  });

  it('allows views within 5% and ignores tables that stay with the loser', () => {
    const live = clone(SIGNED);
    const refs = live.memberRefs as Record<string, Record<string, number>>;
    refs.l1['recipe_views.recipe_id'] = 110;
    refs.l2['recipe_ingredients.recipe_id'] = 99;
    refs.x1['recipe_tools.recipe_id'] = 50;
    expect(checkPinned(SIGNED, live, RESOLVED, new Set()).problems).toEqual([]);
  });

  it('leaves applied groups out of both sides', () => {
    const live = clone(SIGNED);
    live.groups = live.groups.filter((g) => g.groupId !== 'g2');
    const r = checkPinned(SIGNED, live, RESOLVED, new Set(['g2']));
    expect(r.problems).toEqual([]);
    expect([...r.pending]).toEqual(['g1']);
    expect(r.applied).toEqual(['g2']);
  });

  it('refuses a signed dry run without per-member detail', () => {
    const old = { groups: SIGNED.groups };
    const r = checkPinned(old, clone(SIGNED), RESOLVED, new Set());
    expect(r.problems).toEqual([
      'signed dry run has no per-member detail (memberRefs/memberKeys); re-run plan.ts',
    ]);
  });
});

describe('expectedCollisions', () => {
  // code-critic BLOCK: a key repeated on one loser is neither a collision nor a move;
  // repeatedKeys names it so the apply refuses the group.
  it('a loser repeating a logical key: no collision, no move, and reported', () => {
    const tool = 'recipe_tools.recipe_id#recipe_tools_recipe_id_tool_id_logical';
    const keys = {
      s: { [tool]: ['["t1"]'] },
      l1: { [tool]: ['["t1"]', '["t1"]', '["t2"]', '["t2"]', '["t3"]'] },
      l2: { [tool]: ['["t2"]', '["t3"]'] },
    };
    // t2 is not taken by l1's repeated rows, so l2's t2 moves; l1's t3 moved, so l2's t3 collides.
    expect(expectedCollisions('s', ['l1', 'l2'], keys)).toEqual([
      { ref: tool, key: '["t3"]', loserId: 'l2', survivorId: 's' },
    ]);
    expect(repeatedKeys(['l1', 'l2'], keys)).toEqual([
      { ref: tool, key: '["t1"]', loserId: 'l1', count: 2 },
      { ref: tool, key: '["t2"]', loserId: 'l1', count: 2 },
    ]);
  });

  const ref = 'chef_recipes.recipe_id#unique_chef_recipe';
  it('survivor keys first, then each loser in order; NULL keys never collide', () => {
    const keys = {
      s: { [ref]: ['["c1"]'] },
      l1: { [ref]: ['["c1"]', '["c2"]', '[null]'] },
      l2: { [ref]: ['["c2"]', '["c3"]', '[null]'] },
    };
    expect(expectedCollisions('s', ['l1', 'l2'], keys)).toEqual([
      { ref, key: '["c1"]', loserId: 'l1', survivorId: 's' },
      { ref, key: '["c2"]', loserId: 'l2', survivorId: 's' },
    ]);
  });
});
