/**
 * #55 S1: structured server error capture for Vercel logs/Observability (D31).
 *
 * Why: unhandled and cron errors need one greppable, PII-free log line so the
 * daily Observability check (#111) can count them without a new vendor.
 * What: `reportError` writes one `console.error` JSON line tagged `app-error`
 * with source, path (query stripped), digest, error name and a redacted,
 * truncated message. It never throws.
 * Test: `src/lib/observability/__tests__/report-error.test.ts`
 */

export const APP_ERROR_TAG = 'app-error';
export const MAX_MESSAGE_LENGTH = 300;

export type ErrorSource =
  | 'render'
  | 'route'
  | 'action'
  | 'middleware'
  | 'proxy'
  | 'cron'
  | 'unknown';

export interface ReportErrorContext {
  source: ErrorSource;
  /** Request path or route pattern; any query string or fragment is dropped. */
  path?: string;
  /** Next.js route pattern, e.g. `/recipes/[slug]`. */
  route?: string;
  /** Extra non-PII detail, e.g. `renderSource`. */
  detail?: string;
}

const REDACTIONS: Array<[RegExp, string]> = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]'],
  [/\b(?:postgres(?:ql)?|mysql|redis|https?):\/\/[^\s'"]+/gi, '[url]'],
  [/\b(?:sk|pk|rk|key|token|secret)[-_][A-Za-z0-9_-]{8,}/gi, '[secret]'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt]'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[uuid]'],
  [/\b[A-Za-z0-9_-]{32,}\b/g, '[redacted]'],
];

/** #55: hard cap on input fed to the redaction regexes (they are superlinear on long input). */
export const MAX_REDACTION_INPUT = 2000;

/**
 * Redacts emails, bearer tokens, URLs, key-shaped strings and ids, then truncates.
 * Redaction is heuristic: short ids, names, phone numbers and short Basic/token= creds are not covered.
 */
export function sanitizeMessage(raw: unknown): string {
  // #55: bound the input before any regex runs.
  let msg = typeof raw === 'string' ? raw.slice(0, MAX_REDACTION_INPUT) : '';
  for (const [pattern, replacement] of REDACTIONS) msg = msg.replace(pattern, replacement);
  msg = msg.replace(/\s+/g, ' ').trim();
  return msg.length > MAX_MESSAGE_LENGTH ? `${msg.slice(0, MAX_MESSAGE_LENGTH)}…` : msg;
}

/** Keeps only the pathname: drops query string and fragment, caps the length. */
export function sanitizePath(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw === '') return undefined;
  const pathOnly = raw.split(/[?#]/, 1)[0] ?? '';
  return pathOnly.slice(0, 200);
}

function field(error: unknown, key: string): unknown {
  try {
    return error !== null && typeof error === 'object'
      ? (error as Record<string, unknown>)[key]
      : undefined;
  } catch {
    return undefined;
  }
}

/** Builds the log record. Exported for tests. */
export function buildErrorRecord(error: unknown, ctx: ReportErrorContext): Record<string, unknown> {
  const name = field(error, 'name');
  const digest = field(error, 'digest');
  const message =
    error instanceof Error ? field(error, 'message') : typeof error === 'string' ? error : '';
  return {
    tag: APP_ERROR_TAG,
    source: ctx.source,
    path: sanitizePath(ctx.path),
    route: sanitizePath(ctx.route),
    detail: typeof ctx.detail === 'string' ? ctx.detail.slice(0, 100) : undefined,
    digest: typeof digest === 'string' ? digest.slice(0, 100) : undefined,
    name: typeof name === 'string' ? name.slice(0, 100) : typeof error,
    message: sanitizeMessage(message),
    ts: new Date().toISOString(),
  };
}

/** Logs one `app-error` JSON line. Never throws. */
export function reportError(error: unknown, ctx: ReportErrorContext): void {
  try {
    console.error(JSON.stringify(buildErrorRecord(error, ctx)));
  } catch {
    try {
      console.error(`{"tag":"${APP_ERROR_TAG}","source":"unknown","name":"ReportErrorFailure"}`);
    } catch {
      // Logging itself is unavailable; nothing more can be done safely.
    }
  }
}
