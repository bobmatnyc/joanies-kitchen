// #6: input validation for the crawl-monitor read API (S3).

import { z } from 'zod';

/** Rows per page when the caller gives no `pageSize`. */
export const DEFAULT_PAGE_SIZE = 25;

/** Largest page a caller can request; a larger `pageSize` is clamped to this. */
export const MAX_PAGE_SIZE = 100;

/** Highest page number accepted, so `OFFSET` stays bounded. */
export const MAX_PAGE = 10_000;

/** Most item rows `getDiscoveryRunDetail` returns for one run. */
export const MAX_RUN_DETAIL_ITEMS = 1_000;

export interface PageInput {
  page?: number;
  pageSize?: number;
}

export interface Page {
  page: number;
  pageSize: number;
  offset: number;
}

const pageSchema = z
  .object({
    page: z.number().int().min(1).max(MAX_PAGE).default(1),
    pageSize: z.number().int().min(1).default(DEFAULT_PAGE_SIZE),
  })
  .strict();

const runIdSchema = z.string().uuid();

/**
 * Why: the read API is reachable from the browser through server actions, so
 * paging values are untrusted and must not produce an unbounded query.
 * What: accepts `{ page?, pageSize? }` (or undefined) of positive integers,
 * clamps `pageSize` to `MAX_PAGE_SIZE`, and returns the SQL offset. Throws a
 * `RangeError` for anything else, before any query runs.
 * Test: `parsePageInput clamps pageSize and rejects invalid input`
 */
export function parsePageInput(input: unknown): Page {
  const parsed = pageSchema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new RangeError(`Invalid page input: ${parsed.error.issues[0]?.message ?? 'unknown'}`);
  }
  const { page } = parsed.data;
  const pageSize = Math.min(parsed.data.pageSize, MAX_PAGE_SIZE);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/** Returns `runId` when it is a UUID; throws a `RangeError` otherwise. */
export function parseRunId(runId: unknown): string {
  const parsed = runIdSchema.safeParse(runId);
  if (!parsed.success) throw new RangeError('Invalid run id: expected a UUID');
  return parsed.data;
}
