import type { RequestOptions } from '../types.js';
import { extractJobQueuedContract } from '../contracts/brand-api.js';
import { adGenerationInputSchema } from '../contracts/ads-api.js';

type Requester = <T>(path: string, options?: RequestOptions) => Promise<T>;

export function createAdsNamespace({ request }: { request: Requester }) {
  return {
    generate: (
      input: unknown,
      options?: { idempotencyKey?: string; providerKeys?: RequestOptions['providerKeys'] },
    ) =>
      request<unknown>('/api/v1/ads/generate', {
        method: 'POST',
        body: adGenerationInputSchema.parse(input),
        idempotencyKey: options?.idempotencyKey,
        providerKeys: options?.providerKeys,
      }).then((r) => extractJobQueuedContract.parse(r)),
  };
}
