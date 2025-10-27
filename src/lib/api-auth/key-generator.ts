/**
 * API Key Generation and Cryptographic Utilities
 *
 * This module handles secure API key generation, hashing, and validation.
 *
 * Security Features:
 * - Cryptographically secure random key generation (crypto.randomBytes)
 * - SHA-256 hashing for secure storage
 * - Environment-aware key prefixes (jk_live_, jk_test_)
 * - Format validation to prevent malformed keys
 *
 * Key Format: jk_{env}_{random}
 * - Prefix: "jk_" (Joanie's Kitchen)
 * - Environment: "live" (production) or "test" (development/staging)
 * - Random: 32-48 bytes of cryptographically secure random data (hex encoded)
 *
 * Example: jk_live_a1b2c3d4e5f6...
 */

import { createHash, randomBytes } from 'node:crypto';

// ============================================================================
// CONSTANTS
// ============================================================================

const KEY_PREFIX = 'jk_';
const ENV_PRODUCTION = 'live';
const ENV_DEVELOPMENT = 'test';

// Key length in bytes (will be hex encoded, so actual length is 2x)
const MIN_KEY_LENGTH = 32; // 64 hex chars
const MAX_KEY_LENGTH = 48; // 96 hex chars
const DEFAULT_KEY_LENGTH = 32; // 64 hex chars (good balance of security and usability)

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface GeneratedApiKey {
  /**
   * The full API key (SHOW ONLY ONCE - never stored or logged)
   * Example: "jk_live_a1b2c3d4e5f6..."
   */
  key: string;

  /**
   * SHA-256 hash of the key (for secure storage in database)
   * This is what gets stored and compared during authentication
   */
  hash: string;

  /**
   * Key prefix for display purposes (first 8-12 chars)
   * Example: "jk_live_a1b2"
   * Safe to display in UI and logs
   */
  prefix: string;

  /**
   * Environment indicator
   */
  environment: 'production' | 'development';
}

// ============================================================================
// KEY GENERATION
// ============================================================================

/**
 * Generate a cryptographically secure API key
 *
 * Key components:
 * 1. Prefix: "jk_" (Joanie's Kitchen identifier)
 * 2. Environment: "live" (production) or "test" (dev/staging)
 * 3. Random data: 32-48 bytes of secure random data (hex encoded)
 *
 * @param environment - Target environment ('production' or 'development')
 * @param lengthBytes - Length of random data in bytes (32-48, default 32)
 * @returns Generated API key with hash and prefix
 *
 * @example
 * const key = generateApiKey('production');
 * // key.key = "jk_live_a1b2c3d4e5f6..."
 * // key.hash = "sha256_hash..."
 * // key.prefix = "jk_live_a1b2"
 */
export function generateApiKey(
  environment: 'production' | 'development' = 'production',
  lengthBytes: number = DEFAULT_KEY_LENGTH
): GeneratedApiKey {
  // Validate length
  if (lengthBytes < MIN_KEY_LENGTH || lengthBytes > MAX_KEY_LENGTH) {
    throw new Error(
      `Key length must be between ${MIN_KEY_LENGTH} and ${MAX_KEY_LENGTH} bytes. Got: ${lengthBytes}`
    );
  }

  // Determine environment prefix
  const envPrefix = environment === 'production' ? ENV_PRODUCTION : ENV_DEVELOPMENT;

  // Generate cryptographically secure random bytes
  const randomData = randomBytes(lengthBytes);

  // Convert to hex string for readability
  const randomHex = randomData.toString('hex');

  // Construct full key
  const fullKey = `${KEY_PREFIX}${envPrefix}_${randomHex}`;

  // Generate hash for storage
  const hash = hashApiKey(fullKey);

  // Extract prefix for display (first 12 chars includes env indicator)
  const prefix = fullKey.substring(0, 12);

  return {
    key: fullKey,
    hash,
    prefix,
    environment,
  };
}

/**
 * Hash an API key using SHA-256
 *
 * This hash is what gets stored in the database. Original keys are NEVER stored.
 * During authentication, the provided key is hashed and compared to stored hash.
 *
 * @param apiKey - The API key to hash
 * @returns SHA-256 hash as hex string (64 characters)
 *
 * @example
 * const hash = hashApiKey('jk_live_abc123...');
 * // hash = "a1b2c3d4e5f6..." (64 char hex string)
 */
export function hashApiKey(apiKey: string): string {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('API key must be a non-empty string');
  }

  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Extract key prefix from a full API key
 *
 * The prefix is safe to display in UI and logs (first 8-12 chars).
 * It helps users identify keys without exposing the secret.
 *
 * @param apiKey - The full API key
 * @param prefixLength - Length of prefix to extract (default 12)
 * @returns Key prefix for display
 *
 * @example
 * extractKeyPrefix('jk_live_abc123def456...') // "jk_live_abc1"
 * extractKeyPrefix('jk_test_xyz789...', 10) // "jk_test_xy"
 */
export function extractKeyPrefix(apiKey: string, prefixLength: number = 12): string {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('API key must be a non-empty string');
  }

  if (apiKey.length < prefixLength) {
    return apiKey; // Key is shorter than prefix length
  }

  return apiKey.substring(0, prefixLength);
}

// ============================================================================
// KEY VALIDATION
// ============================================================================

/**
 * Validate API key format
 *
 * Valid format: jk_{env}_{random}
 * - Must start with "jk_"
 * - Environment must be "live" or "test"
 * - Random portion must be hex string of appropriate length
 *
 * @param apiKey - The API key to validate
 * @returns Validation result with details
 *
 * @example
 * validateApiKeyFormat('jk_live_abc123...') // { valid: true, ... }
 * validateApiKeyFormat('invalid_key') // { valid: false, reason: '...' }
 */
export function validateApiKeyFormat(apiKey: string): {
  valid: boolean;
  reason?: string;
  environment?: 'production' | 'development';
} {
  // Type check
  if (!apiKey || typeof apiKey !== 'string') {
    return {
      valid: false,
      reason: 'API key must be a non-empty string',
    };
  }

  // Check prefix
  if (!apiKey.startsWith(KEY_PREFIX)) {
    return {
      valid: false,
      reason: `API key must start with "${KEY_PREFIX}"`,
    };
  }

  // Split into components
  const withoutPrefix = apiKey.substring(KEY_PREFIX.length);
  const parts = withoutPrefix.split('_');

  if (parts.length !== 2) {
    return {
      valid: false,
      reason: 'API key must have format: jk_{env}_{random}',
    };
  }

  const [env, random] = parts;

  // Validate environment
  if (env !== ENV_PRODUCTION && env !== ENV_DEVELOPMENT) {
    return {
      valid: false,
      reason: `Invalid environment prefix. Must be "${ENV_PRODUCTION}" or "${ENV_DEVELOPMENT}"`,
    };
  }

  // Validate random portion is hex
  if (!/^[0-9a-f]+$/i.test(random)) {
    return {
      valid: false,
      reason: 'Random portion must be a hexadecimal string',
    };
  }

  // Validate length (random portion should be 64-96 hex chars = 32-48 bytes)
  const randomLength = random.length;
  const minHexLength = MIN_KEY_LENGTH * 2;
  const maxHexLength = MAX_KEY_LENGTH * 2;

  if (randomLength < minHexLength || randomLength > maxHexLength) {
    return {
      valid: false,
      reason: `Random portion must be ${minHexLength}-${maxHexLength} characters. Got: ${randomLength}`,
    };
  }

  return {
    valid: true,
    environment: env === ENV_PRODUCTION ? 'production' : 'development',
  };
}

/**
 * Check if a key is a production key
 *
 * @param apiKey - The API key to check
 * @returns true if key is for production environment
 */
export function isProductionKey(apiKey: string): boolean {
  const validation = validateApiKeyFormat(apiKey);
  return validation.valid && validation.environment === 'production';
}

/**
 * Check if a key is a development/test key
 *
 * @param apiKey - The API key to check
 * @returns true if key is for development/testing environment
 */
export function isDevelopmentKey(apiKey: string): boolean {
  const validation = validateApiKeyFormat(apiKey);
  return validation.valid && validation.environment === 'development';
}

/**
 * Compare two API key hashes in constant time to prevent timing attacks
 *
 * This prevents attackers from using timing differences to determine
 * correct characters in the hash.
 *
 * @param hash1 - First hash to compare
 * @param hash2 - Second hash to compare
 * @returns true if hashes match
 */
export function constantTimeCompare(hash1: string, hash2: string): boolean {
  // Length check (not constant time, but necessary)
  if (hash1.length !== hash2.length) {
    return false;
  }

  let result = 0;

  // XOR all bytes and accumulate differences
  for (let i = 0; i < hash1.length; i++) {
    result |= hash1.charCodeAt(i) ^ hash2.charCodeAt(i);
  }

  // result will be 0 only if all characters matched
  return result === 0;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Mask an API key for safe logging
 *
 * Shows only the prefix and suffix, masks the middle portion
 *
 * @param apiKey - The API key to mask
 * @returns Masked key safe for logging
 *
 * @example
 * maskApiKey('jk_live_abc123def456ghi789')
 * // "jk_live_abc1...hi789"
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || typeof apiKey !== 'string') {
    return '[invalid key]';
  }

  if (apiKey.length <= 20) {
    return `${apiKey.substring(0, 8)}...`;
  }

  const prefix = apiKey.substring(0, 12);
  const suffix = apiKey.substring(apiKey.length - 4);

  return `${prefix}...${suffix}`;
}

/**
 * Get environment from API key
 *
 * @param apiKey - The API key
 * @returns Environment ('production', 'development', or 'unknown')
 */
export function getKeyEnvironment(apiKey: string): 'production' | 'development' | 'unknown' {
  const validation = validateApiKeyFormat(apiKey);

  if (!validation.valid) {
    return 'unknown';
  }

  return validation.environment || 'unknown';
}
