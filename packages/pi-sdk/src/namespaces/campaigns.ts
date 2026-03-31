import type { RequestOptions } from '../types.js';
import { extractJobQueuedContract } from '../contracts/brand-api.js';
import { campaignAdGenerationInputSchema } from '../contracts/campaign-ads-api.js';
import { campaignAdEditInputSchema } from '../contracts/campaign-ads-edit-api.js';
import { campaignAdLocalizationInputSchema } from '../contracts/campaign-localize-api.js';

type Requester = <T>(path: string, options?: RequestOptions) => Promise<T>;

export function createCampaignsNamespace({ request }: { request: Requester }) {
  return {
    generate: (
      input: unknown,
      options?: { idempotencyKey?: string; providerKeys?: RequestOptions['providerKeys'] },
    ) =>
      request<unknown>('/api/v1/campaigns/generate', {
        method: 'POST',
        body: campaignAdGenerationInputSchema.parse(input),
        idempotencyKey: options?.idempotencyKey,
        providerKeys: options?.providerKeys,
      }).then((r) => extractJobQueuedContract.parse(r)),
    edit: (
      input: unknown,
      options?: { idempotencyKey?: string; providerKeys?: RequestOptions['providerKeys'] },
    ) =>
      request<unknown>('/api/v1/campaigns/edit', {
        method: 'POST',
        body: campaignAdEditInputSchema.parse(input),
        idempotencyKey: options?.idempotencyKey,
        providerKeys: options?.providerKeys,
      }).then((r) => extractJobQueuedContract.parse(r)),
    localizeAd: (
      input: unknown,
      options?: { idempotencyKey?: string; providerKeys?: RequestOptions['providerKeys'] },
    ) =>
      request<unknown>('/api/v1/campaigns/localize-ad', {
        method: 'POST',
        body: campaignAdLocalizationInputSchema.parse(input),
        idempotencyKey: options?.idempotencyKey,
        providerKeys: options?.providerKeys,
      }).then((r) => extractJobQueuedContract.parse(r)),
  };
}
