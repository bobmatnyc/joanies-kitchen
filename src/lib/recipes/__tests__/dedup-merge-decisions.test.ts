/**
 * #135: the decisions-file validator rejects each bad case, accepts a signed
 * file, and resolves keeper/losers per group. The shipped example is unsigned
 * and must be rejected as such.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DecisionsError,
  parseDecisions,
  resolveGroups,
  type SignedGroup,
  validateDecisions,
} from '../dedup-merge-decisions';

const SHA = 'a'.repeat(64);
const member = (id: string) => ({ id, slug: null });
const GROUPS: SignedGroup[] = [
  {
    groupId: 'g-auto',
    key: 'bread',
    isPublic: true,
    needsReview: false,
    keeperId: 'a1',
    members: [member('a1'), member('a2')],
  },
  {
    groupId: 'g-merge',
    key: 'milk',
    isPublic: true,
    needsReview: true,
    keeperId: 'b1',
    members: [member('b1'), member('b2'), member('b3')],
  },
  {
    groupId: 'g-part',
    key: 'stock',
    isPublic: true,
    needsReview: true,
    keeperId: 'c3',
    members: [member('c1'), member('c2'), member('c3')],
  },
  {
    groupId: 'g-none',
    key: 'tacos',
    isPublic: true,
    needsReview: true,
    keeperId: 'd1',
    members: [member('d1'), member('d2')],
  },
];

const good = () => ({
  signed_by: 'Bob',
  signed_at: '2026-10-31T12:00:00Z',
  dry_run_sha256: SHA,
  decisions: {
    'g-merge': { action: 'merge', keeper: 'b2' },
    'g-part': { action: 'partial', keeper: 'c1', retire: ['c2'] },
    'g-none': { action: 'no_merge' },
  } as Record<string, unknown>,
});

const problems = (raw: unknown): string[] => {
  try {
    validateDecisions(raw, GROUPS, SHA);
  } catch (e) {
    if (e instanceof DecisionsError) return e.problems;
    throw e;
  }
  return [];
};

describe('validateDecisions', () => {
  it('accepts a signed, complete file', () => {
    expect(problems(good())).toEqual([]);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['not JSON', '{'],
  ])('parseDecisions rejects a %s file', (_l, text) => {
    expect(() => parseDecisions(text)).toThrow(DecisionsError);
  });

  it.each<[string, (f: ReturnType<typeof good>) => void, RegExp]>([
    [
      'unsigned',
      (f) => {
        f.signed_by = '';
      },
      /unsigned: signed_by/,
    ],
    [
      'undated',
      (f) => {
        f.signed_at = 'soon';
      },
      /unsigned: signed_at/,
    ],
    [
      'hash mismatch',
      (f) => {
        f.dry_run_sha256 = 'b'.repeat(64);
      },
      /hash mismatch/,
    ],
    [
      'unknown group id',
      (f) => {
        f.decisions['g-nope'] = { action: 'no_merge' };
      },
      /g-nope: unknown group id/,
    ],
    [
      'keeper not a member',
      (f) => {
        f.decisions['g-merge'] = { action: 'merge', keeper: 'a1' };
      },
      /g-merge: keeper a1 is not a member/,
    ],
    [
      'partial keeper not a member',
      (f) => {
        f.decisions['g-part'] = { action: 'partial', keeper: 'x', retire: ['c2'] };
      },
      /g-part: keeper x is not a member/,
    ],
    [
      'retire id not a member',
      (f) => {
        f.decisions['g-part'] = { action: 'partial', keeper: 'c1', retire: ['b1'] };
      },
      /retire id b1 is not a member/,
    ],
    [
      'retire contains keeper',
      (f) => {
        f.decisions['g-part'] = { action: 'partial', keeper: 'c1', retire: ['c1'] };
      },
      /retire list contains the keeper/,
    ],
    [
      'empty retire',
      (f) => {
        f.decisions['g-part'] = { action: 'partial', keeper: 'c1', retire: [] };
      },
      /non-empty retire list/,
    ],
    [
      'unknown action',
      (f) => {
        f.decisions['g-none'] = { action: 'maybe' };
      },
      /action must be/,
    ],
    [
      'missing review group',
      (f) => {
        delete f.decisions['g-none'];
      },
      /g-none \(tacos\): review group has no decision/,
    ],
    // A69 fields.
    [
      'source_override not a URL',
      (f) => {
        f.decisions['g-merge'] = {
          action: 'merge',
          keeper: 'b2',
          source_override: 'cookieandkate',
        };
      },
      /g-merge: source_override must be an http\(s\) URL/,
    ],
    [
      'source_override on no_merge',
      (f) => {
        f.decisions['g-none'] = { action: 'no_merge', source_override: 'https://x.y' };
      },
      /g-none: source_override needs a survivor/,
    ],
    [
      'merge retire list not the non-keepers',
      (f) => {
        f.decisions['g-merge'] = { action: 'merge', keeper: 'b2', retire: ['b1'] };
      },
      /g-merge: merge retire list must be every member except the keeper/,
    ],
    [
      'ack for an unknown group',
      (f) => {
        (f as Record<string, unknown>).ack_fewer_ingredients = [{ group_id: 'g-x', reason: 'r' }];
      },
      /ack_fewer_ingredients: unknown group g-x/,
    ],
    [
      'ack without a reason',
      (f) => {
        (f as Record<string, unknown>).ack_fewer_ingredients = [
          { group_id: 'g-auto', reason: ' ' },
        ];
      },
      /ack_fewer_ingredients: g-auto has no reason/,
    ],
    [
      'ack (map shape) naming another survivor',
      (f) => {
        (f as Record<string, unknown>).ack_fewer_ingredients = {
          'g-part': { survivor: 'c3', loser: 'c2', reason: 'r' },
        };
      },
      /ack_fewer_ingredients: g-part survivor c3 is not the group's survivor c1/,
    ],
    [
      'ack (map shape) naming the survivor as loser',
      (f) => {
        (f as Record<string, unknown>).ack_fewer_ingredients = {
          'g-part': { loser: 'c1', reason: 'r' },
        };
      },
      /ack_fewer_ingredients: g-part loser c1 is not a loser of the group/,
    ],
  ])('rejects: %s', (_label, mutate, expected) => {
    const f = good();
    mutate(f);
    const got = problems(f);
    expect(got).toHaveLength(1);
    expect(got[0]).toMatch(expected);
  });

  it('rejects the shipped example file as unsigned', () => {
    const file = path.resolve(__dirname, '../../../../scripts/dedup-135/decisions.example.json');
    const raw = parseDecisions(readFileSync(file, 'utf8')) as {
      dry_run_sha256: string;
      decisions: Record<string, { keeper?: string; retire?: string[] }>;
    };
    // Groups shaped from the example itself, so only the signature can fail.
    const groups: SignedGroup[] = Object.entries(raw.decisions).map(([groupId, d]) => ({
      groupId,
      key: groupId,
      isPublic: true,
      needsReview: true,
      keeperId: d.keeper ?? 'k',
      members: [d.keeper ?? 'k', ...(d.retire ?? []), 'other'].map(member),
    }));
    expect(groups).toHaveLength(28);
    let got: string[] = [];
    try {
      validateDecisions(raw, groups, raw.dry_run_sha256);
    } catch (e) {
      got = (e as DecisionsError).problems;
    }
    expect(got).toEqual(['unsigned: signed_by is empty', 'unsigned: signed_at is not a date']);
  });
});

describe('resolveGroups', () => {
  it('auto groups follow the rules keeper; decisions override review groups', () => {
    const file = validateDecisions(good(), GROUPS, SHA);
    expect(
      resolveGroups(GROUPS, file).map((g) => [g.groupId, g.phase, g.keeperId, g.losers])
    ).toEqual([
      ['g-auto', 1, 'a1', ['a2']],
      ['g-merge', 2, 'b2', ['b1', 'b3']],
      ['g-part', 2, 'c1', ['c2']],
      ['g-none', 2, 'd1', []],
    ]);
  });

  it('carries source_override and ack reasons (auto groups too); a full merge retire list is accepted', () => {
    const f = good() as ReturnType<typeof good> & Record<string, unknown>;
    f.decisions['g-merge'] = {
      action: 'merge',
      keeper: 'b2',
      retire: ['b3', 'b1'],
      source_override: 'https://cookieandkate.com/cashew-milk-recipe',
    };
    f.ack_fewer_ingredients = [{ group_id: 'g-auto', reason: 'B1 twin, normalised rows' }];
    const out = resolveGroups(GROUPS, validateDecisions(f, GROUPS, SHA));
    expect(out.map((g) => [g.groupId, g.sourceOverride, g.ackFewerIngredients])).toEqual([
      ['g-auto', undefined, { group_id: 'g-auto', reason: 'B1 twin, normalised rows' }],
      ['g-merge', 'https://cookieandkate.com/cashew-milk-recipe', undefined],
      ['g-part', undefined, undefined],
      ['g-none', undefined, undefined],
    ]);
  });

  it('an override on an auto group replaces the rules keeper', () => {
    const f = good();
    f.decisions['g-auto'] = { action: 'merge', keeper: 'a2' };
    const [auto] = resolveGroups(GROUPS, validateDecisions(f, GROUPS, SHA));
    expect([auto?.keeperId, auto?.losers, auto?.phase]).toEqual(['a2', ['a1'], 1]);
  });
});
