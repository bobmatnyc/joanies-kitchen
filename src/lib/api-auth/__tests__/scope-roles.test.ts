/**
 * Role-based scope limits: which `SCOPES` values a non-admin may hold.
 */

import { describe, expect, it } from 'vitest';
import {
  ADMIN_ONLY_SCOPES,
  allowedScopesForRole,
  classifyScope,
  disallowedScopesForRole,
  NON_ADMIN_SCOPES,
  SCOPE_GROUPS,
  SCOPES,
} from '../scopes';

const EXPECTED_ADMIN_ONLY = [
  '*',
  'admin:*',
  'admin:users',
  'admin:content',
  'admin:system',
  'read:analytics',
  'analytics:*',
  'write:chefs',
  'delete:chefs',
  'chefs:*',
  'write:ingredients',
  'delete:ingredients',
  'ingredients:*',
];

describe('scope classification', () => {
  it.each(Object.values(SCOPES))('classifies %s', (scope) => {
    expect(classifyScope(scope)).not.toBe('unclassified');
  });

  it('reports a scope on an unknown resource as unclassified', () => {
    expect(classifyScope('read:widgets')).toBe('unclassified');
    expect(classifyScope('widgets:*')).toBe('unclassified');
  });

  it('marks exactly the expected scopes admin-only', () => {
    expect([...ADMIN_ONLY_SCOPES].sort()).toEqual([...EXPECTED_ADMIN_ONLY].sort());
  });

  it('splits every SCOPES value into exactly one list', () => {
    const all = Object.values(SCOPES);
    expect([...NON_ADMIN_SCOPES, ...ADMIN_ONLY_SCOPES].sort()).toEqual([...all].sort());
    expect(NON_ADMIN_SCOPES.filter((s) => ADMIN_ONLY_SCOPES.includes(s))).toEqual([]);
  });

  it('allows the USER and READ_ONLY groups to non-admins', () => {
    for (const scope of [...SCOPE_GROUPS.USER, ...SCOPE_GROUPS.READ_ONLY]) {
      expect(NON_ADMIN_SCOPES).toContain(scope);
    }
  });

  it('keeps the ADMIN and SUPER_ADMIN groups admin-only', () => {
    for (const scope of [...SCOPE_GROUPS.ADMIN, ...SCOPE_GROUPS.SUPER_ADMIN]) {
      expect(ADMIN_ONLY_SCOPES).toContain(scope);
    }
  });
});

describe('allowedScopesForRole', () => {
  it('allows an admin every SCOPES value', () => {
    expect([...allowedScopesForRole(true)].sort()).toEqual([...Object.values(SCOPES)].sort());
  });

  it('allows a non-admin only the non-admin scopes', () => {
    expect(allowedScopesForRole(false)).toEqual(NON_ADMIN_SCOPES);
  });

  it("rejects scopes the user's role does not grant", () => {
    expect(disallowedScopesForRole(['read:recipes', 'admin:*', 'write:chefs'], false)).toEqual([
      'admin:*',
      'write:chefs',
    ]);
    expect(disallowedScopesForRole(['read:recipes', 'admin:*', 'write:chefs'], true)).toEqual([]);
  });

  it('rejects a scope outside SCOPES for every role', () => {
    expect(disallowedScopesForRole(['read:*'], true)).toEqual(['read:*']);
    expect(disallowedScopesForRole(['read:*'], false)).toEqual(['read:*']);
  });
});
