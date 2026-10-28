/**
 * #6 S4: /admin/crawl-monitor redirects a non-admin to `/` before loading any
 * run or spend data, the same way the admin layout does. Removing the page's
 * admin check makes the non-admin cases fail.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  getCrawlCostSummary: vi.fn(),
  getUnifiedCrawlRuns: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/app/actions/crawl-monitor', () => ({
  getCrawlCostSummary: mocks.getCrawlCostSummary,
  getUnifiedCrawlRuns: mocks.getUnifiedCrawlRuns,
  getCrawlRunDetail: vi.fn(),
}));
vi.mock('@/app/actions/crawl-trigger', () => ({ triggerManualCrawl: vi.fn() }));

import CrawlMonitorPage from '@/app/admin/crawl-monitor/page';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCrawlCostSummary.mockResolvedValue({});
  mocks.getUnifiedCrawlRuns.mockResolvedValue({ rows: [], page: 1, pageSize: 25, hasMore: false });
});

describe('CrawlMonitorPage', () => {
  it.each([
    ['signed out', { userId: null, sessionClaims: null }],
    ['signed-in non-admin', { userId: 'u1', sessionClaims: { metadata: { isAdmin: 'false' } } }],
  ])('redirects a %s caller to / before loading data', async (_label, session) => {
    mocks.auth.mockResolvedValue(session);
    await expect(CrawlMonitorPage()).rejects.toThrow('NEXT_REDIRECT:/');
    expect(mocks.redirect).toHaveBeenCalledWith('/');
    expect(mocks.getCrawlCostSummary).not.toHaveBeenCalled();
    expect(mocks.getUnifiedCrawlRuns).not.toHaveBeenCalled();
  });

  it('loads spend and page 1 of runs for an admin', async () => {
    mocks.auth.mockResolvedValue({
      userId: 'u1',
      sessionClaims: { metadata: { isAdmin: 'true' } },
    });
    await CrawlMonitorPage();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.getUnifiedCrawlRuns).toHaveBeenCalledWith({ page: 1, pageSize: 25 });
    expect(mocks.getCrawlCostSummary).toHaveBeenCalledOnce();
  });
});
