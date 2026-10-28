/**
 * #44: isUniqueViolation matches SQLSTATE 23505 and nothing else.
 */
import { describe, expect, it } from 'vitest';
import { isUniqueViolation } from '../error-handling';

describe('isUniqueViolation (#44)', () => {
  it.each([
    [
      'drizzle-wrapped (code on cause)',
      Object.assign(new Error('Failed query'), { cause: { code: '23505' } }),
    ],
    ['bare driver error (code on error)', { code: '23505', message: 'duplicate key' }],
  ])('matches %s', (_label, error) => {
    expect(isUniqueViolation(error)).toBe(true);
  });

  it.each([
    [
      'FK violation on cause',
      Object.assign(new Error('Failed query'), { cause: { code: '23503' } }),
    ],
    ['FK violation on error', { code: '23503' }],
    ['message containing "unique" but no code', new Error('unique constraint mentioned in text')],
    ['null', null],
    ['string', 'unique'],
  ])('does not match %s', (_label, error) => {
    expect(isUniqueViolation(error)).toBe(false);
  });
});
