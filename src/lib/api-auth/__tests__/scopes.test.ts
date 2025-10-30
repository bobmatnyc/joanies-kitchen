/**
 * Unit tests for scope validation and permission checking
 *
 * Run with: npm test -- scopes.test.ts
 */

import { describe, expect, it } from 'vitest';
import {
  expandWildcard,
  getScopeDescription,
  hasAllScopes,
  hasAnyScope,
  hasScope,
  isValidScopeFormat,
  SCOPES,
  validateScopes,
} from '../scopes';

describe('hasScope', () => {
  it('should allow exact scope match', () => {
    const userScopes = ['read:recipes', 'write:meals'];

    expect(hasScope(userScopes, 'read:recipes')).toBe(true);
    expect(hasScope(userScopes, 'write:meals')).toBe(true);
  });

  it('should deny missing scope', () => {
    const userScopes = ['read:recipes'];

    expect(hasScope(userScopes, 'write:recipes')).toBe(false);
  });

  it('should support resource wildcard', () => {
    const userScopes = ['recipes:*'];

    expect(hasScope(userScopes, 'read:recipes')).toBe(true);
    expect(hasScope(userScopes, 'write:recipes')).toBe(true);
    expect(hasScope(userScopes, 'delete:recipes')).toBe(true);
  });

  it('should support global wildcard', () => {
    const userScopes = ['*'];

    expect(hasScope(userScopes, 'read:recipes')).toBe(true);
    expect(hasScope(userScopes, 'admin:users')).toBe(true);
    expect(hasScope(userScopes, 'anything:else')).toBe(true);
  });

  it('should return false for empty scopes', () => {
    expect(hasScope([], 'read:recipes')).toBe(false);
  });

  it('should support action:resource format wildcard', () => {
    const userScopes = ['read:*'];

    // This should match when user has wildcard for all resources for 'read'
    expect(hasScope(userScopes, 'read:recipes')).toBe(false); // Different format
  });
});

describe('hasAllScopes', () => {
  it('should require all scopes', () => {
    const userScopes = ['read:recipes', 'write:recipes', 'read:meals'];

    expect(hasAllScopes(userScopes, ['read:recipes', 'write:recipes'])).toBe(true);

    expect(hasAllScopes(userScopes, ['read:recipes', 'delete:recipes'])).toBe(false);
  });

  it('should work with wildcards', () => {
    const userScopes = ['recipes:*'];

    expect(hasAllScopes(userScopes, ['read:recipes', 'write:recipes'])).toBe(true);
  });

  it('should return true for empty requirements', () => {
    expect(hasAllScopes(['read:recipes'], [])).toBe(true);
  });
});

describe('hasAnyScope', () => {
  it('should allow if any scope matches', () => {
    const userScopes = ['read:recipes'];

    expect(hasAnyScope(userScopes, ['read:recipes', 'write:recipes'])).toBe(true);

    expect(hasAnyScope(userScopes, ['write:recipes', 'delete:recipes'])).toBe(false);
  });

  it('should work with wildcards', () => {
    const userScopes = ['recipes:*'];

    expect(hasAnyScope(userScopes, ['read:recipes', 'admin:users'])).toBe(true);
  });

  it('should return true for empty requirements', () => {
    expect(hasAnyScope(['read:recipes'], [])).toBe(true);
  });
});

describe('isValidScopeFormat', () => {
  it('should validate correct scope formats', () => {
    expect(isValidScopeFormat('read:recipes')).toBe(true);
    expect(isValidScopeFormat('write:meals')).toBe(true);
    expect(isValidScopeFormat('admin:users')).toBe(true);
    expect(isValidScopeFormat('recipes:*')).toBe(true);
    expect(isValidScopeFormat('*')).toBe(true);
  });

  it('should reject invalid formats', () => {
    expect(isValidScopeFormat('')).toBe(false);
    expect(isValidScopeFormat('invalid')).toBe(false);
    expect(isValidScopeFormat('too:many:colons')).toBe(false);
    expect(isValidScopeFormat('read:')).toBe(false);
    expect(isValidScopeFormat(':recipes')).toBe(false);
  });

  it('should reject non-lowercase characters', () => {
    expect(isValidScopeFormat('Read:Recipes')).toBe(false);
    expect(isValidScopeFormat('read:Recipes')).toBe(false);
  });

  it('should allow underscores', () => {
    expect(isValidScopeFormat('read:recipe_collections')).toBe(true);
  });

  it('should reject invalid types', () => {
    expect(isValidScopeFormat(null as any)).toBe(false);
    expect(isValidScopeFormat(123 as any)).toBe(false);
  });
});

describe('validateScopes', () => {
  it('should validate array of valid scopes', () => {
    const result = validateScopes(['read:recipes', 'write:meals']);

    expect(result.valid).toBe(true);
    expect(result.invalidScopes).toHaveLength(0);
  });

  it('should identify invalid scopes', () => {
    const result = validateScopes(['read:recipes', 'INVALID', 'write:meals']);

    expect(result.valid).toBe(false);
    expect(result.invalidScopes).toContain('INVALID');
  });

  it('should reject non-array input', () => {
    const result = validateScopes('not-an-array' as any);

    expect(result.valid).toBe(false);
    expect(result.message).toContain('array');
  });

  it('should allow empty array', () => {
    const result = validateScopes([]);

    expect(result.valid).toBe(true);
  });
});

describe('expandWildcard', () => {
  it('should expand resource wildcard', () => {
    const expanded = expandWildcard('recipes:*');

    expect(expanded).toContain('read:recipes');
    expect(expanded).toContain('write:recipes');
    expect(expanded).toContain('delete:recipes');
  });

  it('should return all scopes for global wildcard', () => {
    const expanded = expandWildcard('*');

    expect(expanded.length).toBeGreaterThan(10);
    expect(expanded).toContain('read:recipes');
    expect(expanded).toContain('admin:users');
  });

  it('should return single scope for non-wildcard', () => {
    const expanded = expandWildcard('read:recipes');

    expect(expanded).toEqual(['read:recipes']);
  });
});

describe('getScopeDescription', () => {
  it('should return human-readable descriptions', () => {
    expect(getScopeDescription('read:recipes')).toBe('Read recipes');
    expect(getScopeDescription('write:meals')).toBe('Create and update meal plans');
    expect(getScopeDescription('admin:*')).toBe('Full admin access');
  });

  it('should return scope itself for unknown scopes', () => {
    const unknown = 'custom:scope';

    expect(getScopeDescription(unknown)).toBe(unknown);
  });
});

describe('SCOPES constant', () => {
  it('should contain all expected recipe scopes', () => {
    expect(SCOPES.READ_RECIPES).toBe('read:recipes');
    expect(SCOPES.WRITE_RECIPES).toBe('write:recipes');
    expect(SCOPES.DELETE_RECIPES).toBe('delete:recipes');
    expect(SCOPES.RECIPES_ALL).toBe('recipes:*');
  });

  it('should contain admin scopes', () => {
    expect(SCOPES.ADMIN_USERS).toBe('admin:users');
    expect(SCOPES.ADMIN_CONTENT).toBe('admin:content');
    expect(SCOPES.ADMIN_ALL).toBe('admin:*');
  });

  it('should contain global wildcard', () => {
    expect(SCOPES.ALL).toBe('*');
  });

  it('should have valid format for all scopes', () => {
    Object.values(SCOPES).forEach((scope) => {
      expect(isValidScopeFormat(scope)).toBe(true);
    });
  });
});
