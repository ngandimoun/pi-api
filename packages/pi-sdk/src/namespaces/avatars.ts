import type { RequestOptions } from '../types.js';
import { extractJobQueuedContract } from '../contracts/brand-api.js';
import { avatarGenerationInputSchema, avatarSaveInputSchema } from '../contracts/avatar-api.js';
import { z } from 'zod';

type Requester = <T>(path: string, options?: RequestOptions) => Promise<T>;

export function createAvatarsNamespace({ request }: { request: Requester }) {
  const savedAvatarContract = z.object({
    id: z.string().uuid(),
    object: z.literal('saved_avatar'),
    label: z.string().nullable(),
    image_url: z.string().url(),
    created_at: z.string(),
  });
  const savedAvatarEnvelope = z.object({
    id: z.string(),
    object: z.string(),
    status: z.string(),
    created_at: z.number(),
    data: savedAvatarContract,
  });

  const savedAvatarListEnvelope = z.object({
    id: z.string(),
    object: z.string(),
    status: z.string(),
    created_at: z.number(),
    data: z.object({
      object: z.literal('list'),
      data: z.array(
        z.object({
          id: z.string().uuid(),
          label: z.string().nullable(),
          image_url: z.string().url(),
          created_at: z.string(),
        }),
      ),
      has_more: z.boolean(),
      total_count: z.number(),
    }),
  });

  const savedAvatarRetrieveEnvelope = z.object({
    id: z.string(),
    object: z.string(),
    status: z.string(),
    created_at: z.number(),
    data: z.object({
      id: z.string().uuid(),
      object: z.literal('saved_avatar'),
      label: z.string().nullable(),
      image_url: z.string().url(),
      created_at: z.string(),
      updated_at: z.string(),
    }),
  });

  return {
    generate: (
      input: unknown,
      options?: { idempotencyKey?: string; providerKeys?: RequestOptions['providerKeys'] },
    ) =>
      request<unknown>('/api/v1/avatars/generate', {
        method: 'POST',
        body: avatarGenerationInputSchema.parse(input),
        idempotencyKey: options?.idempotencyKey,
        providerKeys: options?.providerKeys,
      }).then((r) => extractJobQueuedContract.parse(r)),
    save: async (input: unknown) => {
      const validated = avatarSaveInputSchema.parse(input);
      const response = await request<unknown>('/api/v1/avatars/save', {
        method: 'POST',
        body: validated,
      });
      return savedAvatarEnvelope.parse(response);
    },
    list: (params?: { limit?: number; offset?: number }) =>
      request<unknown>('/api/v1/avatars', { method: 'GET', query: params }).then((r) =>
        savedAvatarListEnvelope.parse(r),
      ),
    retrieve: (id: string) =>
      request<unknown>(`/api/v1/avatars/${id}`, { method: 'GET' }).then((r) =>
        savedAvatarRetrieveEnvelope.parse(r),
      ),
  };
}
