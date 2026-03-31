import type { RequestOptions } from '../types.js';
import { extractJobQueuedContract } from '../contracts/brand-api.js';
import { neuroDecodeInputSchema } from '../contracts/neuro-decode-api.js';

type Requester = <T>(path: string, options?: RequestOptions) => Promise<T>;

export function createNeuroNamespace({ request }: { request: Requester }) {
  return {
    decode: (
      input: unknown,
      options?: { idempotencyKey?: string; providerKeys?: RequestOptions['providerKeys'] },
    ) =>
      request<unknown>('/api/v1/neuro/decode', {
        method: 'POST',
        body: neuroDecodeInputSchema.parse(input),
        idempotencyKey: options?.idempotencyKey,
        providerKeys: options?.providerKeys,
      }).then((r) => extractJobQueuedContract.parse(r)),
  };
}
