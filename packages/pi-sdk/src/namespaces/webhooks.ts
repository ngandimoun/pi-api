import type { RequestOptions } from '../types.js';
import {
  webhookCreateInputSchema,
  webhookListResponseSchema,
  webhookResponseSchema,
  webhookUpdateInputSchema,
} from '../contracts/webhooks-api.js';

type Requester = <T>(path: string, options?: RequestOptions) => Promise<T>;

export function createWebhooksNamespace({ request }: { request: Requester }) {
  return {
    list: () =>
      request<unknown>('/api/v1/webhooks', { method: 'GET' }).then((r) =>
        webhookListResponseSchema.parse(r),
      ),
    create: (input: unknown) =>
      request<unknown>('/api/v1/webhooks', {
        method: 'POST',
        body: webhookCreateInputSchema.parse(input),
      }).then((r) => webhookResponseSchema.parse(r)),
    update: (id: string, input: unknown) =>
      request<unknown>(`/api/v1/webhooks/${id}`, {
        method: 'PATCH',
        body: webhookUpdateInputSchema.parse(input),
      }).then((r) => webhookResponseSchema.parse(r)),
  };
}
