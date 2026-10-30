// #135: keeper selection and collision counting for the duplicate-merge dry run.
import { describe, expect, it } from 'vitest';
import {
  categorizeGroup,
  countRepointCollisions,
  type GroupMember,
  needsReview,
  selectKeeper,
} from '../dedup-merge-plan';

const member = (over: Partial<GroupMember> & { id: string }): GroupMember => ({
  name: 'Lemon Cake',
  slug: null,
  userId: 'system',
  source: 'https://example.com/lemon-cake',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  views: 0,
  userRefs: 0,
  ingredientsHash: 'ing',
  instructionsHash: 'ins',
  ...over,
});

const epicurious = (id: string, day: string, over: Partial<GroupMember> = {}) =>
  member({
    id,
    userId: 'system_imported',
    source: 'epicurious.com',
    createdAt: new Date(`${day}T19:00:00Z`),
    ...over,
  });

describe('selectKeeper', () => {
  it('keeps the 2025-10-15 Epicurious original even when the re-run copy has more refs and views', () => {
    const group = [
      epicurious('rerun', '2025-10-18', { name: 'Lemon Cake ', userRefs: 3, views: 40 }),
      epicurious('orig', '2025-10-15', { slug: 'lemon-cake', views: 2 }),
    ];
    expect(selectKeeper(group)).toEqual({
      keeperId: 'orig',
      reason: 'Epicurious twin: 2025-10-15 original',
    });
  });

  it('prefers user references, then views, for non-Epicurious groups', () => {
    const group = [
      member({ id: 'old', views: 99, slug: 'lemon-cake' }),
      member({ id: 'liked', userRefs: 2, views: 1 }),
    ];
    expect(selectKeeper(group).keeperId).toBe('liked');
    expect(selectKeeper(group).reason).toBe('most user references (2 vs 0)');
  });

  it('breaks a refs-and-views tie on the slug, then on the oldest row', () => {
    const slugTie = [
      member({ id: 'a', views: 5 }),
      member({ id: 'b', views: 5, slug: 'lemon-cake' }),
    ];
    expect(selectKeeper(slugTie).keeperId).toBe('b');

    const ageTie = [
      member({ id: 'newer', views: 5, createdAt: new Date('2026-03-01T00:00:00Z') }),
      member({ id: 'older', views: 5, createdAt: new Date('2025-11-01T00:00:00Z') }),
    ];
    expect(selectKeeper(ageTie)).toEqual({
      keeperId: 'older',
      reason: 'refs, views and slug tied (0/5); oldest',
    });
  });

  it('rejects a group with fewer than two members', () => {
    expect(() => selectKeeper([member({ id: 'only' })])).toThrow();
  });
});

describe('categorizeGroup and needsReview', () => {
  it('assigns A1, A2, B1, B2 and C per the report', () => {
    const o = epicurious('o', '2025-10-15');
    const r = epicurious('r', '2025-10-18');
    expect(categorizeGroup([o, r])).toBe('A1');
    expect(
      categorizeGroup([
        member({ id: 'x' }),
        member({ id: 'y', source: 'https://example.com/lemon-cake#c' }),
      ])
    ).toBe('A2');
    expect(categorizeGroup([o, { ...r, ingredientsHash: 'other' }])).toBe('B1');
    expect(categorizeGroup([o, { ...r, ingredientsHash: 'i2', instructionsHash: 'n2' }])).toBe(
      'B2'
    );
    expect(categorizeGroup([member({ id: 'x' }), member({ id: 'y', ingredientsHash: 'i2' })])).toBe(
      'C'
    );
    expect(needsReview('B1', 2)).toBe(false);
    expect(needsReview('B2', 3)).toBe(true);
    expect(needsReview('C', 2)).toBe(true);
  });
});

describe('countRepointCollisions', () => {
  it('counts a loser row whose key already exists on the keeper, and two losers moving onto one key', () => {
    const keeperOf = new Map([
      ['l1', 'k'],
      ['l2', 'k'],
    ]);
    const rows = [
      { recipeId: 'k', otherKey: ['user-1'] },
      { recipeId: 'l1', otherKey: ['user-1'] }, // collides with the keeper's row
      { recipeId: 'l1', otherKey: ['user-2'] }, // moves cleanly
      { recipeId: 'l2', otherKey: ['user-2'] }, // collides with l1's moved row
      { recipeId: 'l2', otherKey: [null] }, // NULL never collides
    ];
    expect(countRepointCollisions(rows, keeperOf)).toEqual({ repoint: 4, collisions: 2 });
  });
});
