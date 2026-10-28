'use client';

// #6: polling policy for the crawl-monitor's running-job panel (S4).

import { useEffect, useRef, useState } from 'react';

/** Poll period while a run is live. A cron run lasts at most 5 minutes. */
export const POLL_INTERVAL_MS = 12_000;

/**
 * How long to keep polling after a trigger before the new run row appears.
 * The run row is inserted shortly after the trigger action returns.
 */
export const START_GRACE_MS = 60_000;

/**
 * Why: polling must be bounded — only while there is something to watch and
 * someone to watch it.
 * What: true when the page is visible and either a run is `running` or a
 * trigger is still inside its `START_GRACE_MS` window (`awaitingStart`).
 * Test: `shouldPoll only while visible and running or awaiting a start`
 */
export function shouldPoll(input: {
  running: boolean;
  hidden: boolean;
  awaitingStart: boolean;
}): boolean {
  return !input.hidden && (input.running || input.awaitingStart);
}

function isHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

/**
 * Why: the dashboard refreshes the running job without SSE (#6 S4).
 * What: while `shouldPoll` holds, calls `onTick` every `intervalMs`. The
 * interval is cleared when the tab is hidden, when nothing is running or
 * awaited, and on unmount; it resumes (with an immediate
 * tick) when a hidden tab becomes visible again. `onTick` is read through a
 * ref so a new callback each render does not restart the timer. Interval
 * ticks never overlap: one still in flight makes the next a no-op.
 * Test: `useRunningPoll ticks while running and stops when idle or hidden`
 */
export function useRunningPoll(options: {
  running: boolean;
  awaitingStart: boolean;
  onTick: () => Promise<void> | void;
  intervalMs?: number;
}): { polling: boolean; hidden: boolean } {
  const { running, awaitingStart, intervalMs = POLL_INTERVAL_MS } = options;
  const onTick = useRef(options.onTick);
  onTick.current = options.onTick;
  const [hidden, setHidden] = useState(isHidden);

  useEffect(() => {
    const onVisibility = () => setHidden(isHidden());
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const polling = shouldPoll({ running, hidden, awaitingStart });

  useEffect(() => {
    if (!polling) return;
    let inFlight = false;
    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        await onTick.current();
      } finally {
        inFlight = false;
      }
    };
    const id = setInterval(() => {
      void tick();
    }, intervalMs);
    return () => clearInterval(id);
  }, [polling, intervalMs]);

  // A tab that comes back while a run is live refreshes at once.
  const wasHidden = useRef(hidden);
  useEffect(() => {
    if (wasHidden.current && !hidden && running) void onTick.current();
    wasHidden.current = hidden;
  }, [hidden, running]);

  return { polling, hidden };
}
