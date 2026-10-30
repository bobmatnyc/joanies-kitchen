/**
 * #135: strict flag parsing and target choice for the dedup-135 scripts.
 *
 * Why: code-critic (WARN, HIGH) found that a missing or empty
 * `--target-url-env` value fell back to prod, and that an unknown flag such as
 * `--dry-run` was ignored, so a typo ran a real apply.
 * What: `parseArgs` rejects unknown flags, stray arguments, repeated flags and
 * a value flag with a missing or empty value. `targetChoice` needs exactly one
 * of `--target prod` or `--target-url-env NAME` (apply and rollback);
 * `envTargetUrl` refuses an unset or empty variable, a pooled host, and any
 * URL naming the prod endpoint. No message carries a URL.
 * Test: `src/lib/recipes/__tests__/dedup-135-args.test.ts`
 */
import { assertUnpooledHost, isProdTarget } from '../../src/lib/db/admin-db-url';

export type FlagSpec = Record<string, 'value' | 'bool'>;

export class ArgError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArgError';
  }
}

export interface Args {
  get(flag: string): string | undefined;
  has(flag: string): boolean;
  int(flag: string, fallback: number): number;
}

/** `--target` and `--target-url-env`, for scripts that open a connection. */
export const TARGET_FLAGS: FlagSpec = { '--target': 'value', '--target-url-env': 'value' };

export function parseArgs(argv: readonly string[], spec: FlagSpec): Args {
  const values = new Map<string, string>();
  const bools = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i] ?? '';
    const kind = spec[flag];
    if (!kind) {
      throw new ArgError(
        flag.startsWith('-')
          ? `unknown flag ${flag}`
          : `unexpected argument ${JSON.stringify(flag)}`
      );
    }
    if (values.has(flag) || bools.has(flag)) throw new ArgError(`${flag} given twice`);
    if (kind === 'bool') {
      bools.add(flag);
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--') || !value.trim()) {
      throw new ArgError(`${flag} needs a non-empty value`);
    }
    values.set(flag, value);
    i++;
  }
  return {
    get: (flag) => values.get(flag),
    has: (flag) => bools.has(flag),
    int: (flag, fallback) => {
      const v = values.get(flag);
      if (v === undefined) return fallback;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0)
        throw new ArgError(`${flag} must be a non-negative integer`);
      return n;
    },
  };
}

export type TargetChoice = { kind: 'prod' } | { kind: 'env'; name: string };

/**
 * Exactly one of `--target prod` and `--target-url-env NAME`. With
 * `required: false` (read-only checksum) neither means prod.
 */
export function targetChoice(args: Args, opts: { required: boolean }): TargetChoice {
  const target = args.get('--target');
  const envName = args.get('--target-url-env');
  if (target !== undefined && envName !== undefined) {
    throw new ArgError('give one of --target prod or --target-url-env NAME, not both');
  }
  if (envName !== undefined) return { kind: 'env', name: envName };
  if (target === undefined) {
    if (opts.required)
      throw new ArgError('a target is required: --target prod or --target-url-env NAME');
    return { kind: 'prod' };
  }
  if (target !== 'prod')
    throw new ArgError(`--target accepts only "prod", got ${JSON.stringify(target)}`);
  return { kind: 'prod' };
}

/** The non-prod URL in env var `name`; refuses unset, empty, pooled or prod-host values. */
export function envTargetUrl(name: string, env: Record<string, string | undefined>): string {
  const url = env[name];
  if (url === undefined || !url.trim()) {
    throw new ArgError(`--target-url-env ${name}: variable is not set or empty`);
  }
  assertUnpooledHost(url, 'admin');
  if (isProdTarget(url)) {
    throw new ArgError(
      `--target-url-env ${name} names the prod endpoint; refusing (value not shown)`
    );
  }
  return url;
}
