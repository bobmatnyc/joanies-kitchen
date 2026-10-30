/**
 * #135: writable connection for the merge apply and rollback, behind the same
 * anchored host check as the read-only dry run (`plan.ts`).
 *
 * The caller passes an explicit `TargetChoice` (`args.ts`): `--target prod`
 * means the unpooled prod host only (`assertProdHost`); `--target-url-env NAME`
 * reads the URL from env var NAME, which must be unpooled and must not name
 * the prod endpoint (`envTargetUrl`). Nothing prints a URL.
 */
import { Client } from 'pg';
import { assertProdHost, assertUnpooledHost } from '../../src/lib/db/admin-db-url';
import { envTargetUrl, type TargetChoice } from './args';
import { resolveConnectionString } from './plan';

// #135: an explicit target only; prod must be the unpooled prod host, a named target must not be prod.
async function resolveTarget(choice: TargetChoice): Promise<{ url: string; target: string }> {
  if (choice.kind === 'env') {
    return {
      url: envTargetUrl(choice.name, process.env),
      target: `non-prod target from ${choice.name}`,
    };
  }
  const url = await resolveConnectionString();
  assertUnpooledHost(url, 'admin');
  assertProdHost(url);
  return {
    url,
    target: `prod (${new URL(url).hostname.split('.')[0]} matches ^ep-jolly-snow-addxski4\\.)`,
  };
}

/** Writable session for apply and rollback, behind `resolveTarget`. */
export async function openWritable(
  choice: TargetChoice
): Promise<{ client: Client; target: string }> {
  const { url, target } = await resolveTarget(choice);
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query(`SET lock_timeout = '5s'`);
  return { client, target };
}

/**
 * Read-only session (same assertion as `plan.ts`): the session default is
 * read-only and must report so before any other query; the caller then reads
 * inside one REPEATABLE READ READ ONLY transaction.
 */
export async function openReadOnlyTarget(
  choice: TargetChoice
): Promise<{ client: Client; target: string }> {
  const { url, target } = await resolveTarget(choice);
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query('SET SESSION default_transaction_read_only = on');
  const ro = (await client.query('SHOW transaction_read_only')).rows[0]?.transaction_read_only;
  if (ro !== 'on') {
    await client.end();
    throw new Error('session is not read-only; refusing to run');
  }
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  return { client, target };
}
