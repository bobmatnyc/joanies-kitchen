// #55 S2: error-boundary beacon endpoint; logic lives in client-error-handler.
import { handleClientError } from '@/lib/observability/client-error-handler';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  return handleClientError(req);
}
