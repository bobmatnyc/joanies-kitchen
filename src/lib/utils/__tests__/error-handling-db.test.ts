/**
 * #12: a failed recipe INSERT must record the Postgres error carried on
 * `err.cause`, not drizzle's "Failed query: <sql>" wrapper.
 */

import { describe, expect, it } from 'vitest';
import { DB_ERROR_MESSAGE_MAX, describeDbError } from '../error-handling';

/** Builds the shape drizzle-orm's DrizzleQueryError has: SQL in message, pg error in cause. */
function drizzleQueryError(cause?: Error): Error {
  return new Error('Failed query: insert into "recipes" (...) values ($1, ...)\nparams: x,4 to 6', {
    cause,
  });
}

describe('describeDbError', () => {
  it('returns the cause message with its SQLSTATE code', () => {
    const pgErr = Object.assign(new Error('invalid input syntax for type integer: "4 to 6"'), {
      code: '22P02',
    });
    expect(describeDbError(drizzleQueryError(pgErr))).toBe(
      'invalid input syntax for type integer: "4 to 6" (SQLSTATE 22P02)'
    );
  });

  it('returns the cause message alone when the cause has no code', () => {
    expect(describeDbError(drizzleQueryError(new Error('connection terminated')))).toBe(
      'connection terminated'
    );
  });

  it('falls back to the error message when there is no cause', () => {
    expect(describeDbError(new Error('plain failure'))).toBe('plain failure');
  });

  it('handles non-Error values', () => {
    expect(describeDbError('boom')).toBe('boom');
  });

  it('bounds the length of the returned text', () => {
    const out = describeDbError(new Error('x'.repeat(5000)));
    expect(out.length).toBe(DB_ERROR_MESSAGE_MAX);
  });
});
