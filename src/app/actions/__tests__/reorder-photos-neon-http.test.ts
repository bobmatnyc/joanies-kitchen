/**
 * #34: reorderPhotos runs on the real drizzle neon-http driver, which throws
 * on db.transaction. The fake Neon client below stands in for the HTTP
 * transport only: each query call returns a lazy marker, and the client's
 * own `transaction` (what neon-http's db.batch sends) records the batch or
 * rejects it to simulate a failed HTTP transaction.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  batches: [] as { sql: string; params: unknown[] }[][],
  failBatch: false,
}));

vi.mock('@/lib/admin', () => ({ requireAdmin: vi.fn(async () => undefined) }));
vi.mock('@/lib/db', async () => {
  const { drizzle } = await import('drizzle-orm/neon-http');
  const schema = await import('@/lib/db/schema');
  const client = Object.assign((sql: string, params: unknown[]) => ({ sql, params }), {
    transaction: async (queries: { sql: string; params: unknown[] }[]) => {
      if (mocks.failBatch) throw new Error('neon http transaction failed');
      mocks.batches.push(queries);
      return queries.map(() => ({ rows: [], fields: [], rowCount: 1 }));
    },
  });
  return { db: drizzle(client as never, { schema }) };
});

import { reorderPhotos } from '@/app/actions/slideshow';
import { requireAdmin } from '@/lib/admin';

describe('reorderPhotos on neon-http (#34)', () => {
  beforeEach(() => {
    mocks.batches.length = 0;
    mocks.failBatch = false;
  });

  it('should write every display_order in one atomic batch when ids are given', async () => {
    await reorderPhotos(['b', 'a', 'c']);

    expect(mocks.batches).toHaveLength(1);
    const [batch] = mocks.batches;
    expect(batch).toHaveLength(3);
    for (const q of batch) expect(q.sql).toMatch(/^update "slideshow_photos"/);
    expect(batch.map((q) => [q.params[0], q.params.at(-1)])).toEqual([
      [1, 'b'],
      [2, 'a'],
      [3, 'c'],
    ]);
    expect(requireAdmin).toHaveBeenCalled();
  });

  it('should reject when the batch fails', async () => {
    mocks.failBatch = true;
    await expect(reorderPhotos(['a', 'b'])).rejects.toThrow('neon http transaction failed');
  });
});
