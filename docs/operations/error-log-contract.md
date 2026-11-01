# Error log-line contract (`app-error`)

Issue #55. Vercel alert and drain filters match these lines by tag and field
name. This page pins what is emitted. Source of truth:
`src/lib/observability/report-error.ts` (cited below as `report-error.ts`).

## The line

`reportError` writes one `console.error` call per error. The argument is one
JSON object on one line (`report-error.ts:137-139`). The tag is the constant
`APP_ERROR_TAG = 'app-error'` (`report-error.ts:12`).

Example:

```json
{"tag":"app-error","source":"route","path":"/api/recipes","route":"/api/recipes","name":"Error","message":"connect ECONNREFUSED","ts":"2026-10-31T12:00:00.000Z"}
```

## Fields

All fields are built in `buildErrorRecord` (`report-error.ts:116-133`).
A field whose value is `undefined` is omitted by `JSON.stringify`.

| Field | Type | Meaning | Cite |
|---|---|---|---|
| `tag` | string, always `"app-error"` | The filter key. | `report-error.ts:122` |
| `source` | string enum | Where the error came from. Values below. | `report-error.ts:123`, enum at `:15-24` |
| `path` | string, optional | Request path. Query and fragment dropped, emails and tokens redacted, max 200 chars. | `report-error.ts:124`, `sanitizePath` `:62-68` |
| `route` | string, optional | Next.js route pattern such as `/recipes/[slug]`. Same sanitising as `path`. | `report-error.ts:125` |
| `detail` | string, optional | Extra non-PII detail, max 100 chars. Not redacted, so callers pass only fixed values: the Next `renderSource` or the client `boundary`. | `report-error.ts:126` |
| `digest` | string, optional | Next.js error digest, max 100 chars. | `report-error.ts:127` |
| `name` | string | Error name, redacted for emails and tokens, max 100 chars. Falls back to `typeof error` when the error has no string name. | `report-error.ts:129` |
| `message` | string | Redacted and truncated message (see below). Empty string when the error is not an `Error` or string. | `report-error.ts:130`, `sanitizeMessage` `:53-59` |
| `ts` | string | ISO 8601 UTC time of the report. | `report-error.ts:131` |

If building the record throws, the fallback line is
`{"tag":"app-error","source":"unknown","name":"ReportErrorFailure"}`
(`report-error.ts:142`). Filters on `tag` still match it.

### `source` values

Type `ErrorSource` (`report-error.ts:15-24`):

| Value | Produced by | Cite |
|---|---|---|
| `render` | Server request error: RSC render | `src/instrumentation.ts:30-36`, `:46` |
| `route` | Server request error: route handler | same |
| `action` | Server request error: server action | same |
| `middleware` | Server request error: middleware | same |
| `proxy` | Server request error: proxy | same |
| `cron` | Cron route failures | see Sources |
| `client` | Browser error boundaries via `/api/client-error` | `src/lib/observability/client-error-handler.ts:105` |
| `unknown` | Next `routeType` outside the five above, and the fallback line | `src/instrumentation.ts:46`, `report-error.ts:142` |

## Sources that produce lines

1. **Server request errors.** `onRequestError` in `src/instrumentation.ts:38-51`
   fires once per unhandled server error. It maps Next's `routeType` to
   `source`, `request.path` to `path`, `routePath` to `route` and
   `renderSource` to `detail`. It never reads headers.
2. **Client reports.** The error boundaries `src/app/error.tsx:14` (`root`),
   `src/app/global-error.tsx:21` (`global`), `src/app/meals/error.tsx:17`
   (`meals`), `src/app/meals/new/error.tsx:17` (`meals-new`) and
   `src/app/meals/[slug]/error.tsx:17` (`meals-detail`) call
   `useReportBoundaryError`. That posts `{name, message, digest?, boundary,
   pathname}` to `POST /api/client-error` (`src/app/api/client-error/route.ts:6-8`).
   The handler validates, rate-limits per IP, then calls
   `reportError(error, { source: 'client', path: payload.pathname, detail: payload.boundary })`
   (`client-error-handler.ts:105`). For these lines `detail` is one of the
   five boundary names, and `route` is absent. Payload caps are in
   `src/lib/observability/client-error-payload.ts:14-19`; the boundary
   allowlist is at `:22-28`.
3. **Crons.** `source: 'cron'` with `path` set to the cron route:
   `src/app/api/cron/daily-recipe/route.ts:147` and `:211`,
   `src/app/api/cron/purge-deleted-accounts/route.ts:30` (partial failure,
   message is a count only) and `:45`.

A rejected client report (400, 429, 503) writes no `app-error` line.

## Redaction

`message` (`sanitizeMessage`, `report-error.ts:53-59`): input cut to 2000
chars (`MAX_REDACTION_INPUT`, `:47`) before any regex runs, then these are
replaced: emails `[email]`, bearer tokens `Bearer [redacted]`, URLs with
scheme postgres, mysql, redis, http or https `[url]`, key-shaped strings
(`sk-`, `pk-`, `rk-`, `key-`, `token-`, `secret-` plus 8 or more chars)
`[secret]`, JWTs `[jwt]`, UUIDs `[uuid]`, any other run of 32 or more
`[A-Za-z0-9_-]` `[redacted]`. Whitespace is collapsed and the result is cut to
300 chars (`MAX_MESSAGE_LENGTH`, `:13`) with a trailing `…`. Patterns:
`report-error.ts:36-44`.

`path`, `route` and `name` use `redactLogText` (emails, bearer tokens,
key-shaped strings, JWTs, credentialed URLs; `report-error.ts:75-81`, `:92-103`).

Redaction is heuristic. Short ids, personal names, phone numbers and short
`Basic`/`token=` credentials are not covered (`report-error.ts:49-52`).

### Must never appear in these lines

- Query strings or fragments (they are dropped from `path`).
- Request or response headers, cookies, session tokens, API keys, bearer tokens.
- Email addresses, user ids, account ids, or other PII.
- Request bodies, database URLs or connection strings, secrets.
- Stack traces.

Callers must not put any of these into `message`, `detail` or `path`. In
particular `detail` is not redacted, so pass only fixed, non-PII values.

## Filtering in Vercel

In Vercel Observability, Logs and log drains, search runtime logs for the
string:

```
"tag":"app-error"
```

To narrow, add the field text from the same line, for example:

- `"tag":"app-error" "source":"cron"`
- `"tag":"app-error" "source":"client"`
- `"tag":"app-error" "source":"render"`

Lines are written with `console.error`, so they have log level `error`. When a
drain or alert parses JSON, filter on `tag == "app-error"` and group by
`source`. `JSON.stringify` writes no spaces, so the text patterns above match
exactly as shown.

## Changing the contract

Renaming or removing the tag `app-error`, renaming a field, or changing a
`source` value breaks every alert, drain and saved filter built on it, with no
error. Any such change must update this document in the same PR, and the PR
should say which alerts need a matching change. Adding a new optional field or
a new `source` value is compatible, but document it here too.
