/**
 * #6 S4: crawl-monitor rendering and polling. Cost figures say which figure
 * they are (run total vs ledger), null counts render as a dash, and polling
 * runs only while a run is live and the tab is visible.
 */

import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CostBreakdown,
  CostSummary,
  DiscoveryRunDetail,
  Paged,
  UnifiedRun,
} from '@/app/actions/crawl-monitor';

const mocks = vi.hoisted(() => ({
  getUnifiedCrawlRuns: vi.fn(),
  getCrawlCostSummary: vi.fn(),
  getCrawlRunDetail: vi.fn(),
  triggerManualCrawl: vi.fn(),
}));

vi.mock('@/app/actions/crawl-monitor', () => mocks);
vi.mock('@/app/actions/crawl-trigger', () => ({ triggerManualCrawl: mocks.triggerManualCrawl }));

import { CrawlMonitorDashboard } from '../CrawlMonitorDashboard';
import { formatCount, formatUsd, MISSING } from '../format';
import { RunDetailView } from '../RunDetailView';
import { RunHistoryTable } from '../RunHistoryTable';
import { POLL_INTERVAL_MS, shouldPoll, useRunningPoll } from '../use-running-poll';

const EMPTY: CostBreakdown = {
  usd: 0,
  estimatedUsd: 0,
  events: 0,
  byProvider: [],
  byOperation: [],
};
const SUMMARY: CostSummary = {
  todayStart: new Date('2026-10-28T00:00:00Z'),
  monthStart: new Date('2026-10-01T00:00:00Z'),
  today: EMPTY,
  month: EMPTY,
  allTime: EMPTY,
};

function unified(over: Partial<UnifiedRun> = {}): UnifiedRun {
  return {
    source: 'discovery',
    id: '11111111-1111-4111-8111-111111111111',
    status: 'completed',
    label: 'daily',
    started_at: new Date('2026-10-28T10:00:00Z'),
    finished_at: new Date('2026-10-28T10:04:00Z'),
    cost_usd: 0.1234,
    items: { succeeded: 3, failed: 0, skipped: 1 },
    ...over,
  };
}

function paged(rows: UnifiedRun[], over: Partial<Paged<UnifiedRun>> = {}): Paged<UnifiedRun> {
  return { rows, page: 1, pageSize: 25, hasMore: false, ...over };
}

function detail(over: Partial<DiscoveryRunDetail['run']> = {}): DiscoveryRunDetail {
  return {
    run: {
      id: '11111111-1111-4111-8111-111111111111',
      run_type: 'manual',
      status: 'completed',
      dry_run: false,
      started_at: new Date('2026-10-28T10:00:00Z'),
      finished_at: new Date('2026-10-28T10:04:00Z'),
      duration_ms: 240_000,
      cost_usd: 0.5,
      budget_usd: 2,
      cost_write_failures: 0,
      urls_discovered: 8,
      recipes_extracted: 4,
      recipes_stored: 3,
      recipes_skipped: 1,
      error_count: 0,
      item_counts: { stored: 3, failed: 1 },
      item_total: 4,
      errors: [],
      ...over,
    },
    items: [],
    items_truncated: false,
    cost: {
      usd: 0.3,
      estimatedUsd: 0.1,
      events: 2,
      byProvider: [{ provider: 'tavily', usd: 0.3, estimatedUsd: 0.1, events: 2 }],
      byOperation: [
        { provider: 'tavily', operation: 'search', usd: 0.2, estimatedUsd: 0, events: 1 },
        { provider: 'tavily', operation: 'extract', usd: 0.1, estimatedUsd: 0.1, events: 1 },
      ],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('format', () => {
  it('renders null counts and costs as a dash and keeps zero as zero', () => {
    expect(formatCount(null)).toBe(MISSING);
    expect(formatCount(undefined)).toBe(MISSING);
    expect(formatCount(0)).toBe('0');
    expect(formatUsd(null)).toBe(MISSING);
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(0.01234)).toBe('$0.0123');
    expect(formatUsd(12.5)).toBe('$12.50');
  });
});

describe('RunDetailView labels both cost figures and flags failed ledger writes', () => {
  it('shows run total and ledger side by side with no warning when writes succeeded', () => {
    render(<RunDetailView detail={detail()} />);
    expect(screen.getByText('Cost (run total)')).toBeInTheDocument();
    expect(screen.getByText('Cost (ledger)')).toBeInTheDocument();
    expect(screen.getByTestId('run-total')).toHaveTextContent('$0.5000');
    expect(screen.getByTestId('ledger-total')).toHaveTextContent('$0.3000');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const ops = screen.getByRole('table', { name: 'Cost by provider and operation' });
    expect(within(ops).getByText('search')).toBeInTheDocument();
    expect(within(ops).getByText('extract')).toBeInTheDocument();
  });

  it('warns that the ledger reads low when cost writes failed', () => {
    render(<RunDetailView detail={detail({ cost_write_failures: 2 })} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      '2 ledger write(s) failed for this run, so the ledger figure is lower than the run total.'
    );
  });

  it('renders a pre-S2 run total as a dash, not $0', () => {
    render(<RunDetailView detail={detail({ cost_usd: null, item_counts: {}, item_total: 0 })} />);
    expect(screen.getByTestId('run-total')).toHaveTextContent(MISSING);
  });
});

describe('RunHistoryTable renders null counts as a dash and labels the run total', () => {
  it('shows a dash for null counts and null cost, 0 for zero', () => {
    const job = unified({
      source: 'scraping_job',
      id: '22222222-2222-4222-8222-222222222222',
      label: 'https://example.com/chef',
      cost_usd: null,
      items: { succeeded: 5, failed: 0, skipped: null },
    });
    const preS2 = unified({ cost_usd: null, items: { succeeded: 2, failed: null, skipped: 0 } });
    render(<RunHistoryTable runs={paged([preS2, job])} loading={false} onPage={vi.fn()} />);

    expect(screen.getByText('Cost (run total)')).toBeInTheDocument();
    const cells = (id: string) =>
      within(screen.getByTestId(`run-row-${id}`))
        .getAllByRole('cell')
        .map((c) => c.textContent);
    // Succeeded, Failed, Skipped, Cost are columns 5..8.
    expect(cells(preS2.id).slice(5, 9)).toEqual(['2', MISSING, '0', MISSING]);
    expect(cells(job.id).slice(5, 9)).toEqual(['5', '0', MISSING, MISSING]);
  });

  it('enables Next only when hasMore and pages through onPage', () => {
    const onPage = vi.fn();
    const { rerender } = render(
      <RunHistoryTable runs={paged([unified()])} loading={false} onPage={onPage} />
    );
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    rerender(
      <RunHistoryTable
        runs={paged([unified()], { page: 2, hasMore: true })}
        loading={false}
        onPage={onPage}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onPage.mock.calls).toEqual([[3], [1]]);
  });

  it('expands a discovery row into its run detail', async () => {
    mocks.getCrawlRunDetail.mockResolvedValue(detail());
    render(<RunHistoryTable runs={paged([unified()])} loading={false} onPage={vi.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    });
    expect(mocks.getCrawlRunDetail).toHaveBeenCalledWith(unified().id);
    expect(screen.getByTestId('ledger-total')).toHaveTextContent('$0.3000');
  });
});

describe('shouldPoll only while visible and running or awaiting a start', () => {
  it.each([
    [{ running: true, hidden: false, awaitingStart: false }, true],
    [{ running: false, hidden: false, awaitingStart: true }, true],
    [{ running: false, hidden: false, awaitingStart: false }, false],
    [{ running: true, hidden: true, awaitingStart: false }, false],
    [{ running: false, hidden: true, awaitingStart: true }, false],
  ])('%o -> %s', (input, expected) => {
    expect(shouldPoll(input)).toBe(expected);
  });
});

describe('useRunningPoll ticks while running and stops when idle or hidden', () => {
  let visibility: DocumentVisibilityState = 'visible';

  beforeEach(() => {
    vi.useFakeTimers();
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function setVisibility(v: DocumentVisibilityState) {
    visibility = v;
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
  }

  it('never ticks when nothing is running', async () => {
    const onTick = vi.fn();
    renderHook(() => useRunningPoll({ running: false, awaitingStart: false, onTick }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 5);
    });
    expect(onTick).not.toHaveBeenCalled();
  });

  it('ticks each interval while running and stops when the run ends', async () => {
    const onTick = vi.fn();
    const { rerender, result } = renderHook(
      ({ running }) => useRunningPoll({ running, awaitingStart: false, onTick }),
      { initialProps: { running: true } }
    );
    expect(result.current.polling).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
    });
    expect(onTick).toHaveBeenCalledTimes(2);

    rerender({ running: false });
    expect(result.current.polling).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 5);
    });
    expect(onTick).toHaveBeenCalledTimes(2);
  });

  it('pauses while hidden and refreshes once on return', async () => {
    const onTick = vi.fn();
    const { result } = renderHook(() =>
      useRunningPoll({ running: true, awaitingStart: false, onTick })
    );
    setVisibility('hidden');
    expect(result.current.polling).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 5);
    });
    expect(onTick).not.toHaveBeenCalled();

    setVisibility('visible');
    expect(onTick).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(onTick).toHaveBeenCalledTimes(2);
  });

  it('does not start a tick while the previous one is in flight', async () => {
    const pending: (() => void)[] = [];
    const onTick = vi.fn(
      () =>
        new Promise<void>((r) => {
          pending.push(r);
        })
    );
    renderHook(() => useRunningPoll({ running: true, awaitingStart: false, onTick }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });
    expect(onTick).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending[0]();
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(onTick).toHaveBeenCalledTimes(2);
  });
});

describe('CrawlMonitorDashboard confirms before triggering and disables while running', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does not call the action when the admin cancels the confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<CrawlMonitorDashboard initialSummary={SUMMARY} initialRuns={paged([unified()])} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run crawl now' }));
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(mocks.triggerManualCrawl).not.toHaveBeenCalled();
  });

  it('starts a crawl after confirmation and then disables the button', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mocks.triggerManualCrawl.mockResolvedValue({ started: true });
    render(<CrawlMonitorDashboard initialSummary={SUMMARY} initialRuns={paged([unified()])} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Run crawl now' }));
    });
    expect(mocks.triggerManualCrawl).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Crawl in progress' })).toBeDisabled();
  });

  it('disables the trigger and shows the live run while one is running', () => {
    const live = unified({ status: 'running', finished_at: null, cost_usd: null });
    render(<CrawlMonitorDashboard initialSummary={SUMMARY} initialRuns={paged([live])} />);
    expect(screen.getByRole('button', { name: 'Crawl in progress' })).toBeDisabled();
    expect(screen.getByText(/Refreshing every 12 s/)).toBeInTheDocument();
    expect(screen.getByText(/run total —/)).toBeInTheDocument();
  });
});
