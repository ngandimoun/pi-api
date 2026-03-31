import type { ProviderKeys, RequestOptions } from '../types.js';
import { sseStream } from '../streaming.js';
import { extractJobQueuedContract } from '../contracts/brand-api.js';
import { policyCreateInputSchema, streamCreateInputSchema } from '../contracts/surveillance-api.js';
import {
  surveillancePoliciesListResponseSchema,
  surveillancePolicyUpsertResponseSchema,
} from '../contracts/surveillance-responses.js';

type Requester = <T>(path: string, options?: RequestOptions) => Promise<T>;

export function createSurveillanceNamespace(input: {
  request: Requester;
  baseUrl: string;
  apiKey: string;
  providerKeys?: ProviderKeys;
  fetchImpl?: typeof fetch;
}) {
  const baseUrl = input.baseUrl.replace(/\/+$/, '');

  return {
    streams: {
      create: (body: unknown, options?: { idempotencyKey?: string; providerKeys?: ProviderKeys }) =>
        input
          .request<unknown>('/api/v1/surveillance/streams', {
            method: 'POST',
            body: streamCreateInputSchema.parse(body),
            idempotencyKey: options?.idempotencyKey,
            providerKeys: options?.providerKeys,
          })
          .then((r) => extractJobQueuedContract.parse(r)),
    },
    policies: {
      list: (params?: { stream_id?: string }) =>
        input
          .request<unknown>('/api/v1/surveillance/policies', { method: 'GET', query: params })
          .then((r) => surveillancePoliciesListResponseSchema.parse(r)),
      upsert: (body: unknown) =>
        input
          .request<unknown>('/api/v1/surveillance/policies', {
            method: 'POST',
            body: policyCreateInputSchema.parse(body),
          })
          .then((r) => surveillancePolicyUpsertResponseSchema.parse(r)),
    },
    events: (
      params: { stream_id: string; severity?: 'info' | 'warning' | 'critical' },
      options?: { providerKeys?: ProviderKeys },
    ) => {
      const url = new URL(`${baseUrl}/api/v1/surveillance/events`);
      url.searchParams.set('stream_id', params.stream_id);
      if (params.severity) url.searchParams.set('severity', params.severity);

      const headers: Record<string, string> = {
        Authorization: `Bearer ${input.apiKey}`,
        ...(options?.providerKeys?.gemini
          ? { 'X-Gemini-Api-Key': options.providerKeys.gemini }
          : {}),
        ...(options?.providerKeys?.firecrawl
          ? { 'X-Firecrawl-Api-Key': options.providerKeys.firecrawl }
          : {}),
      };

      return sseStream({ url: url.toString(), options: { headers }, fetchImpl: input.fetchImpl });
    },
  };
}
