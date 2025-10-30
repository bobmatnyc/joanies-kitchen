/**
 * Unit tests for API key generation and validation
 *
 * Run with: npm test -- key-generator.test.ts
 */

import { describe, expect, it } from 'vitest';
import {
  constantTimeCompare,
  extractKeyPrefix,
  generateApiKey,
  getKeyEnvironment,
  hashApiKey,
  isDevelopmentKey,
  isProductionKey,
  maskApiKey,
  validateApiKeyFormat,
} from '../key-generator';

describe('generateApiKey', () => {
  it('should generate a valid production key', () => {
    const result = generateApiKey('production');

    expect(result.key).toMatch(/^jk_live_[0-9a-f]{64,96}$/);
    expect(result.environment).toBe('production');
    expect(result.prefix).toMatch(/^jk_live_/);
    expect(result.hash).toHaveLength(64); // SHA-256 = 64 hex chars
  });

  it('should generate a valid development key', () => {
    const result = generateApiKey('development');

    expect(result.key).toMatch(/^jk_test_[0-9a-f]{64,96}$/);
    expect(result.environment).toBe('development');
    expect(result.prefix).toMatch(/^jk_test_/);
  });

  it('should generate unique keys each time', () => {
    const key1 = generateApiKey('production');
    const key2 = generateApiKey('production');

    expect(key1.key).not.toBe(key2.key);
    expect(key1.hash).not.toBe(key2.hash);
  });

  it('should respect custom length parameter', () => {
    const result = generateApiKey('production', 48);
    const randomPortion = result.key.split('_')[2];

    expect(randomPortion).toHaveLength(96); // 48 bytes = 96 hex chars
  });

  it('should throw error for invalid length', () => {
    expect(() => generateApiKey('production', 10)).toThrow();
    expect(() => generateApiKey('production', 100)).toThrow();
  });
});

describe('hashApiKey', () => {
  it('should generate consistent SHA-256 hash', () => {
    const key = 'jk_live_abc123def456';
    const hash1 = hashApiKey(key);
    const hash2 = hashApiKey(key);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('should generate different hashes for different keys', () => {
    const hash1 = hashApiKey('jk_live_abc123');
    const hash2 = hashApiKey('jk_live_xyz789');

    expect(hash1).not.toBe(hash2);
  });

  it('should throw error for invalid input', () => {
    expect(() => hashApiKey('')).toThrow();
    expect(() => hashApiKey(null as any)).toThrow();
  });
});

describe('validateApiKeyFormat', () => {
  it('should validate correct production key format', () => {
    const result = validateApiKeyFormat(`jk_live_${'a'.repeat(64)}`);

    expect(result.valid).toBe(true);
    expect(result.environment).toBe('production');
  });

  it('should validate correct development key format', () => {
    const result = validateApiKeyFormat(`jk_test_${'b'.repeat(64)}`);

    expect(result.valid).toBe(true);
    expect(result.environment).toBe('development');
  });

  it('should reject key without correct prefix', () => {
    const result = validateApiKeyFormat('invalid_key_abc123');

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('jk_');
  });

  it('should reject key with invalid environment', () => {
    const result = validateApiKeyFormat('jk_prod_abc123def456');

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('environment');
  });

  it('should reject key with non-hex random portion', () => {
    const result = validateApiKeyFormat(`jk_live_${'xyz'.repeat(22)}`);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('hexadecimal');
  });

  it('should reject key with invalid length', () => {
    const result = validateApiKeyFormat('jk_live_abc123'); // Too short

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('characters');
  });
});

describe('extractKeyPrefix', () => {
  it('should extract default 12 character prefix', () => {
    const key = 'jk_live_abc123def456ghi789';
    const prefix = extractKeyPrefix(key);

    expect(prefix).toBe('jk_live_abc1');
  });

  it('should extract custom length prefix', () => {
    const key = 'jk_live_abc123def456';
    const prefix = extractKeyPrefix(key, 8);

    expect(prefix).toBe('jk_live_');
  });

  it('should return full key if shorter than prefix length', () => {
    const key = 'jk_live';
    const prefix = extractKeyPrefix(key, 20);

    expect(prefix).toBe(key);
  });
});

describe('isProductionKey', () => {
  it('should identify production keys', () => {
    const key = `jk_live_${'a'.repeat(64)}`;

    expect(isProductionKey(key)).toBe(true);
  });

  it('should reject development keys', () => {
    const key = `jk_test_${'a'.repeat(64)}`;

    expect(isProductionKey(key)).toBe(false);
  });

  it('should reject invalid keys', () => {
    expect(isProductionKey('invalid_key')).toBe(false);
  });
});

describe('isDevelopmentKey', () => {
  it('should identify development keys', () => {
    const key = `jk_test_${'a'.repeat(64)}`;

    expect(isDevelopmentKey(key)).toBe(true);
  });

  it('should reject production keys', () => {
    const key = `jk_live_${'a'.repeat(64)}`;

    expect(isDevelopmentKey(key)).toBe(false);
  });
});

describe('constantTimeCompare', () => {
  it('should return true for identical strings', () => {
    const hash = 'a'.repeat(64);

    expect(constantTimeCompare(hash, hash)).toBe(true);
  });

  it('should return false for different strings', () => {
    const hash1 = 'a'.repeat(64);
    const hash2 = 'b'.repeat(64);

    expect(constantTimeCompare(hash1, hash2)).toBe(false);
  });

  it('should return false for different length strings', () => {
    const hash1 = 'a'.repeat(64);
    const hash2 = 'a'.repeat(32);

    expect(constantTimeCompare(hash1, hash2)).toBe(false);
  });

  it('should be resistant to timing attacks', () => {
    // This is a basic test - real timing attack resistance
    // would require more sophisticated timing analysis
    const hash1 = 'a'.repeat(64);
    const hash2 = `${'a'.repeat(63)}b`;

    const result1 = constantTimeCompare(hash1, hash2);
    const result2 = constantTimeCompare(hash1, 'b'.repeat(64));

    expect(result1).toBe(false);
    expect(result2).toBe(false);
  });
});

describe('maskApiKey', () => {
  it('should mask middle portion of key', () => {
    const key = 'jk_live_abc123def456ghi789';
    const masked = maskApiKey(key);

    expect(masked).toMatch(/^jk_live_abc1\.\.\.i789$/);
  });

  it('should handle short keys', () => {
    const key = 'jk_live_ab';
    const masked = maskApiKey(key);

    expect(masked).toContain('...');
  });

  it('should handle invalid keys', () => {
    expect(maskApiKey('')).toBe('[invalid key]');
    expect(maskApiKey(null as any)).toBe('[invalid key]');
  });
});

describe('getKeyEnvironment', () => {
  it('should identify production environment', () => {
    const key = `jk_live_${'a'.repeat(64)}`;

    expect(getKeyEnvironment(key)).toBe('production');
  });

  it('should identify development environment', () => {
    const key = `jk_test_${'a'.repeat(64)}`;

    expect(getKeyEnvironment(key)).toBe('development');
  });

  it('should return unknown for invalid keys', () => {
    expect(getKeyEnvironment('invalid_key')).toBe('unknown');
  });
});
